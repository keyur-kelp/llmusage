import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

import { loadEnv } from './config/env';
import { createSequelize } from './config/database';
import { initModels } from './models';
import { createLogger } from './lib/logger';
import { createApp } from './app';
import { LiteLlmGateway } from './services/llm-gateway';
import { bootstrapAdmin } from './services/admin-bootstrap-service';
import { startRollupCron } from './jobs/rollup-cron';

async function main(): Promise<void> {
  const env = loadEnv(); // fails fast with a readable message
  const logger = createLogger(env.logLevel);
  const sequelize = createSequelize(env.databaseUrl);
  initModels(sequelize);
  await sequelize.authenticate();

  const gateway = new LiteLlmGateway(env.litellmBaseUrl, env.litellmApiKey, logger);
  const { app, services } = createApp({ sequelize, gateway, jwtSecret: env.jwtSecret, logger, defaultModel: env.defaultModel });

  await bootstrapAdmin(services.repos, logger, env.adminEmail, env.adminPassword);
  const caught = await services.rollup.catchUp();
  if (caught.length > 0) logger.info({ dates: caught }, 'rollup catch-up done');
  if (env.cronEnabled) startRollupCron(services.rollup, logger);

  app.listen(env.port, () => logger.info({ port: env.port }, 'backend listening'));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
