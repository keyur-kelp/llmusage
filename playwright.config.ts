import { defineConfig } from '@playwright/test';

// QA owns tests/acceptance. Start LiteLLM, `npm run dev:backend` and `npm run dev:frontend` first.
export default defineConfig({
  testDir: 'tests/acceptance',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env['BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
});
