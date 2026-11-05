import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

// Same as the root config, but drives the locally installed Google Chrome (the pinned Playwright
// chromium download is not installed on this machine).
export default defineConfig({
  ...base,
  testDir: 'acceptance',
  use: { ...base.use, channel: 'chrome' },
});
