import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ChatMessage } from '../../core/api/models';
import { MarkdownPipe } from '../../core/markdown.pipe';
import { AppLogoComponent } from '../../shared/app-logo.component';

/**
 * Assistant replies are Markdown: rendered by renderMarkdown (marked + DOMPurify) and bound with [innerHTML],
 * which Angular sanitises again. User text is plain text only (interpolation).
 */
@Component({
  selector: 'app-message-list',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MarkdownPipe, AppLogoComponent],
  template: `
    <div class="list" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation">
      @for (m of messages(); track m.id) {
        <div class="msg app-rise" [class.user]="m.role === 'user'" [attr.data-testid]="'message-' + m.role">
          <div class="who">
            @if (m.role === 'assistant') { <app-logo class="mark" [size]="20" /> }
            {{ m.role === 'user' ? 'You' : 'Assistant' }}
            @if (m.role === 'assistant') {
              <span class="model" data-testid="message-model">{{ m.model }}</span>
            }
          </div>
          @if (m.role === 'assistant') {
            <div class="text md" [innerHTML]="m.content | markdown"></div>
          } @else {
            <div class="text plain">{{ m.content }}</div>
          }
        </div>
      }
      @if (streaming() && !pending()) {
        <div class="msg typing app-rise" aria-busy="true">
          <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="visually-hidden">Assistant is replying</span>
        </div>
      }
      @if (pending()) {
        <div class="msg" data-testid="message-assistant" aria-busy="true">
          <div class="who"><app-logo class="mark" [size]="20" />Assistant</div>
          <div class="text md" [innerHTML]="pending() | markdown"></div>
          <mat-progress-bar class="progress" mode="indeterminate" aria-label="Assistant is replying" />
        </div>
      }
    </div>
    @if (messages().length === 0 && !pending() && !streaming()) {
      <div class="empty app-rise">
        <span class="empty-tile"><mat-icon class="app-icon-xl" aria-hidden="true">forum</mat-icon></span>
        <h2 class="empty-title">Start a conversation</h2>
        <p class="empty-text">Pick a model and send a message. Each reply shows the model that answered, and your quota updates after it.</p>
        <div class="suggestions" role="group" aria-label="Suggestions">
          @for (sg of suggestions; track sg.label) {
            <button mat-stroked-button type="button" class="sg" (click)="suggest.emit(sg.prompt)">
              <mat-icon class="app-icon-s" aria-hidden="true">lightbulb</mat-icon>{{ sg.label }}
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .msg { position: relative; padding: 12px 16px; margin: 12px 0; border-radius: 18px 18px 18px 6px; max-width: 85%; overflow: hidden;
      background: var(--app-surface-raised); border: 1px solid var(--app-border); box-shadow: var(--app-shadow-1); }
    .msg.user { margin-left: auto; max-width: 80%; background: var(--app-gradient-bubble); color: #fff; border-color: transparent;
      border-radius: 18px 18px 6px 18px; }
    .who { display: flex; align-items: center; gap: 8px; font: var(--mat-sys-label-medium); font-weight: 600; color: var(--mat-sys-on-surface); margin-bottom: 4px; }
    .msg.user .who { color: var(--app-on-brand-muted); }
    .mark { color: var(--mat-sys-primary); }
    .model { display: inline-flex; align-items: center; height: 22px; padding: 0 10px; border-radius: var(--app-radius-pill);
      background: var(--app-tile-bg); color: var(--app-model-chip-fg); font-weight: 500; }
    .text { overflow-wrap: anywhere; }
    .plain { white-space: pre-wrap; }
    .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; }
    .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 50%; margin-top: 48px; gap: 8px; text-align: center; }
    .empty-tile { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 20px; background: var(--app-gradient-brand);
      color: #fff; box-shadow: var(--app-shadow-2); margin-bottom: 8px; }
    .empty-title { font: var(--app-type-h1); font-size: 22px; line-height: 30px; margin: 0; }
    .empty-text { font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); max-width: 420px; margin: 0; }
    .suggestions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 8px; }
    .sg { --mat-button-outlined-container-shape: var(--app-radius-pill); }
    .typing { display: inline-block; }
    .dots { display: inline-flex; gap: 4px; align-items: center; height: 24px; }
    .dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--mat-sys-primary); animation: bounce 1.2s infinite ease-in-out; }
    .dots i:nth-child(2) { animation-delay: .15s; }
    .dots i:nth-child(3) { animation-delay: .3s; }
    @keyframes bounce { 0%, 60%, 100% { opacity: .5; transform: none; } 30% { opacity: 1; transform: translateY(-3px); } }
    @media (prefers-reduced-motion: reduce) { .dots i { animation: none; opacity: 1; transform: scale(.6); } }
    @media (max-width: 599.98px) { .msg, .msg.user { max-width: 92%; } }
    .md > :first-child { margin-top: 0; }
    .md > :last-child { margin-bottom: 0; }
    :host ::ng-deep .md p, :host ::ng-deep .md ul, :host ::ng-deep .md ol { margin: 0 0 8px; }
    :host ::ng-deep .md ul, :host ::ng-deep .md ol { padding-inline-start: 20px; }
    :host ::ng-deep .md pre { overflow-x: auto; padding: 12px 14px; border-radius: var(--app-radius-xs); background: var(--app-surface-sunken); }
    :host ::ng-deep .md code { font-family: var(--app-font-mono); font-size: 13.5px; line-height: 20px; }
    :host ::ng-deep .md :not(pre) > code { padding: 2px 6px; border-radius: var(--app-radius-xs); background: var(--app-surface-sunken); }
    :host ::ng-deep .md table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; }
    :host ::ng-deep .md th, :host ::ng-deep .md td { border: 1px solid var(--mat-sys-outline-variant); padding: 4px 8px; }
    :host ::ng-deep .md img { max-width: 100%; }
    :host ::ng-deep .md a { color: var(--mat-sys-primary); text-decoration: underline; }
    :host ::ng-deep .md blockquote { margin: 0 0 8px; padding-inline-start: 12px; border-inline-start: 3px solid var(--mat-sys-outline-variant); }
  `,
})
export class MessageListComponent {
  readonly messages = input<ChatMessage[]>([]);
  readonly pending = input('');
  readonly streaming = input(false);
  /** A starter prompt was picked: the page puts it in the composer (never sends). */
  readonly suggest = output<string>();
  protected readonly suggestions = [
    { label: 'Summarise a paragraph', prompt: 'Summarise the following paragraph in two sentences:\n\n' },
    { label: 'Explain a concept', prompt: 'Explain this concept in simple terms: ' },
    { label: 'Draft an email', prompt: 'Draft a short, polite email about ' },
  ];
}
