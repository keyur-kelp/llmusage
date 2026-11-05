import { TestBed } from '@angular/core/testing';
import { THEME_KEY, ThemeService } from './theme.service';

function cls(): string[] {
  return Array.from(document.documentElement.classList).filter((c) => c.startsWith('theme-') && c !== 'theme-switching');
}

describe('ThemeService', () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    document.documentElement.className = '';
    spyOn(localStorage, 'getItem').and.callFake((k: string) => store[k] ?? null);
    spyOn(localStorage, 'setItem').and.callFake((k: string, v: string) => {
      store[k] = v;
    });
  });

  function create(): ThemeService {
    TestBed.resetTestingModule();
    return TestBed.inject(ThemeService);
  }

  it('defaults to light and sets only theme-light', () => {
    const t = create();
    expect(t.mode()).toBe('light');
    expect(cls()).toEqual(['theme-light']);
  });

  it('ignores an invalid stored value', () => {
    store[THEME_KEY] = 'purple';
    expect(create().mode()).toBe('light');
  });

  it('persists the choice and swaps the class', () => {
    const t = create();
    t.set('dark');
    expect(store[THEME_KEY]).toBe('dark');
    expect(cls()).toEqual(['theme-dark']);
    t.set('system');
    expect(store[THEME_KEY]).toBe('system');
    expect(cls()).toEqual(['theme-system']);
  });

  it('restores a stored mode on start', () => {
    store[THEME_KEY] = 'dark';
    const t = create();
    expect(t.mode()).toBe('dark');
    expect(cls()).toEqual(['theme-dark']);
  });

  it('system resolves through prefers-color-scheme', () => {
    const listeners: ((e: { matches: boolean }) => void)[] = [];
    spyOn(window, 'matchMedia').and.callFake(
      (q: string) =>
        ({
          matches: q.includes('prefers-color-scheme') ,
          addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.push(fn),
        }) as unknown as MediaQueryList,
    );
    const t = create();
    t.set('system');
    expect(t.resolved()).toBe('dark');
    listeners.forEach((fn) => fn({ matches: false }));
    expect(t.resolved()).toBe('light');
    t.set('light');
    expect(t.resolved()).toBe('light');
  });

  it('still switches for the session when storage throws', () => {
    (localStorage.getItem as jasmine.Spy).and.throwError('blocked');
    (localStorage.setItem as jasmine.Spy).and.throwError('blocked');
    const t = create();
    expect(t.mode()).toBe('light');
    expect(() => t.set('dark')).not.toThrow();
    expect(t.mode()).toBe('dark');
    expect(cls()).toEqual(['theme-dark']);
  });
});
