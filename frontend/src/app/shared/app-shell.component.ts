import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../core/auth/auth.service';
import { LayoutService } from '../core/layout.service';
import { AppLogoComponent } from './app-logo.component';
import { ThemeToggleComponent } from './theme-toggle.component';

/** Shared top bar for chat and admin (docs/ux/ui-design.md 4.7). Page content is projected below the bar. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule, AppLogoComponent, ThemeToggleComponent],
  template: `
    <a class="skip" href="#main" (click)="skip($event)">{{ skipLabel() }}</a>
    <header class="bar">
      @if (showMenu()) {
        <button mat-icon-button type="button" aria-label="Conversations" (click)="menu.emit()">
          <mat-icon>menu</mat-icon>
        </button>
      }
      <span class="logo-tile"><app-logo [size]="20" /></span>
      <span class="brand">LLM Usage Control</span>
      @if (section() === 'admin') {
        <span class="crumb" aria-hidden="true">&rsaquo;</span>
        <span class="crumb-name">Admin</span>
      }
      <span class="spacer"></span>
      @if (!layout.mobile()) { <span class="who">{{ auth.user()?.name }}</span> }
      @if (auth.isAdmin()) { <span class="role">ADMIN</span> }
      @if (!layout.mobile()) {
        <app-theme-toggle />
        @if (section() === 'chat' && auth.isAdmin()) {
          <a mat-button routerLink="/admin" data-testid="admin-link">Admin</a>
        }
        @if (section() === 'admin') {
          <a mat-button routerLink="/chat" data-testid="back-to-chat">Chat</a>
        }
        <button mat-button type="button" data-testid="logout" (click)="auth.logout()">Log out</button>
      } @else {
        <button mat-icon-button type="button" aria-label="More actions" [matMenuTriggerFor]="more">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #more="matMenu">
          <button mat-menu-item type="button" disabled data-testid="menu-user-name">{{ auth.user()?.name }}</button>
          <button mat-menu-item type="button" data-testid="theme-toggle" [matMenuTriggerFor]="themeToggle.menu()">
            <mat-icon aria-hidden="true">contrast</mat-icon>
            <span>Theme: {{ themeToggle.modeLabel() }}</span>
          </button>
          @if (section() === 'chat' && auth.isAdmin()) {
            <a mat-menu-item routerLink="/admin" data-testid="admin-link">Admin</a>
          }
          @if (section() === 'admin') {
            <a mat-menu-item routerLink="/chat" data-testid="back-to-chat">Chat</a>
          }
          <button mat-menu-item type="button" data-testid="logout" (click)="auth.logout()">Log out</button>
        </mat-menu>
        <app-theme-toggle #themeToggle [menuOnly]="true" />
      }
    </header>
    <div class="content"><ng-content /></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .bar {
      --mat-button-text-label-text-color: #fff;
      --mat-button-text-state-layer-color: #fff;
      --mat-icon-button-icon-color: #fff;
      --mat-icon-button-state-layer-color: #fff;
      --app-focus: #fff;
      display: flex; align-items: center; gap: 8px; min-height: var(--app-topbar-h); padding: 0 20px; box-sizing: border-box;
      background: var(--app-gradient-brand); color: var(--app-on-brand); box-shadow: var(--app-shadow-2);
      position: relative; z-index: 2;
    }
    .bar :is(a, button):focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    .logo-tile { display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: var(--app-radius-s);
      background: rgb(255 255 255 / .14); border: 1px solid rgb(255 255 255 / .28); color: #fff; }
    .brand { font: var(--app-type-brand); letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .crumb, .crumb-name { color: var(--app-on-brand-muted); font: var(--mat-sys-title-medium); }
    .spacer { flex: 1; }
    .who { font: var(--mat-sys-body-medium); color: var(--app-on-brand-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 30vw; }
    .role { font: var(--mat-sys-label-medium); font-weight: 600; padding: 2px 10px; border-radius: var(--app-radius-pill);
      background: rgb(255 255 255 / .16); color: #fff; }
    .content { flex: 1; min-height: 0; overflow: auto; }
    .skip { position: absolute; left: 8px; top: -48px; z-index: 1000; padding: 8px 16px; border-radius: var(--app-radius-pill);
      background: #fff; color: #4f46e5; text-decoration: none; font-weight: 500; }
    .skip:focus { top: 8px; }
    @media (max-width: 599.98px) { .bar { padding: 0 8px; } .brand { font: var(--mat-sys-title-medium); } .crumb, .crumb-name { display: none; } }
  `,
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly layout = inject(LayoutService);
  readonly section = input<'chat' | 'admin'>('chat');
  readonly showMenu = input(false);
  readonly skipLabel = input('Skip to main content');
  /** CSS selector of the element the skip link focuses. */
  readonly skipTarget = input('#main');
  readonly menu = output<void>();

  skip(event: Event): void {
    event.preventDefault();
    document.querySelector<HTMLElement>(this.skipTarget())?.focus();
  }
}
