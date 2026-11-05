import { TestBed } from '@angular/core/testing';
import { QuotaPanelComponent } from './quota-panel.component';
import { QuotaStatus } from '../../core/api/models';

const status: QuotaStatus = {
  user: {
    quotaUsd: '10.000000',
    usedUsd: '1.234567',
    remainingUsd: '8.765433',
    remainingPct: '87.65',
    periodStart: '2026-10-30T18:30:00.000Z',
    resetsAt: '2026-11-06T18:30:00.000Z',
    resetsAtIst: '2026-11-07T00:00:00.000+05:30',
    isOverride: false,
  },
  system: {
    quotaUsd: '100.000000',
    usedUsd: '1.234567',
    remainingUsd: '98.765433',
    remainingPct: '98.77',
    periodStart: '2026-10-31T18:30:00.000Z',
    resetsAt: '2026-11-30T18:30:00.000Z',
    resetsAtIst: '2026-12-01T00:00:00.000+05:30',
  },
};

describe('QuotaPanelComponent', () => {
  it('shows remaining USD and % for the user and the system, with IST reset times', () => {
    const fixture = TestBed.createComponent(QuotaPanelComponent);
    fixture.componentRef.setInput('quota', status);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = (id: string): string => el.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(text('quota-user-remaining')).toBe('$8.765433 left');
    expect(text('quota-system-remaining')).toBe('$98.765433 left');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('87.65% left');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('98.77% left');
    expect(text('quota-user-reset')).toBe('Resets 07 Nov 2026, 00:00 IST');
    expect(text('quota-system-reset')).toBe('Resets 01 Dec 2026, 00:00 IST');
  });

  it('renders nothing until quota is loaded', () => {
    const fixture = TestBed.createComponent(QuotaPanelComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="quota-user-remaining"]')).toBeNull();
  });

  it('names the progress bars and gives them a value text', () => {
    const fixture = TestBed.createComponent(QuotaPanelComponent);
    fixture.componentRef.setInput('quota', status);
    fixture.detectChanges();
    const bars = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('mat-progress-bar'));
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual(['Weekly quota remaining', 'System quota remaining']);
    expect(bars[0]?.getAttribute('aria-valuetext')).toBe('$8.765433 left of $10.000000');
  });

  it('shows Low under 20% and Used up at 0% with text', () => {
    const fixture = TestBed.createComponent(QuotaPanelComponent);
    fixture.componentRef.setInput('quota', {
      ...status,
      user: { ...status.user, remainingUsd: '1.000000', remainingPct: '10.00' },
      system: { ...status.system, remainingUsd: '0.000000', remainingPct: '0.00' },
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Low');
    expect(text).toContain('Used up');
  });

  it('shows loading and error states before data arrives', () => {
    const fixture = TestBed.createComponent(QuotaPanelComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading quota');
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('error', 'boom');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain("Couldn't load quota");
  });

  it('renders the compact strip with the remaining amounts and expands on tap', () => {
    const fixture = TestBed.createComponent(QuotaPanelComponent);
    fixture.componentRef.setInput('quota', status);
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="quota-user-remaining"]')?.textContent).toContain('$8.765433 left');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('· 87.65%');
    expect(el.querySelector('mat-progress-bar')).toBeNull();
    el.querySelector<HTMLButtonElement>('.strip-toggle')?.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('mat-progress-bar').length).toBe(2);
  });
});
