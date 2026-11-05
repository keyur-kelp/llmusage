import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { describeError } from '../../core/api/admin-api';
import { ApiError } from '../../core/api/api-error';
import { Role, UserDto } from '../../core/api/models';

export interface UserDialogData {
  /** Present when editing. */
  user?: UserDto;
  /** True when the row is the signed-in admin: role is locked in the UI (the server enforces it too). */
  isSelf?: boolean;
  /**
   * Performs the save. Resolve (or return true) to close the dialog; return false to keep it open
   * without an error (the caller declined); throw to show the error inline and keep what was typed.
   */
  save?: (result: UserDialogResult) => Promise<boolean | void>;
}

export interface UserDialogResult {
  name: string;
  email: string;
  password: string;
  role: Role;
  /** Edit only. Empty string means "clear the override". */
  quotaOverrideUsd: string;
}

@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>{{ data.user ? 'Edit user' : 'Create user' }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" data-testid="user-name" />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" data-testid="user-email" #emailInput />
          @if (form.controls.email.hasError('server')) {
            <mat-error>{{ emailError() }}</mat-error>
          }
        </mat-form-field>
        @if (!data.user) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Password (min 8 characters)</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" data-testid="user-password" />
          </mat-form-field>
        }
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role" data-testid="user-role">
            <mat-option value="USER">User</mat-option>
            <mat-option value="ADMIN">Admin</mat-option>
          </mat-select>
          @if (data.isSelf) { <mat-hint>You can't deactivate yourself or remove your own admin role. Ask another admin.</mat-hint> }
        </mat-form-field>
        @if (data.user) {
          <mat-form-field appearance="outline" subscriptSizing="dynamic" floatLabel="always">
            <mat-label>Weekly quota override (USD)</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput formControlName="quotaOverrideUsd" inputmode="decimal" data-testid="user-override" />
            <mat-hint>Empty = default quota. Up to 6 decimals</mat-hint>
            @if (form.controls.quotaOverrideUsd.invalid) {
              <mat-error>Enter a non-negative amount or leave empty</mat-error>
            }
          </mat-form-field>
        }
        @if (formError()) {
          <div class="form-error" role="alert" data-testid="user-form-error">{{ formError() }}</div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" data-testid="user-cancel" [disabled]="busy()" (click)="ref.close()">Cancel</button>
        <button mat-flat-button type="submit" data-testid="user-save" [disabled]="form.invalid || busy()">
          @if (busy()) { <mat-spinner diameter="18" aria-hidden="true" /> }
          Save
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content { display: flex; flex-direction: column; gap: 8px; min-width: 360px; padding-top: 8px; }
    .form-error { color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
    button mat-spinner { display: inline-block; margin-inline-end: 8px; }
    @media (max-width: 599.98px) { .content { min-width: 0; } }
  `,
})
export class UserDialogComponent {
  protected readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<UserDialogComponent, UserDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: [this.data.user?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    email: [{ value: this.data.user?.email ?? '', disabled: !!this.data.user }, [Validators.required, Validators.email]],
    password: ['', this.data.user ? [] : [Validators.required, Validators.minLength(8)]],
    role: [{ value: (this.data.user?.role ?? 'USER') as Role, disabled: !!this.data.isSelf }],
    quotaOverrideUsd: [this.data.user?.quotaOverrideUsd ?? '', [Validators.pattern(/^(\d{1,8}(\.\d{1,6})?)?$/)]],
  });

  protected readonly busy = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly emailError = signal('');
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) return;
    const result = this.form.getRawValue();
    this.formError.set(null);
    if (!this.data.save) {
      this.ref.close(result);
      return;
    }
    this.busy.set(true);
    this.ref.disableClose = true; // Esc/backdrop must not close while the request is in flight
    try {
      const keepOpen = (await this.data.save(result)) === false;
      if (!keepOpen) this.ref.close(result);
    } catch (err) {
      this.showError(err);
    } finally {
      this.busy.set(false);
      this.ref.disableClose = false;
    }
  }

  private showError(err: unknown): void {
    const e = ApiError.fromHttp(err);
    if (e.status === 409 && !this.data.user) {
      const msg = e.message || 'A user with this email already exists';
      this.emailError.set(msg);
      const email = this.form.controls.email;
      email.setErrors({ ...(email.errors ?? {}), server: true });
      email.markAsTouched();
      this.emailInput()?.nativeElement.focus();
      return;
    }
    this.formError.set(describeError(err));
  }
}
