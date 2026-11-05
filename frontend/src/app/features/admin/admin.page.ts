import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatTabChangeEvent, MatTabsModule } from '@angular/material/tabs';
import { LayoutService } from '../../core/layout.service';
import { AppShellComponent } from '../../shared/app-shell.component';
import { SettingsTabComponent } from './settings-tab.component';
import { UsageTabComponent } from './usage-tab.component';
import { UsersTabComponent } from './users-tab.component';

@Component({
  selector: 'app-admin-page',
  imports: [MatIconModule, MatTabsModule, AppShellComponent, SettingsTabComponent, UsageTabComponent, UsersTabComponent],
  template: `
    <app-shell section="admin">
      <main class="content" id="main" tabindex="-1">
        <h1>Admin</h1>
        <p class="subtitle">Usage, quotas and accounts</p>
        <mat-tab-group animationDuration="0ms" [mat-stretch-tabs]="layout.mobile()" (selectedTabChange)="onTab($event)">
          <mat-tab label="Usage"><ng-template mat-tab-label><mat-icon class="tab-icon" aria-hidden="true">insights</mat-icon>Usage</ng-template><app-usage-tab /></mat-tab>
          <mat-tab label="Settings"><ng-template mat-tab-label><mat-icon class="tab-icon" aria-hidden="true">tune</mat-icon>Settings</ng-template><app-settings-tab /></mat-tab>
          <mat-tab label="Users"><ng-template mat-tab-label><mat-icon class="tab-icon" aria-hidden="true">group</mat-icon>Users</ng-template><app-users-tab /></mat-tab>
        </mat-tab-group>
      </main>
    </app-shell>
  `,
  styles: `
    .content { padding: 24px 24px 16px; max-width: 1200px; margin: 0 auto; outline: none; }
    h1 { font: var(--app-type-h1); margin: 0; }
    .subtitle { font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); margin: 4px 0 16px; }
    .tab-icon { margin-inline-end: 8px; }
    @media (max-width: 599.98px) {
      .content { padding: 12px; }
      .tab-icon { margin-inline-end: 4px; }
      :host ::ng-deep .mat-mdc-tab.mdc-tab { padding-inline: 8px; min-width: 0; }
    }
  `,
})
export class AdminPage {
  private readonly title = inject(Title);
  protected readonly layout = inject(LayoutService);

  onTab(e: MatTabChangeEvent): void {
    this.title.setTitle(`Admin · ${e.tab.textLabel} · LLM Usage Control`);
  }
}
