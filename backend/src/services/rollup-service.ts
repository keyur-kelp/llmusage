import { Sequelize } from 'sequelize';
import { Repositories } from '../repositories';
import { AppError } from '../lib/errors';
import { istDate, isValidIsoDate, yesterdayIst } from '../lib/time';
import type { Logger } from 'pino';

export class RollupService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly repos: Repositories,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  yesterday(): string {
    return yesterdayIst(this.now());
  }

  /** Idempotent: recomputes the day from the ledger. Dates >= today (IST) are refused. */
  async rollUpDay(date: string): Promise<{ date: string; rows: number }> {
    if (!isValidIsoDate(date)) throw new AppError('VALIDATION_ERROR', 400, 'date must be YYYY-MM-DD');
    if (date >= istDate(this.now())) {
      throw new AppError('ROLLUP_DATE_NOT_PAST', 400, 'Only past IST dates can be rolled up');
    }
    const rows = await this.sequelize.transaction((tx) => this.repos.rollup.rollUpDay(date, tx));
    this.logger.info({ date, rows }, 'rollup completed');
    return { date, rows };
  }

  /** Rolls up every past ledger date that has no rollup marker. */
  async catchUp(): Promise<string[]> {
    const dates = await this.repos.rollup.unrolledDatesBefore(istDate(this.now()));
    for (const d of dates) await this.rollUpDay(d);
    return dates;
  }
}
