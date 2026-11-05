import path from 'path';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

/** Migrates the test database once per run. Skipped (with a loud warning) when DATABASE_URL_TEST is unset. */
export default function globalSetup(): void {
  dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
  const url = process.env['DATABASE_URL_TEST'];
  if (!url) {
    console.warn(
      '\n[jest] DATABASE_URL_TEST is not set: integration tests will be SKIPPED (not passed). Set it in .env to run them.\n',
    );
    return;
  }
  const cwd = path.resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: url };
  execSync('npx tsc -p tsconfig.migrations.json', { cwd, env, stdio: 'inherit' });
  execSync('npx sequelize-cli db:migrate', { cwd, env, stdio: 'inherit' });
}
