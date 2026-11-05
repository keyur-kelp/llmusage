import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Reset password for {{ data.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content>
        <mat-form-field appearance="outline" class="full">
          <mat-label>New password (min 8 characters)</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" data-testid="reset-password" />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="ref.close()">Cancel</button>
        <button mat-flat-button type="submit" data-testid="reset-password-save" [disabled]="form.invalid">Reset</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `.full { width: 100%; min-width: 340px; padding-top: 8px; }`,
})
export class PasswordDialogComponent {
  protected readonly data = inject<{ name: string }>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<PasswordDialogComponent, string>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.ref.close(this.form.getRawValue().password);
  }
}
