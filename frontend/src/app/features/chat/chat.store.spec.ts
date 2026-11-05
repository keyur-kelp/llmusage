import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiError } from '../../core/api/api-error';
import { ChatStore, blockReasonFrom } from './chat.store';
import { ChatStreamService, StreamHandlers } from './chat-stream.service';
import { ChatDoneEvent } from '../../core/api/models';

describe('blockReasonFrom', () => {
  it('maps USER_QUOTA_EXCEEDED to the personal quota label and keeps the reset instant', () => {
    const r = blockReasonFrom(new ApiError(429, 'USER_QUOTA_EXCEEDED', 'x', { resetsAt: '2026-11-06T18:30:00.000Z' }));
    expect(r).toEqual({ limit: 'USER', label: 'Personal quota reached', resetsAt: '2026-11-06T18:30:00.000Z' });
  });

  it('maps SYSTEM_QUOTA_EXCEEDED to the system quota label', () => {
    const r = blockReasonFrom(new ApiError(429, 'SYSTEM_QUOTA_EXCEEDED', 'x', { resetsAt: '2026-11-30T18:30:00.000Z' }));
    expect(r?.limit).toBe('SYSTEM');
    expect(r?.label).toBe('System quota reached');
  });

  it('returns null for other errors', () => {
    expect(blockReasonFrom(new ApiError(502, 'LLM_UNAVAILABLE', 'x'))).toBeNull();
  });
});

describe('ChatStore', () => {
  let store: ChatStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(ChatStore);
    http = TestBed.inject(HttpTestingController);
  });

  it('init() resolves and sets error when conversations and quota fail', async () => {
    const p = store.init();
    http.expectOne('/api/models').flush({ models: [{ id: 'm1' }] });
    http.expectOne('/api/conversations').flush({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, { status: 500, statusText: 'x' });
    http.expectOne('/api/quota/me').flush({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, { status: 500, statusText: 'x' });
    await p; // must not reject
    expect(store.error()).toBeTruthy();
    expect(store.selectedModel()).toBe('m1');
  });

  it('reset() clears all per-user state', () => {
    store.activeId.set('abc');
    store.messages.set([{ id: '1', role: 'user', content: 'secret', model: 'm', createdAt: '' }]);
    store.conversations.set([{ id: 'abc', title: 't', updatedAt: '' }]);
    store.error.set('e');
    store.reset();
    expect(store.activeId()).toBeNull();
    expect(store.messages()).toEqual([]);
    expect(store.conversations()).toEqual([]);
    expect(store.quota()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('loadModels() pre-selects defaultModel, falling back to the first model', async () => {
    const p = store.loadModels();
    http.expectOne('/api/models').flush({ models: [{ id: 'a' }, { id: 'b' }], defaultModel: 'b' });
    await p;
    expect(store.selectedModel()).toBe('b');

    store.reset();
    const p2 = store.loadModels();
    http.expectOne('/api/models').flush({ models: [{ id: 'a' }, { id: 'b' }] });
    await p2;
    expect(store.selectedModel()).toBe('a');
  });
});

describe('ChatStore stream vs reset()', () => {
  it('reset() aborts the stream in flight and a late done event cannot repopulate the store', async () => {
    let handlers!: StreamHandlers;
    let signal: AbortSignal | undefined;
    let release!: () => void;
    const fake = {
      stream: (_req: unknown, h: StreamHandlers, s?: AbortSignal): Promise<void> => {
        handlers = h;
        signal = s;
        return new Promise<void>((resolve) => (release = resolve));
      },
    };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: ChatStreamService, useValue: fake }],
    });
    const store = TestBed.inject(ChatStore);
    store.selectedModel.set('m1');

    const sending = store.send('hello');
    expect(store.streaming()).toBe(true);
    expect(signal?.aborted).toBe(false);

    store.reset();
    expect(signal?.aborted).toBe(true);

    // Stream ends after logout and still delivers events: all must be ignored.
    handlers.onDelta('late');
    handlers.onDone({
      conversationId: 'old-conv',
      userMessageId: 'u',
      assistantMessageId: 'a',
      quota: { stub: true },
    } as unknown as ChatDoneEvent);
    release();
    expect(await sending).toBe(false);

    expect(store.activeId()).toBeNull();
    expect(store.messages()).toEqual([]);
    expect(store.quota()).toBeNull();
    expect(store.pendingText()).toBe('');
    expect(store.streaming()).toBe(false);
  });
});
