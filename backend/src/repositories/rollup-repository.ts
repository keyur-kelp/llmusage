import { QueryTypes, Sequelize, Transaction } from 'sequelize';

export class RollupRepository {
  constructor(private readonly sequelize: Sequelize) {}

  /**
   * Recomputes the rollup for one IST date inside the caller's transaction.
   * Delete + insert-select (not additive), so re-running never double counts (AC-13).
   * Returns the number of rollup rows written.
   */
  async rollUpDay(date: string, transaction: Transaction): Promise<number> {
    await this.sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('usage_rollup'))`, { transaction });
    await this.sequelize.query(`DELETE FROM usage_daily_rollup WHERE usage_date = CAST(:d AS date)`, {
      replacements: { d: date },
      transaction,
    });
    await this.sequelize.query(
      `INSERT INTO usage_daily_rollup
         (usage_date, user_id, model, input_tokens, output_tokens, cost_usd, request_count, created_at, updated_at)
       SELECT usage_date, user_id, model, SUM(input_tokens), SUM(output_tokens), SUM(cost_usd), COUNT(*), now(), now()
         FROM usage_ledger
        WHERE usage_date = CAST(:d AS date)
        GROUP BY usage_date, user_id, model`,
      { replacements: { d: date }, transaction },
    );
    await this.sequelize.query(
      `INSERT INTO usage_rollup_days (usage_date, rolled_at) VALUES (CAST(:d AS date), now())
       ON CONFLICT (usage_date) DO UPDATE SET rolled_at = EXCLUDED.rolled_at`,
      { replacements: { d: date }, transaction },
    );
    const rows = await this.sequelize.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM usage_daily_rollup WHERE usage_date = CAST(:d AS date)`,
      { replacements: { d: date }, transaction, type: QueryTypes.SELECT },
    );
    // eslint-disable-next-line no-restricted-syntax -- row count, not money
    return Number(rows[0]?.n ?? '0');
  }

  /** Distinct ledger dates before `today` (IST) that have no usage_rollup_days row. */
  async unrolledDatesBefore(today: string): Promise<string[]> {
    const rows = await this.sequelize.query<{ d: string }>(
      `SELECT DISTINCT l.usage_date::text AS d
         FROM usage_ledger l
        WHERE l.usage_date < CAST(:today AS date)
          AND NOT EXISTS (SELECT 1 FROM usage_rollup_days r WHERE r.usage_date = l.usage_date)
        ORDER BY d`,
      { replacements: { today }, type: QueryTypes.SELECT },
    );
    return rows.map((r) => r.d);
  }
}
