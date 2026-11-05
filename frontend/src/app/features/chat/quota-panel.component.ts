import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { QuotaPart, QuotaStatus } from '../../core/api/models';
import { QuotaState, formatPct, formatUsd, pctToBar, quotaState } from '../../core/format';
import { IstDatePipe } from '../../core/ist-date.pipe';

interface MeterView {
  key: 'user' | 'system';
  title: string;
  short: string;
  barLabel: string;
  part: QuotaPart;
  override: boolean;
  state: QuotaState;
}

/** Personal and system quota meters. `compact` renders the mobile strip (tap to expand the bars). */
@Component({
  selector: 'app-quota-panel',
  imports: [NgTemplateOutlet, MatButtonModule, MatIconModule, MatProgressBarModule, IstDatePipe],
  template: `
    <ng-template #chip let-state>
      @if (state === 'low') { <span class="app-chip warn"><mat-icon aria-hidden="true">warning</mat-icon>Low</span> }
      @else if (state === 'used-up') { <span class="app-chip danger"><mat-icon aria-hidden="true">block</mat-icon>Used up</span> }
      @else { <span class="app-chip good"><mat-icon aria-hidden="true">check_circle</mat-icon>On track</span> }
    </ng-template>
    <ng-template #bar let-m>
      <mat-progress-bar
        mode="determinate"
        [class]="'app-meter bar ' + m.state"
        [value]="barValue(m.part.remainingPct)"
        [attr.aria-label]="m.barLabel"
        [attr.aria-valuetext]="usd(m.part.remainingUsd) + ' left of ' + usd(m.part.quotaUsd)"
      />
    </ng-template>

    @if (quota()) {
      @if (!compact()) {
        @for (m of meters(); track m.key) {
          <section class="app-card card" [class.low]="m.state === 'low'" [class.danger]="m.state === 'used-up'" [attr.aria-labelledby]="'qt-' + m.key">
            <div class="head">
              <span class="app-icon-tile"><mat-icon aria-hidden="true">{{ m.key === 'user' ? 'person' : 'groups' }}</mat-icon></span>
              <h2 class="title" [id]="'qt-' + m.key">{{ m.title }}</h2>
              <span class="chip-slot"><ng-container *ngTemplateOutlet="chip; context: { $implicit: m.state }" /></span>
            </div>
            <div class="big app-num" [attr.data-testid]="'quota-' + m.key + '-remaining'">{{ usd(m.part.remainingUsd) }} <span class="unit">left</span></div>
            <ng-container *ngTemplateOutlet="bar; context: { $implicit: m }" />
            <div class="meta-row app-num">
              <span class="pct">{{ pct(m.part.remainingPct) }} left</span>
              <span class="meta">of {{ usd(m.part.quotaUsd) }}@if (m.override) { (personal limit) }</span>
            </div>
            <div class="meta reset"><mat-icon class="app-icon-s" aria-hidden="true">schedule</mat-icon><span [attr.data-testid]="'quota-' + m.key + '-reset'">Resets {{ m.part.resetsAt | istDate }}</span></div>
          </section>
        }
      } @else {
        <section class="strip" aria-label="Quota">
          <button type="button" class="strip-toggle" [attr.aria-expanded]="open()" (click)="open.set(!open())">
            <span class="rows">
              @for (m of meters(); track m.key) {
                <span class="row">
                  <span class="pill" [class.low]="m.state === 'low'" [class.danger]="m.state === 'used-up'" aria-hidden="true"></span>
                  <strong>{{ m.short }}</strong>
                  <span class="app-num" [attr.data-testid]="'quota-' + m.key + '-remaining'">{{ usd(m.part.remainingUsd) }} left</span>
                  <span class="app-num app-muted">&middot; {{ pct(m.part.remainingPct) }}</span>
                  <ng-container *ngTemplateOutlet="chip; context: { $implicit: m.state }" />
                </span>
              }
            </span>
            <mat-icon class="app-icon-l">{{ open() ? 'expand_less' : 'expand_more' }}</mat-icon>
          </button>
          @if (open()) {
            @for (m of meters(); track m.key) {
              <div class="detail">
                <h2 class="title">{{ m.title }}</h2>
                <ng-container *ngTemplateOutlet="bar; context: { $implicit: m }" />
                <div class="meta app-num">of {{ usd(m.part.quotaUsd) }}@if (m.override) { (personal limit) }</div>
                <div class="meta" [attr.data-testid]="'quota-' + m.key + '-reset'">Resets {{ m.part.resetsAt | istDate }}</div>
              </div>
            }
          }
        </section>
      }
    } @else if (error()) {
      <div class="app-card card" role="alert">
        <div class="head">
          <span class="app-icon-tile err"><mat-icon aria-hidden="true">error</mat-icon></span>
          <p class="meta">Couldn't load quota.</p>
        </div>
        <button mat-button type="button" (click)="retry.emit()">Retry</button>
      </div>
    } @else if (loading()) {
      <div class="app-card card" aria-busy="true">
        <span class="skel" aria-hidden="true"></span><span class="skel short" aria-hidden="true"></span>
        <p class="meta">Loading quota&hellip;</p>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .card { padding: 20px; margin-bottom: 12px; }
    .card.low { border-color: var(--app-warn-border); box-shadow: inset 3px 0 0 var(--app-warn), var(--app-shadow-1); }
    .card.danger { border-color: var(--app-danger-border); box-shadow: inset 3px 0 0 var(--app-danger), var(--app-shadow-1); }
    .head { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; }
    .chip-slot { margin-inline-start: auto; }
    .title { font: var(--app-type-title); margin: 0; flex: 1 1 0; min-width: 120px; }
    .big { font: var(--app-type-number-xl); margin: 12px 0 8px; }
    .unit { font: 500 15px/22px var(--app-font-plain); color: var(--mat-sys-on-surface-variant); }
    .meta { font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); margin: 6px 0 0; }
    .meta-row { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: 8px; font: var(--mat-sys-body-medium); }
    .meta-row .pct { font-weight: 600; color: var(--mat-sys-on-surface); }
    .meta-row .meta { margin: 0; }
    .reset { display: flex; align-items: center; gap: 6px; }
    .reset span { white-space: nowrap; }
    .bar { margin-top: 8px; }
    .err { background: var(--app-danger-container); color: var(--app-on-danger-container); }
    .skel { display: block; height: 12px; border-radius: var(--app-radius-s); background: var(--app-track); margin-bottom: 10px; }
    .skel.short { width: 60%; }
    @media (prefers-reduced-motion: no-preference) {
      .skel { animation: shimmer 1.4s ease-in-out infinite alternate; }
      @keyframes shimmer { from { opacity: .6; } to { opacity: 1; } }
    }
    .strip { padding: 8px 12px; background: var(--mat-sys-surface-container-low); border-bottom: 1px solid var(--app-border); }
    .strip-toggle { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; padding: 0;
      background: none; border: 0; font: var(--mat-sys-body-medium); color: inherit; text-align: start; cursor: pointer; }
    .strip-toggle:focus-visible { outline: 2px solid var(--app-focus); outline-offset: 2px; border-radius: var(--app-radius-s); }
    .rows { display: flex; flex-direction: column; gap: 2px; }
    .row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .row strong { font: var(--mat-sys-label-medium); font-weight: 600; }
    .pill { width: 6px; height: 28px; border-radius: var(--app-radius-pill); background: var(--app-ok); flex: none; }
    .pill.low { background: var(--app-warn); }
    .pill.danger { background: var(--app-danger); }
    .detail { padding: 8px 0 4px; }
  `,
})
export class QuotaPanelComponent {
  readonly quota = input<QuotaStatus | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly compact = input(false);
  readonly retry = output<void>();
  readonly open = signal(false);

  readonly usd = formatUsd;
  readonly pct = formatPct;
  readonly barValue = pctToBar;

  readonly meters = computed<MeterView[]>(() => {
    const q = this.quota();
    if (!q) return [];
    return [
      { key: 'user', title: 'Your weekly quota', short: 'You', barLabel: 'Weekly quota remaining', part: q.user, override: q.user.isOverride, state: quotaState(q.user.remainingPct) },
      { key: 'system', title: 'System monthly quota', short: 'Sys', barLabel: 'System quota remaining', part: q.system, override: false, state: quotaState(q.system.remainingPct) },
    ];
  });
}
