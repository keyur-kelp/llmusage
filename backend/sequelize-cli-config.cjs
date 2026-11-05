// Config for sequelize-cli only (the app itself uses src/config/database.ts).
// Reads the same .env as the app. DATABASE_URL may be overridden from the environment
// (the integration-test setup points it at DATABASE_URL_TEST).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function url() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
  if (!PGHOST || !PGUSER || !PGDATABASE) {
    throw new Error('Set DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD/PGDATABASE) in .env');
  }
  return `postgres://${encodeURIComponent(PGUSER)}:${encodeURIComponent(PGPASSWORD || '')}@${PGHOST}:${PGPORT || 5432}/${PGDATABASE}`;
}

const cfg = { url: url(), dialect: 'postgres', logging: false };
module.exports = { development: cfg, test: cfg, production: cfg };
