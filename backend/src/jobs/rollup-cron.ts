import cron, { ScheduledTask } from 'node-cron';
import type { Logger } from 'pino';
import { RollupService } from '../services/rollup-service';

/** 00:05 IST daily: roll up yesterday (IST). */
export function startRollupCron(rollup: RollupService, logger: Logger): ScheduledTask {
  return cron.schedule(
    '5 0 * * *',
    () => {
      rollup.rollUpDay(rollup.yesterday()).catch((err: unknown) => {
        logger.error({ err: err instanceof Error ? err.message : String(err) }, 'scheduled rollup failed');
      });
    },
    { timezone: 'Asia/Kolkata' },
  );
}
