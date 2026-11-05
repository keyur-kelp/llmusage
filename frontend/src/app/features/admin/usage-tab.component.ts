import { Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DATE_LOCALE, MatDateFormats, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { AdminApi, describeError } from '../../core/api/admin-api';
import { DailyUsage, SummaryUser, UsageSummary } from '../../core/api/models';
import { complementPct, compareDecimal, defaultIstRange, formatIsoDay, formatPctCapped, formatPct, formatUsd, pctToBar, quotaState, toIsoDate } from '../../core/format';
import { IstDatePipe } from '../../core/ist-date.pipe';

/** Same dd MMM yyyy look as the tables (en-GB). */
export const APP_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { day: '2-digit', month: 'short', year: 'numeric' },
    monthYearLabel: { month: 'short', year: 'numeric' },
    dateA11yLabel: { day: 'numeric', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
  },
};

export const USAGE_PAGE_SIZES = [25, 50, 100];

type SortKey = 'name' | 'role' | 'usedUsd' | 'quotaUsd' | 'remainingUsd' | 'usedPct';

/** Sorts summary rows; money/percent columns compare as decimal strings (no floats). */
export function sortSummaryUsers(users: SummaryUser[], sort: Sort): SummaryUser[] {
  const dir = sort.direction === 'asc' ? 1 : -1;
  if (!sort.active || !sort.direction) return users;
  const key = sort.active as SortKey;
  return [...users].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const c = key === 'name' || key === 'role' ? av.localeCompare(bv) : compareDecimal(av, bv);
    return c * dir;
  });
}

/** Case-insensitive match on name or email. */
export function filterSummaryUsers(users: SummaryUser[], q: string): SummaryUser[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return users;
  return users.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
}

/** One page of rows (page index is clamped so a shrinking list never shows an empty page). */
export function pageSlice<T>(rows: T[], pageIndex: number, pageSize: number): T[] {
  const last = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const i = Math.min(pageIndex, last);
  return rows.slice(i * pageSize, (i + 1) * pageSize);
}

@Component({
  selector: 'app-usage-tab',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    IstDatePipe,
  ],
  providers: [provideNativeDateAdapter(APP_DATE_FORMATS), { provide: MAT_DATE_LOCALE, useValue: 'en-GB' }],
  template: `
    @if (error()) {
      <div class="error" role="alert">{{ error() }} <button mat-button type="button" (click)="reload()">Retry</button></div>
    }
    @if (loading()) { <mat-progress-bar mode="indeterminate" aria-label="Loading usage" /> }

    @if (summary(); as s) {
      <section class="app-card system" data-testid="system-usage" [class.low]="state() === 'low'" [class.danger]="state() === 'used-up'" aria-labelledby="sys-title">
        <div class="head">
          <span class="app-icon-tile"><mat-icon aria-hidden="true">groups</mat-icon></span>
          <h2 class="title" id="sys-title">System month-to-date</h2>
          <span class="chip-slot">
            @if (state() === 'low') { <span class="app-chip warn"><mat-icon aria-hidden="true">warning</mat-icon>Low</span> }
            @else if (state() === 'used-up') { <span class="app-chip danger"><mat-icon aria-hidden="true">block</mat-icon>Used up</span> }
            @else { <span class="app-chip good"><mat-icon aria-hidden="true">check_circle</mat-icon>On track</span> }
          </span>
        </div>
        <div class="big app-num" data-testid="system-used">{{ usd(s.system.usedUsd) }} used of {{ usd(s.system.quotaUsd) }}</div>
        <mat-progress-bar
          mode="determinate"
          [class]="'app-meter bar ' + state()"
          [value]="bar(usedPct())"
          aria-label="System quota used"
          [attr.aria-valuetext]="usd(s.system.usedUsd) + ' used of ' + usd(s.system.quotaUsd)"
        />
        <div class="meta app-num">{{ pct(usedPct()) }} used &middot; Period {{ s.system.periodStart | istDate }} &ndash; resets {{ s.system.resetsAt | istDate }}</div>
      </section>

      <div class="users-head">
        <h2 class="section">Users (week-to-date)</h2>
        <button mat-button type="button" data-testid="jump-daily" (click)="jumpToDaily()"><mat-icon class="app-icon-m">arrow_downward</mat-icon>Daily breakdown</button>
      </div>
      <mat-form-field appearance="outline" class="filter" subscriptSizing="dynamic">
        <mat-label>Filter by name or email</mat-label>
        <input matInput [ngModel]="filter()" (ngModelChange)="setFilter($event)" data-testid="user-usage-filter" />
      </mat-form-field>
      @if (filteredUsers().length === 0) {
        <div class="app-empty"><span class="app-icon-tile"><mat-icon aria-hidden="true">search_off</mat-icon></span><p class="title">No users match this filter</p></div>
      }
      <div class="app-table-card">
      <div class="app-table-scroll">
      <table mat-table class="app-cards" [dataSource]="pagedUsers()" matSort matSortActive="usedUsd" matSortDirection="desc"
             (matSortChange)="onSort($event)" data-testid="user-usage-table">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>User</th>
          <td mat-cell *matCellDef="let u" data-label="User"><span class="u-cell"><span class="u-name">{{ u.name }}</span> <span class="meta u-email">{{ u.email }}</span></span></td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef mat-sort-header>Role</th>
          <td mat-cell *matCellDef="let u" data-label="Role">{{ u.role }}@if (!u.isActive) { (inactive) }</td>
        </ng-container>
        <ng-container matColumnDef="usedUsd">
          <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="app-num-cell">Used</th>
          <td mat-cell *matCellDef="let u" class="app-num-cell" data-label="Used" data-testid="user-used">{{ usd(u.usedUsd) }}</td>
        </ng-container>
        <ng-container matColumnDef="quotaUsd">
          <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="app-num-cell">Quota</th>
          <td mat-cell *matCellDef="let u" class="app-num-cell" data-label="Quota">{{ usd(u.quotaUsd) }}@if (u.isOverride) { <span class="app-chip">override</span> }</td>
        </ng-container>
        <ng-container matColumnDef="remainingUsd">
          <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="app-num-cell">Remaining</th>
          <td mat-cell *matCellDef="let u" class="app-num-cell" data-label="Remaining">{{ usd(u.remainingUsd) }}</td>
        </ng-container>
        <ng-container matColumnDef="usedPct">
          <th mat-header-cell *matHeaderCellDef mat-sort-header arrowPosition="before" class="app-num-cell">Used %</th>
          <td mat-cell *matCellDef="let u" class="app-num-cell" data-label="Used %"><span [attr.title]="pct(u.usedPct)">{{ pctCapped(u.usedPct) }}</span></td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: userColumns" data-testid="user-usage-row"></tr>
      </table>
      </div>
      <mat-paginator class="app-table-footer"
        data-testid="user-usage-paginator"
        [length]="filteredUsers().length"
        [pageSize]="pageSize()"
        [pageIndex]="pageIndex()"
        [pageSizeOptions]="pageSizes"
        showFirstLastButtons
        aria-label="Users per page"
        (page)="onPage($event)"
      />
      </div>

      <h2 class="section" #dailyHeading tabindex="-1">Daily breakdown</h2>
      <div class="filters">
        <mat-form-field appearance="outline" class="range-field">
          <mat-label>Date range (IST dates)</mat-label>
          <mat-date-range-input [rangePicker]="picker">
            <input matStartDate placeholder="From" [(ngModel)]="from" data-testid="range-from" />
            <input matEndDate placeholder="To" [(ngModel)]="to" data-testid="range-to" />
          </mat-date-range-input>
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-date-range-picker #picker />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>User</mat-label>
          <mat-select [(ngModel)]="userId" data-testid="range-user">
            <mat-option [value]="''">All users</mat-option>
            @for (u of s.users; track u.userId) {
              <mat-option [value]="u.userId">{{ u.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button data-testid="load-daily" [disabled]="!from || !to" (click)="loadDaily()">Show</button>
      </div>

      @if (daily(); as d) {
        @if (d.rows.length === 0) {
          <div class="app-empty"><span class="app-icon-tile"><mat-icon aria-hidden="true">event_busy</mat-icon></span><p class="title">No usage in this range ({{ rangeText() }})</p></div>
        }
        <div class="app-table-card" [hidden]="d.rows.length === 0">
        <div class="app-table-scroll daily-scroll">
        <table mat-table [dataSource]="d.rows" data-testid="daily-table">
          <ng-container matColumnDef="date" sticky>
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let r">{{ day(r.date) }}</td>
            <td mat-footer-cell *matFooterCellDef>Total</td>
          </ng-container>
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>User</th>
            <td mat-cell *matCellDef="let r">{{ r.userName }}</td>
            <td mat-footer-cell *matFooterCellDef></td>
          </ng-container>
          <ng-container matColumnDef="model">
            <th mat-header-cell *matHeaderCellDef>Model</th>
            <td mat-cell *matCellDef="let r">{{ r.model }}</td>
            <td mat-footer-cell *matFooterCellDef></td>
          </ng-container>
          <ng-container matColumnDef="inputTokens">
            <th mat-header-cell *matHeaderCellDef class="app-num-cell">Tokens in</th>
            <td mat-cell *matCellDef="let r" class="app-num-cell">{{ r.inputTokens }}</td>
            <td mat-footer-cell *matFooterCellDef class="app-num-cell">{{ d.totals.inputTokens }}</td>
          </ng-container>
          <ng-container matColumnDef="outputTokens">
            <th mat-header-cell *matHeaderCellDef class="app-num-cell">Tokens out</th>
            <td mat-cell *matCellDef="let r" class="app-num-cell">{{ r.outputTokens }}</td>
            <td mat-footer-cell *matFooterCellDef class="app-num-cell">{{ d.totals.outputTokens }}</td>
          </ng-container>
          <ng-container matColumnDef="costUsd">
            <th mat-header-cell *matHeaderCellDef class="app-num-cell">Cost</th>
            <td mat-cell *matCellDef="let r" class="app-num-cell">{{ usd(r.costUsd) }}</td>
            <td mat-footer-cell *matFooterCellDef class="app-num-cell" data-testid="daily-total-cost">{{ usd(d.totals.costUsd) }}</td>
          </ng-container>
          <ng-container matColumnDef="requestCount">
            <th mat-header-cell *matHeaderCellDef class="app-num-cell">Requests</th>
            <td mat-cell *matCellDef="let r" class="app-num-cell">{{ r.requestCount }}</td>
            <td mat-footer-cell *matFooterCellDef class="app-num-cell">{{ d.totals.requestCount }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="dailyColumns; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: dailyColumns" data-testid="daily-row"></tr>
          <tr mat-footer-row *matFooterRowDef="dailyColumns; sticky: true" class="app-total-row"></tr>
        </table>
        </div>
        </div>
      }
    }
  `,
  styles: `
    .system { margin: 16px 0; padding: 24px; max-width: 640px; background: var(--app-hero-tint); }
    .system.low { border-color: var(--app-warn-border); box-shadow: inset 3px 0 0 var(--app-warn), var(--app-shadow-1); }
    .system.danger { border-color: var(--app-danger-border); box-shadow: inset 3px 0 0 var(--app-danger), var(--app-shadow-1); }
    .head { display: flex; align-items: center; gap: 10px; }
    .chip-slot { margin-inline-start: auto; }
    .title { font: var(--app-type-title); margin: 0; }
    .section { font: var(--app-type-section); margin: 24px 0 8px; }
    .big { font: var(--app-type-number-l); margin: 12px 0 8px; overflow-wrap: anywhere; }
    .meta { color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
    .system .meta { margin-top: 8px; }
    .bar { margin-top: 8px; }
    .users-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .filter { width: 100%; max-width: 360px; margin-bottom: 8px; }
    .u-cell { display: flex; flex-direction: column; }
    .u-name { font: var(--mat-sys-body-medium); font-weight: 500; color: var(--mat-sys-on-surface); }
    .u-email { font: var(--mat-sys-body-small); }
    h2[tabindex] { outline: none; scroll-margin-top: 8px; }
    .daily-scroll { max-height: 70vh; overflow: auto; }
    .range-field { width: 300px; max-width: 100%; }
    @media (min-width: 600px) and (max-width: 1023.98px) {
      .app-table-card table.app-cards td.mat-mdc-cell:not(:first-child):not(:last-child),
      .app-table-card table.app-cards th.mat-mdc-header-cell:not(:first-child):not(:last-child) { padding-inline: 8px; }
      .u-email { overflow-wrap: anywhere; }
    }
    td.mat-column-date { white-space: nowrap; min-width: 96px; }
    @media (max-width: 599.98px) {
      .u-cell { align-items: flex-end; }
      .system { padding: 16px; }
    }
    .filters { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
    table { width: 100%; }
    .error { color: var(--mat-sys-error); padding: 8px 0; }
    td[mat-cell] .app-chip { margin-inline-start: 8px; }
  `,
})
export class UsageTabComponent implements OnInit {
  private readonly dailyHeading = viewChild<ElementRef<HTMLElement>>('dailyHeading');
  private readonly api = inject(AdminApi);

  readonly usd = formatUsd;
  readonly pct = formatPct;
  readonly pctCapped = formatPctCapped;
  readonly bar = pctToBar;
  readonly day = formatIsoDay;
  readonly userColumns = ['name', 'role', 'usedUsd', 'quotaUsd', 'remainingUsd', 'usedPct'];
  readonly dailyColumns = ['date', 'user', 'model', 'inputTokens', 'outputTokens', 'costUsd', 'requestCount'];

  readonly summary = signal<UsageSummary | null>(null);
  readonly daily = signal<DailyUsage | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly usedPct = computed(() => complementPct(this.summary()?.system.remainingPct ?? '100'));
  readonly state = computed(() => quotaState(this.summary()?.system.remainingPct ?? '100'));
  readonly sort = signal<Sort>({ active: 'usedUsd', direction: 'desc' });
  readonly filter = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);
  readonly pageSizes = USAGE_PAGE_SIZES;
  /** Filter, then sort the whole list, then take one page. */
  readonly filteredUsers = computed(() => filterSummaryUsers(this.summary()?.users ?? [], this.filter()));
  readonly sortedUsers = computed(() => sortSummaryUsers(this.filteredUsers(), this.sort()));
  readonly pagedUsers = computed(() => pageSlice(this.sortedUsers(), this.pageIndex(), this.pageSize()));

  from: Date | null = null;
  to: Date | null = null;
  userId = '';

  async ngOnInit(): Promise<void> {
    const range = defaultIstRange(new Date());
    this.from = range.from;
    this.to = range.to;
    await this.reload();
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  setFilter(q: string): void {
    this.filter.set(q);
    this.pageIndex.set(0);
  }

  onSort(s: Sort): void {
    this.sort.set(s);
    this.pageIndex.set(0);
  }

  jumpToDaily(): void {
    const el = this.dailyHeading()?.nativeElement;
    el?.scrollIntoView({ block: 'start' });
    el?.focus({ preventScroll: true });
  }

  rangeText(): string {
    return this.from && this.to ? `${formatIsoDay(toIsoDate(this.from))} – ${formatIsoDay(toIsoDate(this.to))}` : '';
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.summary.set(await this.api.summary());
      await this.loadDaily();
    } catch (err) {
      this.error.set(describeError(err));
    } finally {
      this.loading.set(false);
    }
  }

  async loadDaily(): Promise<void> {
    if (!this.from || !this.to) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      this.daily.set(await this.api.daily(toIsoDate(this.from), toIsoDate(this.to), this.userId || undefined));
    } catch (err) {
      this.error.set(describeError(err));
    } finally {
      this.loading.set(false);
    }
  }
}
