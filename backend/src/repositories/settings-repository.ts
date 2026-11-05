import { Setting } from '../models';

export interface SettingsValues {
  systemQuotaUsd: string;
  defaultUserQuotaUsd: string;
  userResetDow: number;
  systemResetDom: number;
}

export class SettingsRepository {
  /** Reads the single settings row fresh from the DB every call (AC-20). */
  async get(): Promise<Setting> {
    const row = await Setting.findByPk(1);
    if (!row) throw new Error('settings row missing: run migrations');
    return row;
  }

  async update(values: SettingsValues): Promise<Setting> {
    const row = await this.get();
    row.systemQuotaUsd = values.systemQuotaUsd;
    row.defaultUserQuotaUsd = values.defaultUserQuotaUsd;
    row.userResetDow = values.userResetDow;
    row.systemResetDom = values.systemResetDom;
    await row.save();
    return row.reload();
  }
}
