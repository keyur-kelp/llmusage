import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-composer',
  imports: [FormsModule, TextFieldModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="row dock">
      <mat-form-field appearance="outline" class="grow" subscriptSizing="dynamic">
        <mat-label>Message</mat-label>
        <textarea
          matInput
          cdkTextareaAutosize
          cdkAutosizeMinRows="1"
          cdkAutosizeMaxRows="6"
          data-testid="composer-input"
          #input
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
          maxlength="20000"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <mat-hint>Enter to send &middot; Shift+Enter for a new line</mat-hint>
      </mat-form-field>
      <span class="send" [matTooltip]="blockedUntil() ? 'Blocked until ' + blockedUntil() : ''">
        <button
          mat-flat-button
          type="button"
          data-testid="send-button"
          aria-label="Send"
          [disabled]="busy() || !text().trim()"
          (click)="submit()"
        >
          @if (busy()) { <mat-spinner diameter="20" aria-hidden="true" /> } @else { <mat-icon class="app-icon-m">send</mat-icon> }
          <span class="label">{{ busy() ? 'Sending' : 'Send' }}</span>
        </button>
      </span>
    </div>
  `,
  styles: `
    .dock { background: var(--app-surface-raised); border: 1px solid var(--app-border); border-radius: var(--app-radius-xl);
      box-shadow: var(--app-shadow-2); padding: 8px 8px 4px 16px; margin-bottom: 12px; }
    .row { display: flex; gap: 12px; align-items: flex-start; }
    .grow { flex: 1; min-width: 0; --mat-form-field-outlined-outline-color: transparent; --mat-form-field-outlined-hover-outline-color: transparent; }
    .send { margin-top: 4px; }
    .send button { --mat-button-filled-container-shape: var(--app-radius-m); --mat-progress-spinner-active-indicator-color: var(--mat-sys-on-primary); }
    @media (max-width: 599.98px) { .label { display: none; } .send button { min-width: 48px; padding: 0 12px; } }
  `,
})
export class ComposerComponent {
  /** True while a reply is streaming: only submitting is blocked, the textarea stays enabled so focus is never lost. */
  readonly busy = input(false);
  /** Set while the user is quota-blocked; shown as the Send tooltip. */
  readonly blockedUntil = input('');
  /** Parent returns true when the message was accepted; the box is cleared only then. */
  readonly send = input.required<(text: string) => Promise<boolean>>();
  readonly sent = output<void>();
  readonly text = signal('');
  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');

  /** Puts a starter prompt in the box and focuses it. Never sends. */
  fill(value: string): void {
    this.text.set(value);
    const el = this.input()?.nativeElement;
    el?.focus();
    setTimeout(() => el?.setSelectionRange(value.length, value.length));
  }

  /** Moves focus to the message box. */
  focus(): void {
    this.input()?.nativeElement.focus();
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey || e.isComposing) return;
    e.preventDefault();
    void this.submit();
  }

  async submit(): Promise<void> {
    const value = this.text();
    if (this.busy() || !value.trim()) return;
    const ok = await this.send()(value);
    if (ok) {
      this.text.set('');
      this.sent.emit();
    }
  }
}
