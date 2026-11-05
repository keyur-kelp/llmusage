import Decimal from 'decimal.js';
import { z } from 'zod';
import { Repositories } from '../repositories';
import { DailyRow } from '../repositories/usage-repository';
import { AppError } from '../lib/errors';
import { clampZero, parseMoney, pct, toMoneyString } from '../lib/money';
import { daysBetween, isValidIsoDate, systemPeriod, userPeriod } from '../lib/time';
import { QuotaPart, buildQuotaPart } from './quota-service';

const isoDate = z.string().refine(isValidIsoDate, 'Must be a valid YYYY-MM-DD date');

export const rangeQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  userId: z.string().uuid().optional(),
});

export const ledgerQuerySchema = rangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export interface SummaryUser {
  userId: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  usedUsd: string;
  quotaUsd: string;
  remainingUsd: string;
  usedPct: string;
  isOverride: boolean;
}

export class UsageReportService {
  constructor(
    private readonly repos: Repositories,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async summary(): Promise<{ system: QuotaPart; users: SummaryUser[] }> {
    const settings = await this.repos.settings.get();
    const now = this.now();
    const sPeriod = systemPeriod(now, settings.systemResetDom);
    const uPeriod = userPeriod(now, settings.userResetDow);
    const [systemUsed, byUser, users] = await Promise.all([
      this.repos.usage.periodCost(sPeriod.startDate, sPeriod.endDate, null),
      this.repos.usage.costByUser(uPeriod.startDate, uPeriod.endDate),
      this.repos.users.listAll(),
    ]);
    const rows = users.map((u) => {
      const used = parseMoney(byUser.get(u.id) ?? '0');
      const quota = parseMoney(u.quotaOverrideUsd ?? settings.defaultUserQuotaUsd);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        usedDec: used,
        usedUsd: toMoneyString(used),
        quotaUsd: toMoneyString(quota),
        remainingUsd: toMoneyString(clampZero(quota.minus(used))),
        usedPct: pct(used, quota),
        isOverride: u.quotaOverrideUsd !== null,
      };
    });
    rows.sort((a, b) => b.usedDec.comparedTo(a.usedDec));
    return {
      system: buildQuotaPart(parseMoney(settings.systemQuotaUsd), parseMoney(systemUsed), sPeriod),
      users: rows.map(({ usedDec: _usedDec, ...rest }) => rest),
    };
  }

  private validateRange(from: string, to: string): void {
    const span = daysBetween(from, to);
    if (span < 0) throw new AppError('VALIDATION_ERROR', 400, '"from" must not be after "to"');
    if (span > 365) throw new AppError('VALIDATION_ERROR', 400, 'Range must be at most 366 days');
  }

  async daily(from: string, to: string, userId?: string) {
    this.validateRange(from, to);
    const rows: DailyRow[] = await this.repos.usage.daily(from, to, userId ?? null);
    let cost = new Decimal(0);
    let input = 0;
    let output = 0;
    let count = 0;
    for (const r of rows) {
      cost = cost.plus(parseMoney(r.costUsd));
      input += r.inputTokens;
      output += r.outputTokens;
      count += r.requestCount;
    }
    return {
      rows: rows.map((r) => ({ ...r, costUsd: toMoneyString(parseMoney(r.costUsd)) })),
      totals: { inputTokens: input, outputTokens: output, costUsd: toMoneyString(cost), requestCount: count },
    };
  }

  async ledger(from: string, to: string, userId: string | undefined, limit: number) {
    this.validateRange(from, to);
    const rows = await this.repos.usage.ledger(from, to, userId ?? null, limit);
    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        userId: r.userId,
        conversationId: r.conversationId,
        assistantMessageId: r.assistantMessageId,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: toMoneyString(parseMoney(r.costUsd)),
        litellmCostRaw: r.litellmCostRaw,
        litellmCallId: r.litellmCallId,
        usageDate: r.usageDate,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }
}
