import { AfterViewChecked, Component, ElementRef, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { LayoutService } from '../../core/layout.service';
import { formatUsd } from '../../core/format';
import { formatIst } from '../../core/ist-date.pipe';
import { AppShellComponent } from '../../shared/app-shell.component';
import { ChatStore } from './chat.store';
import { ConversationSidebarComponent } from './conversation-sidebar.component';
import { ModelPickerComponent } from './model-picker.component';
import { MessageListComponent } from './message-list.component';
import { ComposerComponent } from './composer.component';
import { QuotaPanelComponent } from './quota-panel.component';

@Component({
  selector: 'app-chat-page',
  imports: [
    MatIconModule,
    MatSidenavModule,
    AppShellComponent,
    ConversationSidebarComponent,
    ModelPickerComponent,
    MessageListComponent,
    ComposerComponent,
    QuotaPanelComponent,
  ],
  template: `
    <app-shell
      section="chat"
      skipLabel="Skip to message box"
      skipTarget='[data-testid="composer-input"]'
      [showMenu]="layout.compact()"
      (menu)="navOpen.set(!navOpen())"
    >
      <mat-sidenav-container class="container">
        <mat-sidenav
          class="nav"
          [mode]="layout.compact() ? 'over' : 'side'"
          [opened]="navOpen()"
          (closedStart)="navOpen.set(false)"
          [autoFocus]="false"
        >
          <app-conversation-sidebar
            [conversations]="store.conversations()"
            [activeId]="store.activeId()"
            [loading]="store.conversationsLoading()"
            (picked)="onPicked()"
            (newChat)="startNew()"
          />
        </mat-sidenav>

        <mat-sidenav-content class="page">
          <h1 class="visually-hidden">Chat</h1>
          @if (layout.mobile()) {
            <app-quota-panel
              [quota]="store.quota()"
              [loading]="store.quotaLoading()"
              [error]="store.quotaError()"
              [compact]="true"
              (retry)="store.refreshQuota()"
            />
          }
          <div class="body" [class.with-quota]="!layout.mobile()">
            <main class="main" id="main" tabindex="-1">
              <div class="top">
                <app-model-picker
                  [models]="store.models()"
                  [selected]="store.selectedModel()"
                  [disabled]="store.streaming()"
                  (changed)="store.selectedModel.set($event)"
                />
                @if (store.modelsError(); as e) {
                  <span class="error">{{ e }}</span>
                }
              </div>

              <div class="messages" #scroller>
                <div class="column">
                  <app-message-list [messages]="store.messages()" [pending]="store.pendingText()" [streaming]="store.streaming()" (suggest)="composer()?.fill($event)" />
                </div>
              </div>

              <div class="column foot">
                @if (store.blockReason(); as b) {
                  <div class="banner app-rise" role="alert" tabindex="-1" #banner>
                    <span class="banner-tile"><mat-icon class="app-icon-l" aria-hidden="true">block</mat-icon></span>
                    <div class="banner-body">
                      <strong class="banner-title" data-testid="quota-block-reason">{{ b.label }}</strong>
                      <div>
                        {{ blockDetail(b.limit) }}
                        <span class="reset" data-testid="quota-reset-time">Resets {{ resetText(b.resetsAt) }}</span>.
                        @if (b.limit === 'USER') { Ask an admin if you need more. }
                      </div>
                    </div>
                  </div>
                }
                @if (store.error(); as e) {
                  <div class="banner app-rise" role="alert" data-testid="chat-error">
                    <span class="banner-tile"><mat-icon class="app-icon-l" aria-hidden="true">error_outline</mat-icon></span>
                    <div class="banner-body">{{ e }}</div>
                  </div>
                }
                <app-composer [busy]="store.streaming()" [blockedUntil]="blockedUntil()" [send]="sendFn" />
              </div>
            </main>

            @if (!layout.mobile()) {
              <aside class="quota" aria-label="Quota">
                <app-quota-panel
                  [quota]="store.quota()"
                  [loading]="store.quotaLoading()"
                  [error]="store.quotaError()"
                  (retry)="store.refreshQuota()"
                />
              </aside>
            }
          </div>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </app-shell>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .container { height: 100%; background: transparent; }
    .nav { width: var(--app-sidebar-w); max-width: 85vw; background: var(--mat-sys-surface-container-low);
      border-inline-end: 1px solid var(--app-border); }
    :host ::ng-deep .mat-drawer-content { overflow: hidden; }
    .page { display: flex; flex-direction: column; height: 100%; background: transparent; }
    .body { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); }
    .body.with-quota { grid-template-columns: minmax(0, 1fr) var(--app-quota-w); }
    .main { display: flex; flex-direction: column; min-height: 0; min-width: 0; padding: 12px 16px 0; outline: none; }
    .quota { border-inline-start: 1px solid var(--app-border); background: var(--mat-sys-surface-container-low); padding: 16px; overflow-y: auto; }
    .top { display: flex; align-items: center; gap: 12px; }
    .messages { flex: 1; overflow-y: auto; padding: 4px 0; }
    .column { max-width: var(--app-content-max); margin: 0 auto; width: 100%; }
    .foot { padding-bottom: max(8px, env(safe-area-inset-bottom)); }
    .banner { display: flex; gap: 12px; align-items: flex-start; padding: 16px 20px; margin: 8px 0; border-radius: var(--app-radius-l);
      background: var(--app-danger-container); color: var(--app-on-danger-container); border: 1px solid var(--app-danger-border);
      box-shadow: var(--app-shadow-1); outline: none; }
    .banner:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; }
    .banner-tile { display: inline-grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 50%;
      background: var(--app-danger); color: var(--mat-sys-on-error); }
    .banner-body { font: var(--mat-sys-body-medium); min-width: 0; align-self: center; }
    .banner-title { display: block; font: var(--app-type-title); font-size: 16px; line-height: 24px; color: var(--app-danger-title); }
    .reset { font-weight: 600; font-feature-settings: var(--app-num); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .error { color: var(--mat-sys-error); }
    @media (max-width: 1023.98px) { .body.with-quota { grid-template-columns: minmax(0, 1fr) 280px; } }
    @media (max-width: 599.98px) { .main { padding: 8px 12px 0; } }
  `,
})
export class ChatPage implements OnInit, AfterViewChecked {
  protected readonly layout = inject(LayoutService);
  protected readonly store = inject(ChatStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  protected readonly composer = viewChild(ComposerComponent);
  private readonly banner = viewChild<ElementRef<HTMLElement>>('banner');
  private lastScrollKey = '';

  /** Drawer state: open by default on desktop, closed (over mode) below 1024 px. */
  protected readonly navOpen = signal(!this.layout.compact());
  protected readonly blockedUntil = computed(() => formatIst(this.store.blockReason()?.resetsAt));

  constructor() {
    effect(() => this.navOpen.set(!this.layout.compact()));
    // After a block, move focus to the banner so the reason is announced and found.
    effect(() => this.banner()?.nativeElement.focus());
  }

  protected readonly sendFn = async (text: string): Promise<boolean> => {
    const wasNew = this.store.activeId() === null;
    const ok = await this.store.send(text);
    const id = this.store.activeId();
    if (ok && wasNew && id) {
      await this.router.navigate(['/chat', id], { replaceUrl: true });
      // The route change can drop focus to <body>; put it back in the box.
      this.composer()?.focus();
    }
    return ok;
  };

  async ngOnInit(): Promise<void> {
    await this.store.init();
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      if (id && id !== this.store.activeId()) void this.store.open(id);
      if (!id && this.store.activeId() && !this.store.streaming()) this.store.newChat();
    });
  }

  ngAfterViewChecked(): void {
    const key = this.store.messages().length + ':' + this.store.pendingText().length + ':' + this.store.streaming();
    const scroller = this.scroller();
    if (key !== this.lastScrollKey && scroller) {
      this.lastScrollKey = key;
      const el = scroller.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  protected blockDetail(limit: 'USER' | 'SYSTEM'): string {
    const q = this.store.quota();
    if (limit === 'SYSTEM') {
      const cap = q ? ' of ' + formatUsd(q.system.quotaUsd) : '';
      return `The team's monthly limit${cap} is used up, so chat is paused for everyone.`;
    }
    const cap = q ? ' of ' + formatUsd(q.user.quotaUsd) : '';
    return `You've used your weekly limit${cap}.`;
  }

  protected resetText(iso: string): string {
    return formatIst(iso);
  }

  onPicked(): void {
    if (this.layout.compact()) this.navOpen.set(false);
  }

  startNew(): void {
    this.store.newChat();
    if (this.layout.compact()) this.navOpen.set(false);
    void this.router.navigate(['/chat']);
  }
}
