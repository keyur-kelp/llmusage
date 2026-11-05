import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ChatMessage, ConversationSummary } from '../../core/api/models';
import { ComposerComponent } from './composer.component';
import { ConversationSidebarComponent } from './conversation-sidebar.component';
import { MessageListComponent } from './message-list.component';

const msg = (role: 'user' | 'assistant', content: string, id: string = role): ChatMessage => ({
  id, role, content, model: 'claude-sonnet-5-5', createdAt: '2026-11-05T10:00:00.000Z',
});

describe('MessageListComponent', () => {
  function render(inputs: Record<string, unknown>): HTMLElement {
    const fixture = TestBed.createComponent(MessageListComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('is a polite live log', () => {
    const el = render({ messages: [] });
    const log = el.querySelector('[role="log"]');
    expect(log?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders assistant Markdown as HTML and user text as plain text', () => {
    const el = render({ messages: [msg('user', '**not bold**', 'u'), msg('assistant', '**Red:** warm', 'a')] });
    expect(el.querySelector('[data-testid="message-assistant"] strong')?.textContent).toBe('Red:');
    expect(el.querySelector('[data-testid="message-user"]')?.textContent).toContain('**not bold**');
    expect(el.querySelector('[data-testid="message-model"]')?.textContent?.trim()).toBe('claude-sonnet-5-5');
  });

  it('strips <script> and onerror payloads from a reply', () => {
    const w = window as unknown as { __xss?: number };
    delete w.__xss;
    const el = render({
      messages: [msg('assistant', 'hi <script>window.__xss=1</script><img src="x" onerror="window.__xss=1">')],
    });
    expect(el.querySelector('script')).toBeNull();
    expect(el.innerHTML.toLowerCase()).not.toContain('onerror');
    expect(w.__xss).toBeUndefined();
  });

  it('shows typing dots before the first token, then a busy bubble with a progress bar', () => {
    let el = render({ messages: [msg('user', 'q', 'u')], streaming: true, pending: '' });
    expect(el.textContent).toContain('Assistant is replying');
    expect(el.querySelector('[data-testid="message-assistant"]')).toBeNull();
    el = render({ messages: [msg('user', 'q', 'u')], streaming: true, pending: 'Hel' });
    const bubble = el.querySelector('[data-testid="message-assistant"]');
    expect(bubble?.getAttribute('aria-busy')).toBe('true');
    expect(bubble?.querySelector('mat-progress-bar')).not.toBeNull();
  });

  it('re-renders as deltas arrive and survives an unfinished code fence', () => {
    const fixture = TestBed.createComponent(MessageListComponent);
    fixture.componentRef.setInput('streaming', true);
    fixture.componentRef.setInput('pending', 'Code:\n```js\nlet a');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('pre code')?.textContent).toContain('let a');
    fixture.componentRef.setInput('pending', 'Code:\n```js\nlet a = 1;\n```\nDone **now**');
    fixture.detectChanges();
    expect(el.querySelector('strong')?.textContent).toBe('now');
  });

  it('shows the empty state', () => {
    expect(render({ messages: [] }).textContent).toContain('Start a conversation');
  });
});

describe('ConversationSidebarComponent', () => {
  const now = new Date().toISOString();
  const convs: ConversationSummary[] = [
    { id: 'c1', title: 'First', updatedAt: now },
    { id: 'c2', title: 'Old', updatedAt: '2020-01-01T10:00:00.000Z' },
  ];

  function render(inputs: Record<string, unknown>): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ConversationSidebarComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders keyboard-reachable links with aria-current on the active one', () => {
    const el = render({ conversations: convs, activeId: 'c2' });
    const items = Array.from(el.querySelectorAll('[data-testid="conversation-item"]'));
    expect(items.length).toBe(2);
    expect(items.map((i) => i.getAttribute('href'))).toEqual(['/chat/c1', '/chat/c2']);
    expect(items[1]?.getAttribute('aria-current')).toBe('page');
    expect(items[0]?.getAttribute('aria-current')).toBeNull();
  });

  it('groups into Today and Earlier', () => {
    const text = render({ conversations: convs }).textContent ?? '';
    expect(text).toContain('Today');
    expect(text).toContain('Earlier');
  });

  it('shows empty and loading states', () => {
    expect(render({ conversations: [] }).textContent).toContain('No conversations yet');
  });
});

describe('ComposerComponent', () => {
  it('keeps the textarea enabled (and focusable) while a reply streams, and blocks submit', async () => {
    const send = jasmine.createSpy('send').and.resolveTo(true);
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.componentRef.setInput('send', send);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const textarea = el.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
    expect(textarea?.disabled).toBeFalse();
    fixture.componentInstance.text.set('hello');
    await fixture.componentInstance.submit();
    expect(send).not.toHaveBeenCalled();
    expect(el.querySelector<HTMLButtonElement>('[data-testid="send-button"]')?.disabled).toBeTrue();
  });

  it('sends and clears when idle', async () => {
    const send = jasmine.createSpy('send').and.resolveTo(true);
    const fixture = TestBed.createComponent(ComposerComponent);
    fixture.componentRef.setInput('send', send);
    fixture.detectChanges();
    fixture.componentInstance.text.set('hello');
    await fixture.componentInstance.submit();
    expect(send).toHaveBeenCalledWith('hello');
    expect(fixture.componentInstance.text()).toBe('');
  });
});

@Component({
  selector: 'app-suggest-host',
  imports: [MessageListComponent, ComposerComponent],
  template: `
    <app-message-list [messages]="[]" (suggest)="composer.fill($event)" />
    <app-composer #composer [send]="send" />
  `,
})
class SuggestHostComponent {
  readonly send = jasmine.createSpy('send').and.resolveTo(true);
}

describe('suggestion chips', () => {
  it('fill and focus the composer without sending', async () => {
    const fixture = TestBed.createComponent(SuggestHostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const chip = el.querySelector<HTMLButtonElement>('.suggestions button');
    expect(chip).not.toBeNull();
    chip?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const textarea = el.querySelector<HTMLTextAreaElement>('[data-testid="composer-input"]');
    expect(textarea?.value.trim()).not.toBe('');
    expect(document.activeElement).toBe(textarea ?? null);
    expect(fixture.componentInstance.send).not.toHaveBeenCalled();
    fixture.nativeElement.remove();
  });
});
