import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';
import { UsageLedger } from '../models';

export interface NewLedgerRow {
  userId: string;
  conversationId: string;
  assistantMessageId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  litellmCostRaw: string;
  litellmCallId: string | null;
  usageDate: string;
  createdAt: Date;
}

export interface DailyRow {
  date: string;
  userId: string;
  userName: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  requestCount: number;
}

/**
 * A usage_date counts from exactly one source: the rollup if the day is in usage_rollup_days,
 * otherwise the raw ledger (AC-14). All SQL below uses named replacements only.
 */
const COST_UNION = `
  SELECT r.user_id, r.cost_usd
    FROM usage_daily_rollup r
   WHERE r.usage_date >= CAST(:start AS date) AND r.usage_date < CAST(:end AS date)
     AND EXISTS (SELECT 1 FROM usage_rollup_days d WHERE d.usage_date = r.usage_date)
  UNION ALL
  SELECT l.user_id, l.cost_usd
    FROM usage_ledger l
   WHERE l.usage_date >= CAST(:start AS date) AND l.usage_date < CAST(:end AS date)
     AND NOT EXISTS (SELECT 1 FROM usage_rollup_days d WHERE d.usage_date = l.usage_date)
`;

const DAILY_UNION = `
  SELECT r.usage_date, r.user_id, r.model, r.input_tokens, r.output_tokens, r.cost_usd, r.request_count
    FROM usage_daily_rollup r
   WHERE r.usage_date >= CAST(:from AS date) AND r.usage_date <= CAST(:to AS date)
     AND EXISTS (SELECT 1 FROM usage_rollup_days d WHERE d.usage_date = r.usage_date)
  UNION ALL
  SELECT l.usage_date, l.user_id, l.model, SUM(l.input_tokens), SUM(l.output_tokens), SUM(l.cost_usd), COUNT(*)
    FROM usage_ledger l
   WHERE l.usage_date >= CAST(:from AS date) AND l.usage_date <= CAST(:to AS date)
     AND NOT EXISTS (SELECT 1 FROM usage_rollup_days d WHERE d.usage_date = l.usage_date)
   GROUP BY l.usage_date, l.user_id, l.model
`;

export class UsageRepository {
  constructor(private readonly sequelize: Sequelize) {}

  insertLedger(row: NewLedgerRow, transaction: Transaction): Promise<UsageLedger> {
    return UsageLedger.create(row, { transaction });
  }

  /** Total cost (decimal string) for IST dates in [startDate, endDate), optionally for one user. */
  async periodCost(startDate: string, endDate: string, userId: string | null): Promise<string> {
    const rows = await this.sequelize.query<{ used: string }>(
      `SELECT COALESCE(SUM(u.cost_usd), 0)::text AS used
         FROM (${COST_UNION}) u
        WHERE (CAST(:userId AS uuid) IS NULL OR u.user_id = CAST(:userId AS uuid))`,
      { replacements: { start: startDate, end: endDate, userId }, type: QueryTypes.SELECT },
    );
    return rows[0]?.used ?? '0';
  }

  /** Cost per user (decimal strings) for IST dates in [startDate, endDate). */
  async costByUser(startDate: string, endDate: string): Promise<Map<string, string>> {
    const rows = await this.sequelize.query<{ user_id: string; used: string }>(
      `SELECT u.user_id, SUM(u.cost_usd)::text AS used FROM (${COST_UNION}) u GROUP BY u.user_id`,
      { replacements: { start: startDate, end: endDate }, type: QueryTypes.SELECT },
    );
    return new Map(rows.map((r) => [r.user_id, r.used]));
  }

  /** Per date/user/model breakdown for IST dates in [from, to] (inclusive). */
  async daily(from: string, to: string, userId: string | null): Promise<DailyRow[]> {
    const rows = await this.sequelize.query<{
      usage_date: string;
      user_id: string;
      user_name: string;
      model: string;
      input_tokens: string;
      output_tokens: string;
      cost_usd: string;
      request_count: string;
    }>(
      `SELECT x.usage_date::text AS usage_date, x.user_id, usr.name AS user_name, x.model,
              SUM(x.input_tokens)::text AS input_tokens, SUM(x.output_tokens)::text AS output_tokens,
              SUM(x.cost_usd)::text AS cost_usd, SUM(x.request_count)::text AS request_count
         FROM (${DAILY_UNION}) x
         JOIN users usr ON usr.id = x.user_id
        WHERE (CAST(:userId AS uuid) IS NULL OR x.user_id = CAST(:userId AS uuid))
        GROUP BY x.usage_date, x.user_id, usr.name, x.model
        ORDER BY x.usage_date, usr.name, x.model`,
      { replacements: { from, to, userId }, type: QueryTypes.SELECT },
    );
    return rows.map((r) => ({
      date: r.usage_date,
      userId: r.user_id,
      userName: r.user_name,
      model: r.model,
      // eslint-disable-next-line no-restricted-syntax -- count, not money
      inputTokens: Number(r.input_tokens),
      // eslint-disable-next-line no-restricted-syntax -- count, not money
      outputTokens: Number(r.output_tokens),
      costUsd: r.cost_usd,
      // eslint-disable-next-line no-restricted-syntax -- count, not money
      requestCount: Number(r.request_count),
    }));
  }

  /** Raw ledger rows for IST dates in [from, to] inclusive, newest first. */
  ledger(from: string, to: string, userId: string | null, limit: number): Promise<UsageLedger[]> {
    return UsageLedger.findAll({
      where: { usageDate: { [Op.gte]: from, [Op.lte]: to }, ...(userId ? { userId } : {}) },
      order: [['id', 'DESC']],
      limit,
    });
  }
}
