import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { AdminApi, UpdateUserBody, describeError } from '../../core/api/admin-api';
import { UserDto } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { UserDialogComponent, UserDialogData, UserDialogResult } from './user-dialog.component';
import { PasswordDialogComponent } from './password-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/confirm-dialog.component';

/** Builds the PATCH body containing only what changed. Empty override text clears the override (null). */
export function buildUserPatch(user: UserDto, r: UserDialogResult, isSelf: boolean): UpdateUserBody {
  const patch: UpdateUserBody = {};
  if (r.name !== user.name) patch.name = r.name;
  if (!isSelf && r.role !== user.role) patch.role = r.role;
  const override = r.quotaOverrideUsd.trim() === '' ? null : r.quotaOverrideUsd.trim();
  const changed =
    override === null
      ? user.quotaOverrideUsd !== null
      : user.quotaOverrideUsd === null || !sameMoney(override, user.quotaOverrideUsd);
  if (changed) patch.quotaOverrideUsd = override;
  return patch;
}

export const SELF_HINT = "You can't deactivate yourself or remove your own admin role. Ask another admin.";

/** Case-insensitive match on name or email. */
export function filterUsers(users: UserDto[], q: string): UserDto[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return users;
  return users.filter((u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle));
}

function sameMoney(a: string, b: string): boolean {
  const norm = (s: string): string => {
    const [i, f = ''] = s.split('.');
    return (i ?? '0').replace(/^0+(?=\d)/, '') + '.' + f.padEnd(6, '0');
  };
  return norm(a) === norm(b);
}

@Component({
  selector: 'app-users-tab',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSlideToggleModule, MatTableModule, MatTooltipModule],
  template: `
    <div class="bar">
      <button mat-flat-button data-testid="create-user" (click)="create()"><mat-icon class="app-icon-m">add</mat-icon>Create user</button>
      <mat-form-field appearance="outline" class="filter" subscriptSizing="dynamic">
        <mat-label>Filter by name or email</mat-label>
        <input matInput [ngModel]="filter()" (ngModelChange)="filter.set($event)" />
      </mat-form-field>
    </div>
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (loaded() && visible().length === 0) {
      <div class="app-empty">
        <span class="app-icon-tile"><mat-icon aria-hidden="true">{{ filter() ? 'search_off' : 'group' }}</mat-icon></span>
        <p class="title">{{ filter() ? 'No users match this filter' : 'No users yet' }}</p>
      </div>
    }
    <div class="app-table-card">
    <div class="app-table-scroll">
    <table mat-table class="app-cards" [dataSource]="visible()" data-testid="users-table">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Name</th>
        <td mat-cell *matCellDef="let u" data-label="Name"><span class="u-name">{{ u.name }}</span></td>
      </ng-container>
      <ng-container matColumnDef="email">
        <th mat-header-cell *matHeaderCellDef>Email</th>
        <td mat-cell *matCellDef="let u" data-label="Email" data-testid="user-row-email"><span class="u-email">{{ u.email }}</span></td>
      </ng-container>
      <ng-container matColumnDef="role">
        <th mat-header-cell *matHeaderCellDef>Role</th>
        <td mat-cell *matCellDef="let u" data-label="Role">{{ u.role }}</td>
      </ng-container>
      <ng-container matColumnDef="override">
        <th mat-header-cell *matHeaderCellDef class="app-num-cell">Quota override</th>
        <td mat-cell *matCellDef="let u" class="app-num-cell" data-label="Quota override">
          @if (u.quotaOverrideUsd === null) { default } @else { &#36;{{ u.quotaOverrideUsd }} <span class="app-chip">override</span> }
        </td>
      </ng-container>
      <ng-container matColumnDef="active">
        <th mat-header-cell *matHeaderCellDef>Status</th>
        <td mat-cell *matCellDef="let u" data-label="Status">
          <span class="status">
            <mat-slide-toggle
              [checked]="u.isActive"
              [disabled]="isSelf(u)"
              [aria-describedby]="isSelf(u) ? 'self-hint-' + u.id : ''"
              [aria-label]="'Active: ' + u.name"
              (change)="setActive(u, $event)"
              data-testid="active-toggle"
            />
            @if (u.isActive) {
              <span class="app-chip good"><mat-icon aria-hidden="true">check_circle</mat-icon>Active</span>
            } @else {
              <span class="app-chip neutral"><mat-icon aria-hidden="true">pause_circle</mat-icon>Inactive</span>
            }
            @if (isSelf(u)) {
              <mat-icon class="lock app-icon-m" tabindex="0" role="img" [attr.aria-hidden]="false" [attr.aria-label]="selfHint" [matTooltip]="selfHint">lock</mat-icon>
              <span class="visually-hidden" [id]="'self-hint-' + u.id">{{ selfHint }}</span>
            }
          </span>
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef><span class="visually-hidden">Actions</span></th>
        <td mat-cell *matCellDef="let u" class="app-cell-actions">
          <button mat-button data-testid="edit-user" [attr.aria-label]="'Edit ' + u.name" (click)="edit(u)">Edit</button>
          <button mat-button data-testid="reset-user-password" [attr.aria-label]="'Reset password for ' + u.name" (click)="resetPassword(u)">Reset password</button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns" data-testid="user-row" [attr.data-user-id]="row.id"></tr>
    </table>
    </div>
    </div>
  `,
  styles: `
    .bar { display: flex; gap: 16px; align-items: center; justify-content: space-between; flex-wrap: wrap; padding: 16px 0; }
    .filter { min-width: 240px; flex: 1; max-width: 360px; }
    .error { color: var(--mat-sys-error); padding-bottom: 8px; }
    table { width: 100%; }
    .u-name { font: var(--mat-sys-body-medium); font-weight: 500; }
    .u-email { font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .status { display: inline-flex; align-items: center; gap: 8px; }
    .lock { color: var(--mat-sys-on-surface-variant); }
  `,
})
export class UsersTabComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  readonly columns = ['name', 'email', 'role', 'override', 'active', 'actions'];
  readonly users = signal<UserDto[]>([]);
  readonly loaded = signal(false);
  readonly filter = signal('');
  readonly visible = computed(() => filterUsers(this.users(), this.filter()));
  readonly selfHint = SELF_HINT;
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  isSelf(u: UserDto): boolean {
    return u.id === this.auth.user()?.id;
  }

  private async reload(): Promise<void> {
    try {
      this.users.set(await this.api.listUsers());
      this.error.set(null);
    } catch (err) {
      this.error.set(describeError(err));
    } finally {
      this.loaded.set(true);
    }
  }

  private fail(err: unknown): void {
    this.snack.open(describeError(err), 'Dismiss', { duration: 6000 });
  }

  /** After a reload the table re-renders, so put focus back on the row's control (looked up by user id). */
  private restoreFocus(id: string | null, testId: string): void {
    setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && active.isConnected) return;
      const sel = id
        ? `[data-user-id="${CSS.escape(id)}"] [data-testid="${testId}"]`
        : `[data-testid="${testId}"]`;
      const host = document.querySelector<HTMLElement>(sel);
      (host?.matches('button') ? host : host?.querySelector<HTMLElement>('button'))?.focus();
    }, 50);
  }

  async create(): Promise<void> {
    const data: UserDialogData = {
      save: async (r) => {
        await this.api.createUser({ name: r.name, email: r.email, password: r.password, role: r.role });
        return true;
      },
    };
    const r = await firstValueFrom(this.dialog.open<UserDialogComponent, UserDialogData, UserDialogResult>(UserDialogComponent, { data }).afterClosed());
    if (r) {
      this.snack.open('User created', undefined, { duration: 4000 });
      await this.reload();
    }
    this.restoreFocus(null, 'create-user');
  }

  async edit(u: UserDto): Promise<void> {
    const isSelf = this.isSelf(u);
    const data: UserDialogData = {
      user: u,
      isSelf,
      save: async (r) => {
        const patch = buildUserPatch(u, r, isSelf);
        if (Object.keys(patch).length === 0) return true;
        if (u.role === 'ADMIN' && patch.role === 'USER') {
          const ok = await this.confirm({
            title: `Remove admin access for ${u.name}?`,
            body: 'They will lose access to the admin screens and settings.',
            confirmLabel: 'Remove admin',
            icon: 'admin_panel_settings',
            destructive: true,
          });
          if (!ok) return false;
        }
        await this.api.updateUser(u.id, patch);
        this.snack.open('User updated', undefined, { duration: 4000 });
        return true;
      },
    };
    const r = await firstValueFrom(this.dialog.open<UserDialogComponent, UserDialogData, UserDialogResult>(UserDialogComponent, { data }).afterClosed());
    if (r) await this.reload();
    this.restoreFocus(u.id, 'edit-user');
  }

  async resetPassword(u: UserDto): Promise<void> {
    const pw = await firstValueFrom(
      this.dialog
        .open<PasswordDialogComponent, unknown, string>(PasswordDialogComponent, { data: { name: u.name } })
        .afterClosed(),
    );
    if (pw) {
      try {
        await this.api.resetPassword(u.id, pw);
        this.snack.open('Password reset', undefined, { duration: 4000 });
      } catch (err) {
        this.fail(err);
      }
    }
    this.restoreFocus(u.id, 'reset-user-password');
  }

  private async confirm(data: ConfirmDialogData): Promise<boolean> {
    const r = await firstValueFrom(this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { data }).afterClosed());
    return r === true;
  }

  async setActive(u: UserDto, e: MatSlideToggleChange): Promise<void> {
    const active = e.checked;
    if (!active) {
      const ok = await this.confirm({
        title: `Deactivate ${u.name}?`,
        body: "They'll be signed out immediately and can't sign in until reactivated.",
        confirmLabel: 'Deactivate',
        icon: 'person_off',
        destructive: true,
      });
      if (!ok) {
        e.source.checked = true;
        this.restoreFocus(u.id, 'active-toggle');
        return;
      }
    }
    try {
      await this.api.updateUser(u.id, { isActive: active });
      this.snack.open(`${u.name} ${active ? 'reactivated' : 'deactivated'}`, undefined, { duration: 4000 });
    } catch (err) {
      this.fail(err);
    }
    await this.reload();
    this.restoreFocus(u.id, 'active-toggle');
  }
}
