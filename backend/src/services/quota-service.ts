import Decimal from 'decimal.js';
import { Repositories } from '../repositories';
import { AppError, notFound } from '../lib/errors';
import { clampZero, parseMoney, pct, toMoneyString } from '../lib/money';
import { Period, systemPeriod, toIstIso, userPeriod } from '../lib/time';

export interface QuotaPart {
  quotaUsd: string;
  usedUsd: string;
  remainingUsd: string;
  remainingPct: string;
  periodStart: string;
  resetsAt: string;
  resetsAtIst: string;
}

export interface QuotaStatus {
  user: QuotaPart & { isOverride: boolean };
  system: QuotaPart;
}

export type QuotaDecision = 'ALLOW' | 'SYSTEM' | 'USER';

/** System is checked first (provisional decision 3). Usage below quota is allowed even if the call overshoots (AC-17). */
export function decideQuota(
  systemUsed: Decimal,
  systemQuota: Decimal,
  userUsed: Decimal,
  userQuota: Decimal,
): QuotaDecision {
  if (systemUsed.gte(systemQuota)) return 'SYSTEM';
  if (userUsed.gte(userQuota)) return 'USER';
  return 'ALLOW';
}

export function buildQuotaPart(quota: Decimal, used: Decimal, period: Period): QuotaPart {
  const remaining = clampZero(quota.minus(used));
  return {
    quotaUsd: toMoneyString(quota),
    usedUsd: toMoneyString(used),
    remainingUsd: toMoneyString(remaining),
    remainingPct: pct(remaining, quota),
    periodStart: period.startUtc.toISOString(),
    resetsAt: period.endUtc.toISOString(),
    resetsAtIst: toIstIso(period.endUtc),
  };
}

interface Computed {
  status: QuotaStatus;
  decision: QuotaDecision;
  userPeriod: Period;
  systemPeriod: Period;
}

export class QuotaService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async compute(userId: string): Promise<Computed> {
    const user = await this.repos.users.findById(userId);
    if (!user) throw notFound('User not found');
    const settings = await this.repos.settings.get(); // fresh every call (AC-20)
    const now = this.now();
    const uPeriod = userPeriod(now, settings.userResetDow);
    const sPeriod = systemPeriod(now, settings.systemResetDom);

    const [userUsedStr, systemUsedStr] = await Promise.all([
      this.repos.usage.periodCost(uPeriod.startDate, uPeriod.endDate, userId),
      this.repos.usage.periodCost(sPeriod.startDate, sPeriod.endDate, null),
    ]);

    const isOverride = user.quotaOverrideUsd !== null;
    const userQuota = parseMoney(user.quotaOverrideUsd ?? settings.defaultUserQuotaUsd);
    const systemQuota = parseMoney(settings.systemQuotaUsd);
    const userUsed = parseMoney(userUsedStr);
    const systemUsed = parseMoney(systemUsedStr);

    return {
      status: {
        user: { ...buildQuotaPart(userQuota, userUsed, uPeriod), isOverride },
        system: buildQuotaPart(systemQuota, systemUsed, sPeriod),
      },
      decision: decideQuota(systemUsed, systemQuota, userUsed, userQuota),
      userPeriod: uPeriod,
      systemPeriod: sPeriod,
    };
  }

  async getStatus(userId: string): Promise<QuotaStatus> {
    return (await this.compute(userId)).status;
  }

  /** Pre-call gate. Throws 429 SYSTEM_QUOTA_EXCEEDED / USER_QUOTA_EXCEEDED, otherwise returns the status. */
  async check(userId: string): Promise<QuotaStatus> {
    const c = await this.compute(userId);
    if (c.decision === 'ALLOW') return c.status;
    const part = c.decision === 'SYSTEM' ? c.status.system : c.status.user;
    throw new AppError(
      c.decision === 'SYSTEM' ? 'SYSTEM_QUOTA_EXCEEDED' : 'USER_QUOTA_EXCEEDED',
      429,
      c.decision === 'SYSTEM'
        ? 'System quota reached. Usage is blocked until the next reset.'
        : 'Personal quota reached. Usage is blocked until the next reset.',
      {
        limit: c.decision === 'SYSTEM' ? 'SYSTEM' : 'USER',
        resetsAt: part.resetsAt,
        resetsAtIst: part.resetsAtIst,
        quotaUsd: part.quotaUsd,
        usedUsd: part.usedUsd,
      },
    );
  }
}
