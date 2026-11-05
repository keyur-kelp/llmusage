import { test, expect, Page } from '@playwright/test';
import { adminLogin, createUser, TestUser } from './helpers';

// Outside the PRD ACs: v3 theme switch (Light default, Dark persists, System follows OS).
test.describe.configure({ mode: 'serial' });
test.use({ colorScheme: 'dark' }); // emulate an OS in dark mode

let user: TestUser;
test.beforeAll(async () => {
  user = await createUser(await adminLogin());
});

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(async () => {
    await page.getByTestId('login-email').fill(user.email);
    await page.getByTestId('login-password').fill(user.password);
    await expect(page.getByTestId('login-password')).toHaveValue(user.password, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId('login-submit')).toBeEnabled();
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/chat/);
}

const htmlClass = (page: Page): Promise<string> => page.evaluate(() => document.documentElement.className);
const bodyLuma = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g) ?? ['0', '0', '0'];
    return (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3;
  });
const pick = async (page: Page, id: string): Promise<void> => {
  await page.getByTestId('theme-toggle').click();
  await page.getByTestId(id).click();
};

test('theme: default is Light even when the OS prefers dark; Dark persists across reload; System follows OS', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  expect(await htmlClass(page)).toContain('theme-light');
  expect(await htmlClass(page)).not.toMatch(/theme-(dark|system)/);
  expect(await page.evaluate(() => localStorage.getItem('llmuc.theme'))).toBeNull();
  expect(await bodyLuma(page)).toBeGreaterThan(180);

  await login(page);
  expect(await htmlClass(page)).toContain('theme-light');
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Theme: Light');

  await pick(page, 'theme-dark');
  await expect(page.locator('html')).toHaveClass(/theme-dark/);
  expect(await page.evaluate(() => localStorage.getItem('llmuc.theme'))).toBe('dark');
  await expect.poll(() => bodyLuma(page)).toBeLessThan(80);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveClass(/theme-dark/);
  await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Theme: Dark');
  expect(await bodyLuma(page)).toBeLessThan(80);

  // System follows the emulated scheme (currently dark) and changes live
  await pick(page, 'theme-system');
  await expect(page.locator('html')).toHaveClass(/theme-system/);
  expect(await page.evaluate(() => localStorage.getItem('llmuc.theme'))).toBe('system');
  await expect.poll(() => bodyLuma(page)).toBeLessThan(80);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => bodyLuma(page)).toBeGreaterThan(180);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => bodyLuma(page)).toBeLessThan(80);

  // back to Light
  await pick(page, 'theme-light');
  await expect(page.locator('html')).toHaveClass(/theme-light/);
  await expect.poll(() => bodyLuma(page)).toBeGreaterThan(180);
});
