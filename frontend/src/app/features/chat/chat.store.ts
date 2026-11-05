import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  QuotaStatus,
} from '../../core/api/models';
import { ApiError } from '../../core/api/api-error';
import { ChatStreamService } from './chat-stream.service';

export interface BlockReason {
  limit: 'USER' | 'SYSTEM';
  label: string;
  resetsAt: string;
}

export function blockReasonFrom(err: ApiError): BlockReason | null {
  if (err.code !== 'USER_QUOTA_EXCEEDED' && err.code !== 'SYSTEM_QUOTA_EXCEEDED') return null;
  const limit = err.code === 'SYSTEM_QUOTA_EXCEEDED' ? 'SYSTEM' : 'USER';
  return {
    limit,
    label: limit === 'SYSTEM' ? 'System quota reached' : 'Personal quota reached',
    resetsAt: String(err.details?.['resetsAt'] ?? ''),
  };
}

@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly http = inject(HttpClient);
  private readonly streamer = inject(ChatStreamService);

  readonly models = signal<string[]>([]);
  readonly selectedModel = signal<string | null>(null);
  readonly conversations = signal<ConversationSummary[]>([]);
  readonly activeId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly streaming = signal(false);
  readonly pendingText = signal('');
  readonly quota = signal<QuotaStatus | null>(null);
  readonly blockReason = signal<BlockReason | null>(null);
  readonly error = signal<string | null>(null);
  readonly quotaLoading = signal(false);
  readonly quotaError = signal<string | null>(null);
  readonly conversationsLoading = signal(true);
  readonly modelsError = signal<string | null>(null);
  /** Bumped by reset(); callbacks and results from an older generation are ignored. */
  private generation = 0;
  private abort: AbortController | null = null;

  readonly hasPending = computed(() => this.streaming());

  async init(): Promise<void> {
    await Promise.all([this.loadModels(), this.loadConversations(), this.refreshQuota()]);
  }

  /** Clears all per-user state (called on logout so the next user never sees it). */
  reset(): void {
    this.generation += 1;
    this.abort?.abort();
    this.abort = null;
    this.models.set([]);
    this.selectedModel.set(null);
    this.conversations.set([]);
    this.activeId.set(null);
    this.messages.set([]);
    this.streaming.set(false);
    this.pendingText.set('');
    this.quota.set(null);
    this.blockReason.set(null);
    this.error.set(null);
    this.modelsError.set(null);
    this.quotaLoading.set(false);
    this.quotaError.set(null);
    this.conversationsLoading.set(true);
  }

  async loadModels(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ models: { id: string }[]; defaultModel?: string | null }>('/api/models'));
      const ids = res.models.map((m) => m.id);
      this.models.set(ids);
      if (!this.selectedModel() || !ids.includes(this.selectedModel() ?? '')) {
        const preferred = res.defaultModel && ids.includes(res.defaultModel) ? res.defaultModel : null;
        this.selectedModel.set(preferred ?? ids[0] ?? null);
      }
      this.modelsError.set(null);
    } catch (err) {
      this.modelsError.set(ApiError.fromHttp(err).message);
    }
  }

  async loadConversations(): Promise<void> {
    this.conversationsLoading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<{ conversations: ConversationSummary[] }>('/api/conversations'));
      this.conversations.set(res.conversations);
    } catch (err) {
      this.error.set(ApiError.fromHttp(err).message);
    } finally {
      this.conversationsLoading.set(false);
    }
  }

  async refreshQuota(): Promise<void> {
    this.quotaLoading.set(true);
    try {
      this.quota.set(await firstValueFrom(this.http.get<QuotaStatus>('/api/quota/me')));
      this.quotaError.set(null);
    } catch (err) {
      this.quotaError.set(ApiError.fromHttp(err).message);
    } finally {
      this.quotaLoading.set(false);
    }
  }

  newChat(): void {
    this.activeId.set(null);
    this.messages.set([]);
    this.pendingText.set('');
    this.error.set(null);
  }

  async open(id: string): Promise<void> {
    if (this.streaming()) return;
    try {
      const detail = await firstValueFrom(this.http.get<ConversationDetail>('/api/conversations/' + id));
      this.activeId.set(detail.id);
      this.messages.set(detail.messages);
      this.pendingText.set('');
      this.error.set(null);
    } catch (err) {
      this.newChat();
      this.error.set(ApiError.fromHttp(err).message);
    }
  }

  /** Returns true when the exchange completed and was saved. */
  async send(text: string): Promise<boolean> {
    const model = this.selectedModel();
    const message = text.trim();
    if (!model || !message || this.streaming()) return false;

    const gen = this.generation;
    const abort = new AbortController();
    this.abort = abort;
    const stale = (): boolean => gen !== this.generation;

    this.streaming.set(true);
    this.pendingText.set('');
    this.error.set(null);
    this.blockReason.set(null);
    const optimistic: ChatMessage = {
      id: 'pending-user',
      role: 'user',
      content: message,
      model,
      createdAt: new Date().toISOString(),
    };
    const before = this.messages();
    this.messages.set([...before, optimistic]);

    let ok = false;
    try {
      await this.streamer.stream(
        { conversationId: this.activeId() ?? undefined, model, message },
        {
          onDelta: (t) => {
            if (!stale()) this.pendingText.update((p) => p + t);
          },
          onDone: (done) => {
            if (stale()) return;
            const now = new Date().toISOString();
            const answer = this.pendingText();
            this.pendingText.set('');
            this.activeId.set(done.conversationId);
            this.messages.set([
              ...before,
              { id: done.userMessageId, role: 'user', content: message, model, createdAt: now },
              { id: done.assistantMessageId, role: 'assistant', content: answer, model, createdAt: now },
            ]);
            this.quota.set(done.quota);
            ok = true;
          },
          onError: (_code, msg) => {
            if (stale()) return;
            this.error.set(msg + ' Nothing was saved; please try again.');
          },
        },
        abort.signal,
      );
    } catch (err) {
      if (stale()) return false; // logged out mid-stream: the store was reset, leave it alone
      const apiErr = ApiError.fromHttp(err);
      const block = blockReasonFrom(apiErr);
      if (block) {
        this.blockReason.set(block);
        await this.refreshQuota().catch(() => undefined);
      } else {
        this.error.set(apiErr.message);
      }
    }
    if (stale()) return false;
    if (this.abort === abort) this.abort = null;
    if (!ok) this.messages.set(before); // nothing was saved
    this.pendingText.set('');
    this.streaming.set(false);
    if (ok) await this.loadConversations().catch(() => undefined);
    return ok;
  }
}
