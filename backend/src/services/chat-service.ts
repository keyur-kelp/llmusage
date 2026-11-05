import { Sequelize } from 'sequelize';
import { z } from 'zod';
import type { Logger } from 'pino';
import { Repositories } from '../repositories';
import { Conversation } from '../models';
import { AppError, notFound } from '../lib/errors';
import { istDate } from '../lib/time';
import { ChatMessage, LlmError, LlmGateway } from './llm-gateway';
import { QuotaService, QuotaStatus } from './quota-service';

export const chatBodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  model: z.string().min(1).max(200),
  message: z.string().trim().min(1).max(20000),
});

export type ChatInput = z.infer<typeof chatBodySchema>;

export interface PreparedChat {
  userId: string;
  conversation: Conversation | null;
  model: string;
  message: string;
  history: ChatMessage[];
}

export type SseEmit = (event: 'delta' | 'done' | 'error', data: unknown) => void;

export interface ChatDone {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: string };
  quota: QuotaStatus;
}

const TITLE_LENGTH = 60;

export class ChatService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly repos: Repositories,
    private readonly gateway: LlmGateway,
    private readonly quota: QuotaService,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Everything that must succeed before SSE headers go out. Errors here become normal JSON errors. */
  async prepare(userId: string, input: ChatInput): Promise<PreparedChat> {
    let conversation: Conversation | null = null;
    if (input.conversationId) {
      conversation = await this.repos.conversations.findOwned(input.conversationId, userId);
      if (!conversation) throw notFound('Conversation not found');
    }
    let available: boolean;
    try {
      available = await this.gateway.isModelAvailable(input.model);
    } catch {
      throw new AppError('LLM_UNAVAILABLE', 502, 'The language model service is unavailable');
    }
    if (!available) throw new AppError('MODEL_NOT_AVAILABLE', 400, 'The selected model is not available');

    await this.quota.check(userId); // system first, then user; throws 429

    const history: ChatMessage[] = conversation
      ? buildHistory(await this.repos.messages.listByConversation(conversation.id))
      : [];
    return { userId, conversation, model: input.model, message: input.message, history };
  }

  /**
   * Streams the upstream answer through `emit`, then persists message pair + ledger row in one transaction.
   * Keeps consuming even if the client disconnected (emit becomes a no-op), so spend is never lost.
   * On any failure nothing is persisted and an `error` event is emitted.
   */
  async execute(p: PreparedChat, emit: SseEmit): Promise<void> {
    try {
      const handle = this.gateway.chat({
        model: p.model,
        messages: [...p.history, { role: 'user', content: p.message }],
      });
      let answer = '';
      for await (const text of handle.deltas) {
        answer += text;
        emit('delta', { text });
      }
      const usage = await handle.result;
      const ids = await this.persist(p, answer, usage);
      const quota = await this.quota.getStatus(p.userId);
      const done: ChatDone = {
        ...ids,
        usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd },
        quota,
      };
      emit('done', done);
    } catch (err) {
      const upstream = err instanceof LlmError;
      this.logger.error({ model: p.model, userId: p.userId, upstream, err: errMessage(err) }, 'chat failed');
      emit('error', {
        code: upstream ? 'LLM_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: upstream ? 'The language model service failed to answer' : 'Internal server error',
      });
    }
  }

  private async persist(
    p: PreparedChat,
    answer: string,
    usage: { inputTokens: number; outputTokens: number; costUsd: string; costRaw: string; callId: string | null },
  ): Promise<{ conversationId: string; userMessageId: string; assistantMessageId: string }> {
    const now = this.now();
    return this.sequelize.transaction(async (tx) => {
      const conversation =
        p.conversation ?? (await this.repos.conversations.create(p.userId, p.message.trim().slice(0, TITLE_LENGTH), tx));
      const userMsg = await this.repos.messages.create(
        { conversationId: conversation.id, role: 'user', content: p.message, model: p.model, createdAt: now },
        tx,
      );
      const assistantMsg = await this.repos.messages.create(
        {
          conversationId: conversation.id,
          role: 'assistant',
          content: answer,
          model: p.model,
          createdAt: new Date(now.getTime() + 1),
        },
        tx,
      );
      await this.repos.usage.insertLedger(
        {
          userId: p.userId,
          conversationId: conversation.id,
          assistantMessageId: assistantMsg.id,
          model: p.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUsd: usage.costUsd,
          litellmCostRaw: usage.costRaw,
          litellmCallId: usage.callId,
          usageDate: istDate(now),
          createdAt: now,
        },
        tx,
      );
      await this.repos.conversations.touch(conversation.id, tx);
      return { conversationId: conversation.id, userMessageId: userMsg.id, assistantMessageId: assistantMsg.id };
    });
  }
}

/** Providers reject empty assistant turns, so those (e.g. an upstream answer with no content) are left out of the context. */
export function buildHistory(messages: { role: 'user' | 'assistant'; content: string }[]): ChatMessage[] {
  return messages
    .filter((m) => !(m.role === 'assistant' && m.content.trim() === ''))
    .map((m) => ({ role: m.role, content: m.content }));
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
