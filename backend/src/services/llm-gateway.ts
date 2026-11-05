import OpenAI from 'openai';
import Decimal from 'decimal.js';
import { z } from 'zod';
import type { Logger } from 'pino';
import { toMoneyString } from '../lib/money';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UsageResult {
  inputTokens: number;
  outputTokens: number;
  /** LiteLLM-reported cost rounded HALF_UP to 6 dp. */
  costUsd: string;
  /** Exact textual cost as LiteLLM reported it (audit, AC-12). */
  costRaw: string;
  callId: string | null;
}

export interface ChatHandle {
  /** Text deltas. Must be consumed to the end for `result` to settle. */
  deltas: AsyncIterable<string>;
  result: Promise<UsageResult>;
}

export interface LlmGateway {
  listModels(): Promise<string[]>;
  isModelAvailable(model: string): Promise<boolean>;
  chat(req: { model: string; messages: ChatMessage[] }): ChatHandle;
}

/** Upstream (LiteLLM / provider) failure, including a response with no cost. Maps to LLM_UNAVAILABLE. */
export class LlmError extends Error {}

const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  // `cost` is not in the openai SDK types, so it is parsed here.
  cost: z.union([z.number(), z.string()]).nullish(),
});

/**
 * Converts LiteLLM's reported usage into a UsageResult. Cost is taken exactly as reported:
 * no pricing in the app and no after-the-fact lookup. A missing cost is an error.
 */
export function parseUsage(usage: unknown, callId: string | null): UsageResult {
  const parsed = usageSchema.safeParse(usage);
  if (!parsed.success) throw new LlmError('Upstream response had no usable usage block');
  const { prompt_tokens, completion_tokens, cost } = parsed.data;
  if (cost === null || cost === undefined || cost === '') {
    throw new LlmError('Upstream usage had no cost (check litellm_settings.include_cost_in_streaming_usage)');
  }
  const costRaw = String(cost);
  let dec: Decimal;
  try {
    dec = new Decimal(costRaw);
  } catch {
    throw new LlmError('Upstream cost was not a number');
  }
  if (!dec.isFinite() || dec.isNegative()) throw new LlmError('Upstream cost was not a valid amount');
  return {
    inputTokens: prompt_tokens,
    outputTokens: completion_tokens,
    costUsd: toMoneyString(dec),
    costRaw,
    callId,
  };
}

const MODEL_CACHE_TTL_MS = 30_000;

export class LiteLlmGateway implements LlmGateway {
  private readonly client: OpenAI;
  private cache: { ids: Set<string>; at: number } | null = null;

  constructor(
    baseUrl: string,
    apiKey: string,
    private readonly logger: Logger,
  ) {
    // maxRetries 0: a retried chat call could be billed twice.
    this.client = new OpenAI({ baseURL: `${baseUrl.replace(/\/+$/, '')}/v1`, apiKey, maxRetries: 0 });
  }

  async listModels(): Promise<string[]> {
    try {
      const page = await this.client.models.list();
      const ids = page.data.map((m) => m.id);
      this.cache = { ids: new Set(ids), at: Date.now() };
      return ids;
    } catch (err) {
      this.logger.error({ err: errMessage(err) }, 'LiteLLM model list failed');
      throw new LlmError('Could not reach LiteLLM');
    }
  }

  async isModelAvailable(model: string): Promise<boolean> {
    if (this.cache && Date.now() - this.cache.at < MODEL_CACHE_TTL_MS && this.cache.ids.has(model)) return true;
    return (await this.listModels()).includes(model); // refresh on miss / stale
  }

  // Path A: T-2 gate passed 2026-11-05; cost comes from the final stream chunk `usage.cost`
  // (include_cost_in_streaming_usage). No fallback pricing.
  chat(req: { model: string; messages: ChatMessage[] }): ChatHandle {
    let resolve!: (u: UsageResult) => void;
    let reject!: (e: unknown) => void;
    const result = new Promise<UsageResult>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    result.catch(() => undefined); // failure is surfaced through `deltas`; avoid unhandled rejection

    const client = this.client;
    const logger = this.logger;
    async function* deltas(): AsyncGenerator<string> {
      let callId: string | null = null;
      try {
        const { data: stream, response } = await client.chat.completions
          .create({
            model: req.model,
            messages: req.messages,
            stream: true,
            stream_options: { include_usage: true },
          })
          .withResponse();
        callId = response.headers.get('x-litellm-call-id');
        let usage: unknown = null;
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield text;
          if (chunk.usage) usage = chunk.usage;
        }
        resolve(parseUsage(usage, callId));
      } catch (err) {
        logger.error({ model: req.model, callId, err: errMessage(err) }, 'LLM call failed');
        const wrapped = err instanceof LlmError ? err : new LlmError('LLM request failed');
        reject(wrapped);
        throw wrapped;
      }
    }
    return { deltas: deltas(), result };
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
