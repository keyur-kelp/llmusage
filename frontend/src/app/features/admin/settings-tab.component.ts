import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminApi, describeError } from '../../core/api/admin-api';
import { Settings } from '../../core/api/models';

export const MONEY_PATTERN = /^\d{1,8}(\.\d{1,6})?$/;

export const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

@Component({
  selector: 'app-settings-tab',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()" class="form">
      <div class="groups">
        <fieldset class="app-card group" aria-labelledby="g-quotas">
          <div class="ghead"><span class="app-icon-tile"><mat-icon aria-hidden="true">savings</mat-icon></span><h2 class="gtitle" id="g-quotas">Quotas</h2></div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>System monthly quota (USD)</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="text" inputmode="decimal" formControlName="systemQuotaUsd" data-testid="setting-system-quota" />
            <mat-hint>Non-negative, up to 6 decimal places</mat-hint>
            @if (form.controls.systemQuotaUsd.invalid) {
              <mat-error>Enter a non-negative amount, e.g. 100 or 0.000001</mat-error>
            }
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Default user weekly quota (USD)</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="text" inputmode="decimal" formControlName="defaultUserQuotaUsd" data-testid="setting-default-user-quota" />
            <mat-hint>Non-negative, up to 6 decimal places</mat-hint>
            @if (form.controls.defaultUserQuotaUsd.invalid) {
              <mat-error>Enter a non-negative amount, e.g. 10 or 0.000001</mat-error>
            }
          </mat-form-field>
        </fieldset>

        <fieldset class="app-card group" aria-labelledby="g-reset">
          <div class="ghead"><span class="app-icon-tile"><mat-icon aria-hidden="true">event_repeat</mat-icon></span><h2 class="gtitle" id="g-reset">Reset schedule (00:00 IST)</h2></div>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>User quota resets on (weekday, 00:00 IST)</mat-label>
            <mat-select formControlName="userResetDow" data-testid="setting-user-reset-dow">
              @for (d of weekdays; track d.value) {
                <mat-option [value]="d.value">{{ d.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>System quota resets on (day of month, 00:00 IST)</mat-label>
            <mat-select formControlName="systemResetDom" data-testid="setting-system-reset-dom">
              @for (d of days; track d) {
                <mat-option [value]="d">{{ d }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </fieldset>
      </div>

      @if (error()) {
        <div class="error" role="alert" data-testid="settings-error">{{ error() }}</div>
      }
      @if (saved()) {
        <div class="ok" role="status" data-testid="settings-saved">Settings saved. They apply to the next message.</div>
      }
      <div class="actions">
        <span class="app-muted">Changes apply to the next message.</span>
        <button mat-button type="button" data-testid="settings-discard" [disabled]="busy() || form.pristine" (click)="discard()">Discard</button>
        <button mat-flat-button type="submit" data-testid="settings-save" [disabled]="form.invalid || busy()">Save changes</button>
      </div>
    </form>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: 16px; padding: 16px 0; }
    .groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 560px)); gap: 16px; }
    .group { display: flex; flex-direction: column; gap: 16px; margin: 0; min-width: 0; padding: 24px; }
    .ghead { display: flex; align-items: center; gap: 10px; }
    .gtitle { font: var(--app-type-title); margin: 0; }
    .error { color: var(--mat-sys-error); }
    .ok { color: var(--mat-sys-primary); }
    .actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; padding-top: 16px;
      border-top: 1px solid var(--app-border); }
    .actions .app-muted { margin-inline-end: auto; font: var(--mat-sys-body-medium); }
  `,
})
export class SettingsTabComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);

  readonly weekdays = WEEKDAYS;
  readonly days = Array.from({ length: 28 }, (_, i) => i + 1);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  private loaded: Settings | null = null;

  readonly form = this.fb.nonNullable.group({
    systemQuotaUsd: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    defaultUserQuotaUsd: ['', [Validators.required, Validators.pattern(MONEY_PATTERN)]],
    userResetDow: [6, [Validators.required, Validators.min(1), Validators.max(7)]],
    systemResetDom: [1, [Validators.required, Validators.min(1), Validators.max(28)]],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.loaded = await this.api.getSettings();
      this.form.patchValue(this.loaded);
    } catch (err) {
      this.error.set(describeError(err));
    }
  }

  discard(): void {
    if (this.loaded) this.form.reset(this.loaded);
    this.error.set(null);
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    this.saved.set(false);
    try {
      const saved = await this.api.putSettings(this.form.getRawValue());
      this.loaded = saved;
      this.form.patchValue(saved);
      this.form.markAsPristine();
      this.saved.set(true);
      this.snack.open('Settings saved. They apply to the next message.', undefined, { duration: 4000 });
    } catch (err) {
      this.error.set(describeError(err));
    } finally {
      this.busy.set(false);
    }
  }
}
