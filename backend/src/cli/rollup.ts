import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

import { loadEnv } from '../config/env';
import { createSequelize } from '../config/database';
import { initModels } from '../models';
import { createLogger } from '../lib/logger';
import { buildServices } from '../app';
import { isValidIsoDate } from '../lib/time';

/** npm run rollup -- --date=YYYY-MM-DD   (default: yesterday IST) */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.logLevel);
  const sequelize = createSequelize(env.databaseUrl);
  initModels(sequelize);
  const { rollup } = buildServices({ sequelize, jwtSecret: env.jwtSecret, logger });

  const arg = process.argv.find((a) => a.startsWith('--date='))?.slice('--date='.length);
  if (arg !== undefined && !isValidIsoDate(arg)) throw new Error('--date must be YYYY-MM-DD');
  const result = await rollup.rollUpDay(arg ?? rollup.yesterday());
  console.log(`rolled up ${result.date}: ${result.rows} rows`);
  await sequelize.close();
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
