import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  body: string;
  confirmLabel: string;
  /** Destructive actions use the error colour. */
  destructive?: boolean;
  /** Material icon name shown in a danger tile above the title (destructive dialogs only). */
  icon?: string;
}

/** Closes with `true` on confirm and `false`/undefined otherwise. Cancel has the initial focus. */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    @if (data.destructive && data.icon) {
      <span class="tile"><mat-icon class="app-icon-m" aria-hidden="true">{{ data.icon }}</mat-icon></span>
    }
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.body }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" cdkFocusInitial [mat-dialog-close]="false" data-testid="confirm-cancel">Cancel</button>
      <button mat-flat-button type="button" [class.danger]="data.destructive" [mat-dialog-close]="true" data-testid="confirm-ok">
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .tile { display: grid; place-items: center; width: 40px; height: 40px; margin: 24px 24px 0; border-radius: 50%; background: var(--app-danger-container); color: var(--app-danger); }
    .tile + h2 { padding-top: 12px; }
    .danger { --mat-button-filled-container-color: var(--mat-sys-error); --mat-button-filled-label-text-color: var(--mat-sys-on-error); }
  `,
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}
