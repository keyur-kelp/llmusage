import { z } from 'zod';
import { Repositories } from '../repositories';
import { MONEY_PATTERN, parseMoney, toMoneyString } from '../lib/money';

export const settingsSchema = z.object({
  systemQuotaUsd: z.string().regex(MONEY_PATTERN, 'Must be a non-negative decimal with up to 6 places'),
  defaultUserQuotaUsd: z.string().regex(MONEY_PATTERN, 'Must be a non-negative decimal with up to 6 places'),
  userResetDow: z.number().int().min(1).max(7),
  systemResetDom: z.number().int().min(1).max(28),
});

export interface SettingsDto {
  systemQuotaUsd: string;
  defaultUserQuotaUsd: string;
  userResetDow: number;
  systemResetDom: number;
  updatedAt: string;
}

export class SettingsService {
  constructor(private readonly repos: Repositories) {}

  async get(): Promise<SettingsDto> {
    const s = await this.repos.settings.get();
    return {
      systemQuotaUsd: toMoneyString(parseMoney(s.systemQuotaUsd)),
      defaultUserQuotaUsd: toMoneyString(parseMoney(s.defaultUserQuotaUsd)),
      userResetDow: s.userResetDow,
      systemResetDom: s.systemResetDom,
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  async update(input: z.infer<typeof settingsSchema>): Promise<SettingsDto> {
    await this.repos.settings.update(input);
    return this.get();
  }
}
