import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminApi } from '../../core/api/admin-api';
import { Settings } from '../../core/api/models';
import { SettingsTabComponent } from './settings-tab.component';

const loaded: Settings = { systemQuotaUsd: '100', defaultUserQuotaUsd: '10', userResetDow: 6, systemResetDom: 1 };

describe('SettingsTabComponent discard', () => {
  function setup(saveResult: Settings = loaded) {
    const api = jasmine.createSpyObj<AdminApi>('AdminApi', ['getSettings', 'putSettings']);
    api.getSettings.and.resolveTo(loaded);
    api.putSettings.and.resolveTo(saveResult);
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminApi, useValue: api },
        { provide: MatSnackBar, useValue: { open: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(SettingsTabComponent);
    fixture.detectChanges();
    return { api, fixture, cmp: fixture.componentInstance };
  }

  it('restores the loaded values and does not call the save API', async () => {
    const { api, fixture, cmp } = setup();
    await fixture.whenStable();
    cmp.form.patchValue({ systemQuotaUsd: '999', systemResetDom: 5 });
    cmp.form.markAsDirty();
    cmp.discard();
    expect(cmp.form.getRawValue()).toEqual({
      systemQuotaUsd: '100', defaultUserQuotaUsd: '10', userResetDow: 6, systemResetDom: 1,
    });
    expect(cmp.form.pristine).toBeTrue();
    expect(api.putSettings).not.toHaveBeenCalled();
  });

  it('restores the last saved values after a save', async () => {
    const savedValues: Settings = { ...loaded, systemQuotaUsd: '200', systemResetDom: 4 };
    const { api, fixture, cmp } = setup(savedValues);
    await fixture.whenStable();
    cmp.form.patchValue({ systemQuotaUsd: '200', systemResetDom: 4 });
    await cmp.save();
    expect(api.putSettings).toHaveBeenCalledTimes(1);
    cmp.form.patchValue({ systemQuotaUsd: '5' });
    cmp.form.markAsDirty();
    cmp.discard();
    expect(cmp.form.getRawValue().systemQuotaUsd).toBe('200');
    expect(cmp.form.getRawValue().systemResetDom).toBe(4);
    expect(api.putSettings).toHaveBeenCalledTimes(1);
  });
});
