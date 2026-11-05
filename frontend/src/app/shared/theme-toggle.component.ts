import { Component, computed, inject, input, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenu, MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ThemeMode, ThemeService } from '../core/theme.service';

const ICONS: Record<ThemeMode, string> = { light: 'light_mode', dark: 'dark_mode', system: 'brightness_auto' };
const LABELS: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', system: 'System' };

/**
 * Theme switch (docs/ux/ui-design.md 8.2). Renders an icon button plus the theme menu. With `menuOnly` it renders
 * just the menu, exposed as `menu`, so the shell can open it from a real `mat-menu-item` in its overflow menu
 * (the item must live in the shell's template to register with that menu's key manager).
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  template: `
    @if (!menuOnly()) {
      <button
        mat-icon-button
        type="button"
        class="trigger"
        data-testid="theme-toggle"
        matTooltip="Change theme"
        [attr.aria-label]="'Theme: ' + label(theme.mode())"
        [matMenuTriggerFor]="themeMenu"
      >
        <mat-icon aria-hidden="true">{{ icon(theme.mode()) }}</mat-icon>
      </button>
    }
    <mat-menu #themeMenu="matMenu" xPosition="before" aria-label="Theme">
      @for (m of modes; track m) {
        <button
          mat-menu-item
          type="button"
          role="menuitemradio"
          class="item"
          [class.selected]="theme.mode() === m"
          [attr.data-testid]="'theme-' + m"
          [attr.aria-checked]="theme.mode() === m"
          (click)="theme.set(m)"
        >
          <mat-icon aria-hidden="true">{{ icon(m) }}</mat-icon>
          <span class="text">
            <span class="name">{{ label(m) }}</span>
            @if (m === 'system') { <span class="sub">Match your device</span> }
          </span>
          @if (theme.mode() === m) { <mat-icon class="check" aria-hidden="true">check</mat-icon> }
        </button>
      }
    </mat-menu>
  `,
  styles: `
    :host { display: inline-flex; }
    .text { display: inline-flex; flex-direction: column; line-height: 1.2; }
    .sub { font: var(--mat-sys-label-medium); color: var(--mat-sys-on-surface-variant); }
    .selected .name { font-weight: 600; }
    .check { color: var(--mat-sys-primary); margin-inline: 12px 0 !important; }
  `,
})
export class ThemeToggleComponent {
  protected readonly theme = inject(ThemeService);
  readonly menuOnly = input(false);
  readonly menu = viewChild.required<MatMenu>('themeMenu');
  readonly modeLabel = computed(() => LABELS[this.theme.mode()]);
  protected readonly modes: ThemeMode[] = ['light', 'dark', 'system'];
  protected icon(m: ThemeMode): string {
    return ICONS[m];
  }
  protected label(m: ThemeMode): string {
    return LABELS[m];
  }
}
