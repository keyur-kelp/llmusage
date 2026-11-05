import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { from, of } from 'rxjs';
import { AdminApi } from '../../core/api/admin-api';
import { UserDto } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { UserDialogData, UserDialogResult } from './user-dialog.component';
import { UsersTabComponent } from './users-tab.component';

const bob: UserDto = { id: 'u2', email: 'bob@x.y', name: 'Bob', role: 'USER', isActive: true, quotaOverrideUsd: null };
const adminAnn: UserDto = { id: 'u3', email: 'ann@x.y', name: 'Ann', role: 'ADMIN', isActive: true, quotaOverrideUsd: null };

function setup(confirmAnswer: boolean, editResult?: UserDialogResult) {
  const api = jasmine.createSpyObj<AdminApi>('AdminApi', ['listUsers', 'updateUser', 'createUser', 'resetPassword']);
  api.listUsers.and.resolveTo([bob, adminAnn]);
  api.updateUser.and.resolveTo(bob);
  api.createUser.and.resolveTo(bob);
  const snack = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
  const confirms: { title: string; confirmLabel: string }[] = [];
  const dialog = {
    open: (component: unknown, config: { data: unknown }) => {
      if (component === ConfirmDialogComponent) {
        confirms.push(config.data as { title: string; confirmLabel: string });
        return { afterClosed: () => of(confirmAnswer) };
      }
      const data = config.data as UserDialogData;
      // Mimics UserDialogComponent.submit(): run save, close with the result unless it returned false.
      return {
        afterClosed: () =>
          from(
            (async (): Promise<UserDialogResult | undefined> => {
              if (!editResult) return undefined;
              const keepOpen = (await data.save?.(editResult)) === false;
              return keepOpen ? undefined : editResult;
            })(),
          ),
      };
    },
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminApi, useValue: api },
      { provide: MatDialog, useValue: dialog },
      { provide: MatSnackBar, useValue: snack },
      { provide: AuthService, useValue: { user: () => ({ id: 'me' }) } },
    ],
  });
  const fixture = TestBed.createComponent(UsersTabComponent);
  fixture.detectChanges();
  return { cmp: fixture.componentInstance, fixture, api, snack, confirms };
}

const toggle = (checked: boolean): MatSlideToggleChange => ({ checked, source: { checked } }) as unknown as MatSlideToggleChange;

describe('UsersTabComponent deactivate confirm', () => {
  it('declining sends no PATCH, restores the toggle and shows no snackbar', async () => {
    const { cmp, api, snack, confirms } = setup(false);
    const e = toggle(false);
    await cmp.setActive(bob, e);
    expect(confirms[0]?.title).toBe('Deactivate Bob?');
    expect(api.updateUser).not.toHaveBeenCalled();
    expect(e.source.checked).toBeTrue();
    expect(snack.open).not.toHaveBeenCalled();
  });

  it('confirming sends { isActive: false } and shows the snackbar', async () => {
    const { cmp, api, snack } = setup(true);
    await cmp.setActive(bob, toggle(false));
    expect(api.updateUser).toHaveBeenCalledOnceWith('u2', { isActive: false });
    expect(snack.open).toHaveBeenCalledWith('Bob deactivated', undefined, { duration: 4000 });
  });

  it('reactivating needs no confirm', async () => {
    const { cmp, api, confirms } = setup(false);
    await cmp.setActive(bob, toggle(true));
    expect(confirms.length).toBe(0);
    expect(api.updateUser).toHaveBeenCalledOnceWith('u2', { isActive: true });
  });
});

describe('UsersTabComponent admin to user confirm', () => {
  const demote: UserDialogResult = { name: 'Ann', email: 'ann@x.y', password: '', role: 'USER', quotaOverrideUsd: '' };

  it('cancel keeps the dialog open and sends no PATCH', async () => {
    const { cmp, api, snack, confirms } = setup(false, demote);
    await cmp.edit(adminAnn);
    expect(confirms[0]?.confirmLabel).toBe('Remove admin');
    expect(api.updateUser).not.toHaveBeenCalled();
    expect(snack.open).not.toHaveBeenCalled();
  });

  it('confirm sends the role change and shows the snackbar', async () => {
    const { cmp, api, snack } = setup(true, demote);
    await cmp.edit(adminAnn);
    expect(api.updateUser).toHaveBeenCalledOnceWith('u3', { role: 'USER' });
    expect(snack.open).toHaveBeenCalledWith('User updated', undefined, { duration: 4000 });
  });

  it('a non-demoting edit needs no confirm', async () => {
    const { cmp, api, confirms } = setup(false, { ...demote, role: 'ADMIN', name: 'Ann B' });
    await cmp.edit(adminAnn);
    expect(confirms.length).toBe(0);
    expect(api.updateUser).toHaveBeenCalledOnceWith('u3', { name: 'Ann B' });
  });
});

describe('UsersTabComponent accessibility names', () => {
  it('names row actions after the user', () => {
    const { fixture } = setup(true);
    return fixture.whenStable().then(() => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const labels = Array.from(el.querySelectorAll('[data-testid="edit-user"], [data-testid="reset-user-password"]')).map((b) => b.getAttribute('aria-label'));
      expect(labels).toContain('Edit Bob');
      expect(labels).toContain('Reset password for Bob');
    });
  });
});

describe('UsersTabComponent switch name', () => {
  it('gives the inner switch an accessible name on every row', async () => {
    const { fixture } = setup(true);
    await fixture.whenStable();
    fixture.detectChanges();
    const switches = Array.from(fixture.nativeElement.querySelectorAll('button[role="switch"]')) as HTMLElement[];
    expect(switches.length).toBe(2);
    expect(switches.map((b) => b.getAttribute('aria-label'))).toEqual(['Active: Bob', 'Active: Ann']);
  });
});
