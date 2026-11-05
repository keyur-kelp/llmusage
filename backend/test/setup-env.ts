import path from 'path';
import dotenv from 'dotenv';

// Load the repo-root .env (if the user has created one) so DATABASE_URL_TEST is available.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
process.env['NODE_ENV'] = 'test';
