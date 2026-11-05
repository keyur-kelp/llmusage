import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError, ApiErrorBody } from '../../core/api/api-error';
import { ChatDoneEvent } from '../../core/api/models';
import { SseParser } from './sse-parser';

export interface ChatRequest {
  conversationId?: string;
  model: string;
  message: string;
}

export interface StreamHandlers {
  onDelta(text: string): void;
  onDone(done: ChatDoneEvent): void;
  onError(code: string, message: string): void;
}

/** POSTs to /api/chat/stream with fetch (EventSource cannot send an Authorization header) and parses the SSE body. */
@Injectable({ providedIn: 'root' })
export class ChatStreamService {
  private readonly auth = inject(AuthService);

  async stream(req: ChatRequest, handlers: StreamHandlers, signal?: AbortSignal): Promise<void> {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: 'Bearer ' + (this.auth.token() ?? ''),
      },
      body: JSON.stringify(req),
      signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.startsWith('text/event-stream') || !response.body) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      const err = ApiError.fromBody(response.status, body);
      if (response.status === 401 || err.code === 'ACCOUNT_DISABLED') this.auth.logout();
      throw err;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        dispatch(ev.event, ev.data, handlers);
      }
    }
  }
}

function dispatch(event: string, data: string, h: StreamHandlers): void {
  const payload = JSON.parse(data) as Record<string, unknown>;
  if (event === 'delta') h.onDelta(String(payload['text'] ?? ''));
  else if (event === 'done') h.onDone(payload as unknown as ChatDoneEvent);
  else if (event === 'error') h.onError(String(payload['code'] ?? 'INTERNAL_ERROR'), String(payload['message'] ?? 'Error'));
}
