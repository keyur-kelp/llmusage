import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { ConversationSummary } from '../../core/api/models';
import { formatIstShort, isIstToday } from '../../core/ist-date.pipe';

@Component({
  selector: 'app-conversation-sidebar',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatListModule],
  template: `
    <button mat-flat-button type="button" class="new" data-testid="new-chat" (click)="newChat.emit()">
      <mat-icon class="app-icon-m">add</mat-icon>New chat
    </button>
    @if (loading() && conversations().length === 0) {
      <div class="skeleton" aria-busy="true" aria-label="Loading conversations">
        <span></span><span></span><span></span>
      </div>
    } @else if (conversations().length === 0) {
      <div class="empty">
        <span class="app-icon-tile"><mat-icon aria-hidden="true">forum</mat-icon></span>
        <p class="empty-title">No conversations yet</p>
        <p class="empty-hint">Your chats will appear here.</p>
      </div>
    } @else {
      <nav aria-label="Conversations">
        @for (g of groups(); track g.label) {
          <h2 class="group">{{ g.label }}</h2>
          <mat-nav-list>
            @for (c of g.items; track c.id) {
              <a
                mat-list-item
                data-testid="conversation-item"
                [routerLink]="['/chat', c.id]"
                [activated]="c.id === activeId()"
                [attr.aria-current]="c.id === activeId() ? 'page' : null"
                (click)="picked.emit(c.id)"
              >
                <span matListItemTitle>{{ c.title }}</span>
                <span matListItemLine class="time app-num">{{ time(c.updatedAt) }}</span>
              </a>
            }
          </mat-nav-list>
        }
      </nav>
    }
  `,
  styles: `
    :host { display: block; padding: 16px; }
    .new { width: 100%; --mat-button-filled-container-height: 44px; }
    .group { font: var(--app-type-overline); letter-spacing: .08em; text-transform: uppercase; color: var(--mat-sys-on-surface-variant); margin: 16px 12px 6px; }
    mat-nav-list { --mat-list-active-indicator-color: var(--mat-sys-secondary-container); padding: 0; }
    a[mat-list-item] { border-radius: var(--app-radius-m); margin: 2px 0; position: relative; transition: background-color var(--app-motion-fast) var(--app-ease); }
    a[mat-list-item]:hover { background: var(--app-row-hover); }
    a[mat-list-item][aria-current='page']::before { content: ''; position: absolute; inset-inline-start: 0; top: 50%; width: 3px; height: 20px;
      margin-top: -10px; border-radius: var(--app-radius-pill); background: var(--mat-sys-primary); }
    a[mat-list-item][aria-current='page'] { --mdc-list-list-item-label-text-color: var(--mat-sys-on-secondary-container); }
    .time { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-label-medium); }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 32px 16px; text-align: center; }
    .empty p { margin: 0; }
    .empty-title { font: var(--mat-sys-body-medium); font-weight: 500; color: var(--mat-sys-on-surface); }
    .empty-hint { font: var(--mat-sys-body-small); color: var(--mat-sys-on-surface-variant); }
    .skeleton { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; }
    .skeleton span { height: 40px; border-radius: var(--app-radius-s); background: var(--app-track); }
  `,
})
export class ConversationSidebarComponent {
  readonly conversations = input<ConversationSummary[]>([]);
  readonly activeId = input<string | null>(null);
  readonly loading = input(false);
  /** Emitted on click so the page can close the drawer on small screens; navigation itself is the routerLink. */
  readonly picked = output<string>();
  readonly newChat = output<void>();

  readonly groups = computed(() => {
    const now = new Date();
    const today = this.conversations().filter((c) => isIstToday(c.updatedAt, now));
    const earlier = this.conversations().filter((c) => !isIstToday(c.updatedAt, now));
    return [
      ...(today.length ? [{ label: 'Today', items: today }] : []),
      ...(earlier.length ? [{ label: 'Earlier', items: earlier }] : []),
    ];
  });

  time(iso: string): string {
    return formatIstShort(iso, new Date());
  }
}
