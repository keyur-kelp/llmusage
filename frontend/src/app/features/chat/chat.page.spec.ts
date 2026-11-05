import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { LayoutService } from '../../core/layout.service';
import { chatMatcher } from '../../app.routes';
import { ChatPage } from './chat.page';
import { ChatStore } from './chat.store';

function fakeStore() {
  const activeId = signal<string | null>(null);
  return {
    conversations: signal([]),
    conversationsLoading: signal(false),
    activeId,
    models: signal<string[]>([]),
    selectedModel: signal<string | null>(null),
    modelsError: signal<string | null>(null),
    messages: signal([]),
    pendingText: signal(''),
    streaming: signal(false),
    quota: signal(null),
    quotaLoading: signal(false),
    quotaError: signal<string | null>(null),
    blockReason: signal(null),
    error: signal<string | null>(null),
    init: jasmine.createSpy().and.callFake(async () => undefined),
    open: jasmine.createSpy().and.callFake(async (id: string) => { activeId.set(id); }),
    newChat: jasmine.createSpy().and.callFake(() => activeId.set(null)),
    refreshQuota: jasmine.createSpy(),
    send: jasmine.createSpy().and.callFake(async () => { activeId.set('new-id'); return true; }),
  };
}

describe('ChatPage route reuse', () => {
  it('keeps the same page, skips open/init and refocuses the composer after the first message', async () => {
    const store = fakeStore();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ matcher: chatMatcher, component: ChatPage }]),
        { provide: ChatStore, useValue: store },
        { provide: AuthService, useValue: { user: () => ({ name: 'Ann' }), isAdmin: () => false, logout: () => undefined } },
        { provide: LayoutService, useValue: { mobile: () => false, compact: () => false } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/chat', ChatPage);
    await harness.fixture.whenStable();
    expect(store.init).toHaveBeenCalledTimes(1);

    const host = harness.routeNativeElement as HTMLElement;
    document.body.appendChild(host);
    const textarea = host.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
    expect(textarea).not.toBeNull();
    (document.activeElement as HTMLElement | null)?.blur();

    const ok = await (page as unknown as { sendFn: (t: string) => Promise<boolean> }).sendFn('hello');
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(ok).toBe(true);
    expect(harness.routeDebugElement?.componentInstance).toBe(page);
    expect(store.open).not.toHaveBeenCalled();
    expect(store.init).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(host.querySelector('[data-testid="composer-input"]'));

    await harness.navigateByUrl('/chat/other');
    await harness.fixture.whenStable();
    expect(harness.routeDebugElement?.componentInstance).toBe(page);
    expect(store.open).toHaveBeenCalledWith('other');
  });
});
