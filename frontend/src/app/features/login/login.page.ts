import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/api/api-error';
import { AppLogoComponent } from '../../shared/app-logo.component';
import { ThemeToggleComponent } from '../../shared/theme-toggle.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, AppLogoComponent, ThemeToggleComponent],
  template: `
    <div class="page">
      <section class="panel">
        <div class="panel-brand">
          <span class="logo-tile"><app-logo [size]="24" /></span>
          <h1 class="wordmark">LLM Usage Control</h1>
        </div>
        <div class="panel-mid">
          <p class="headline">Chat with Claude, within budget.</p>
          <ul class="points">
            <li><mat-icon class="app-icon-m" aria-hidden="true">check_circle</mat-icon>Your weekly quota, live</li>
            <li><mat-icon class="app-icon-m" aria-hidden="true">check_circle</mat-icon>A team-wide monthly cap</li>
            <li><mat-icon class="app-icon-m" aria-hidden="true">check_circle</mat-icon>Cost per message, to 6 decimals</li>
          </ul>
        </div>
        <p class="tz">All times are shown in IST</p>
      </section>
      <main class="form-col" id="main">
        <div class="theme"><app-theme-toggle /></div>
        <div class="app-card card">
          <h2 class="title">Sign in</h2>
          <p class="sub">Use the account your admin created for you.</p>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" data-testid="login-email" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" data-testid="login-password" />
              <button mat-icon-button matSuffix type="button" [attr.aria-label]="show() ? 'Hide password' : 'Show password'" [attr.aria-pressed]="show()" (click)="show.set(!show())">
                <mat-icon aria-hidden="true">{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>
            @if (error()) {
              <div class="error" role="alert" data-testid="login-error"><mat-icon class="app-icon-m" aria-hidden="true">error</mat-icon><span>{{ error() }}</span></div>
            }
            <button mat-flat-button type="submit" class="submit" data-testid="login-submit" [disabled]="form.invalid || busy()">
              @if (busy()) { <mat-spinner diameter="20" aria-label="Signing in" /> Signing in&hellip; } @else { Sign in }
            </button>
          </form>
        </div>
      </main>
    </div>
  `,
  styles: `
    :host { display: block; min-height: 100%; }
    .page { display: grid; grid-template-columns: 1fr; min-height: 100vh; }
    .panel { display: flex; flex-direction: column; gap: 16px; padding: 24px; color: #fff;
      background: radial-gradient(circle at 20% 110%, rgb(255 255 255 / .10), transparent 40%), radial-gradient(circle at 110% 10%, rgb(94 234 212 / .18), transparent 35%), var(--app-gradient-brand); }
    .panel-brand { display: flex; align-items: center; gap: 12px; }
    .logo-tile { display: inline-grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: var(--app-radius-s);
      background: rgb(255 255 255 / .14); border: 1px solid rgb(255 255 255 / .28); color: #fff; }
    .wordmark { font: var(--app-type-brand); font-size: 20px; line-height: 28px; margin: 0; }
    .panel-mid { display: flex; flex-direction: column; gap: 24px; }
    .headline { font: var(--app-type-display); font-size: 26px; line-height: 34px; letter-spacing: -.02em; margin: 0; }
    .points { list-style: none; margin: 0; padding: 0; display: none; flex-direction: column; gap: 12px; color: var(--app-on-brand-muted); font: var(--mat-sys-body-large); }
    .points li { display: flex; align-items: center; gap: 10px; }
    .points .mat-icon { color: #5eead4; }
    .tz { display: none; margin: 0; font: var(--mat-sys-body-small); color: var(--app-on-brand-muted); }
    .form-col { position: relative; display: flex; justify-content: center; align-items: center; padding: 16px; box-sizing: border-box; outline: none; }
    .theme { position: absolute; top: 16px; inset-inline-end: 16px; }
    .card { width: 100%; max-width: 400px; padding: 24px; border-radius: var(--app-radius-xl); box-shadow: var(--app-shadow-2); }
    .title { font: var(--app-type-h1); margin: 0; }
    .sub { margin: 4px 0 0; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
    form { display: flex; flex-direction: column; gap: 4px; margin-top: 24px; }
    .error { display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin-bottom: 8px; border-radius: var(--app-radius-s);
      background: var(--app-danger-container); color: var(--app-on-danger-container); font: var(--mat-sys-body-medium); }
    .submit { height: 48px; width: 100%; --mat-button-filled-container-height: 48px; }
    .submit mat-spinner { display: inline-block; margin-inline-end: 8px; }
    @media (max-width: 599.98px) {
      .page { position: relative; grid-template-rows: 96px 1fr; }
      .panel { height: 96px; padding: 0 16px; justify-content: center; box-sizing: border-box; }
      .panel-mid, .tz { display: none; }
      .form-col { position: static; align-items: flex-start; margin-top: -24px; padding: 0 16px 16px; }
      .card { position: relative; z-index: 1; }
      .theme { top: 28px; inset-inline-end: 16px; color: #fff; --mat-icon-button-icon-color: #fff; --mat-icon-button-state-layer-color: #fff; }
    }
    @media (min-width: 600px) { .card { padding: 32px; } .points { display: flex; } .panel { padding: 32px 48px; } }
    @media (min-width: 960px) {
      .page { grid-template-columns: minmax(360px, 44%) 1fr; }
      .panel { padding: 48px; justify-content: space-between; }
      .panel-mid { flex: 1; justify-content: center; }
      .headline { font-size: 32px; line-height: 40px; }
      .tz { display: block; }
    }
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly show = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/chat');
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      this.busy.set(false);
    }
  }
}
