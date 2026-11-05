import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatMenuTrigger } from '@angular/material/menu';
import { By } from '@angular/platform-browser';
import { AuthService } from '../core/auth/auth.service';
import { LayoutService } from '../core/layout.service';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent mobile menu', () => {
  it('shows a Theme item (with a submenu popup) in the open more-actions menu', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ name: 'Ann' }), isAdmin: () => false, logout: () => undefined } },
        { provide: LayoutService, useValue: { mobile: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();

    const more = fixture.debugElement
      .queryAll(By.directive(MatMenuTrigger))
      .find((d) => d.nativeElement.getAttribute('aria-label') === 'More actions');
    expect(more).toBeDefined();
    more?.injector.get(MatMenuTrigger).openMenu();
    fixture.detectChanges();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const themeItem = overlay.querySelector<HTMLElement>('[data-testid="theme-toggle"]');
    expect(themeItem).not.toBeNull();
    expect(themeItem?.textContent).toContain('Theme: Light');
    expect(themeItem?.getAttribute('aria-haspopup')).toBe('menu');
    more?.injector.get(MatMenuTrigger).closeMenu();
  });
});
