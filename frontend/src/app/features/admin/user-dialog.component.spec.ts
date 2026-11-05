import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { UserDialogComponent, UserDialogData } from './user-dialog.component';

function setup(data: UserDialogData) {
  const ref = jasmine.createSpyObj<MatDialogRef<UserDialogComponent>>('MatDialogRef', ['close']);
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: ref },
    ],
  });
  const fixture = TestBed.createComponent(UserDialogComponent);
  fixture.detectChanges();
  return { fixture, ref, cmp: fixture.componentInstance };
}

const fill = (cmp: UserDialogComponent): void =>
  cmp.form.patchValue({ name: 'Dup', email: 'dup@example.test', password: 'long-enough-1' });

describe('UserDialogComponent save', () => {
  it('closes only after the save callback succeeds', async () => {
    const save = jasmine.createSpy('save').and.resolveTo();
    const { cmp, ref } = setup({ save });
    fill(cmp);
    await cmp.submit();
    expect(save).toHaveBeenCalled();
    expect(ref.close).toHaveBeenCalled();
  });

  it('stays open on a 409, shows the email error inline and keeps what was typed', async () => {
    const err = new HttpErrorResponse({ status: 409, error: { error: { code: 'EMAIL_TAKEN', message: 'A user with this email already exists' } } });
    const { cmp, ref, fixture } = setup({ save: () => Promise.reject(err) });
    fill(cmp);
    await cmp.submit();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect(cmp.form.controls.email.hasError('server')).toBeTrue();
    expect(cmp.form.getRawValue().name).toBe('Dup');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A user with this email already exists');
  });

  it('shows other errors in an inline alert and stays open', async () => {
    const err = new HttpErrorResponse({ status: 500, error: { error: { code: 'INTERNAL', message: 'Something broke' } } });
    const { cmp, ref, fixture } = setup({ save: () => Promise.reject(err) });
    fill(cmp);
    await cmp.submit();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Something broke');
  });

  it('stays open without an error when save returns false', async () => {
    const { cmp, ref, fixture } = setup({ save: () => Promise.resolve(false) });
    fill(cmp);
    await cmp.submit();
    fixture.detectChanges();
    expect(ref.close).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });

  it('blocks Cancel, Esc and backdrop while a save is pending, then restores them', async () => {
    let finish!: () => void;
    const save = () => new Promise<void>((r) => (finish = r));
    const { cmp, ref, fixture } = setup({ save });
    fill(cmp);
    const pending = cmp.submit();
    fixture.detectChanges();
    expect(ref.disableClose).toBeTrue();
    const cancel = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="user-cancel"]');
    expect(cancel?.disabled).toBeTrue();
    finish();
    await pending;
    expect(ref.disableClose).toBeFalse();
  });
});
