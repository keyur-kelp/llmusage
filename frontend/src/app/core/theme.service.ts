import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_KEY = 'llmuc.theme';
const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

/**
 * Light / Dark / System switch (docs/ux/ui-design.md 8.2). The mode is one class on <html>;
 * CSS flips color-scheme. Storage may throw (private mode), so every access is guarded.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly mode = signal<ThemeMode>(this.read());

  private readonly osDark = signal(false);
  /** The scheme actually shown: System resolves through prefers-color-scheme (CSS follows it live on its own). */
  readonly resolved = computed<'light' | 'dark'>(() => {
    const m = this.mode();
    return m === 'system' ? (this.osDark() ? 'dark' : 'light') : m;
  });

  constructor() {
    this.apply(this.mode(), false);
    try {
      const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
      if (mq) {
        this.osDark.set(mq.matches);
        mq.addEventListener?.('change', (e) => this.osDark.set(e.matches));
      }
    } catch {
      /* ignore */
    }
  }

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    this.apply(mode, true);
    try {
      localStorage.setItem(THEME_KEY, mode);
    } catch {
      /* ignore: the switch still works for this session */
    }
  }

  private read(): ThemeMode {
    try {
      const v = localStorage.getItem(THEME_KEY);
      return MODES.find((m) => m === v) ?? 'light';
    } catch {
      return 'light';
    }
  }

  private apply(mode: ThemeMode, fade: boolean): void {
    const root = this.doc.documentElement;
    for (const m of MODES) root.classList.toggle('theme-' + m, m === mode);
    this.doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#312e81' : '#0f1729');
    if (fade && !this.reducedMotion()) {
      root.classList.add('theme-switching');
      setTimeout(() => root.classList.remove('theme-switching'), 200);
    }
  }

  private reducedMotion(): boolean {
    try {
      return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }
}
