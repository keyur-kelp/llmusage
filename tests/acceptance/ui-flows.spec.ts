import { test, expect, Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, SHORT, adminLogin, call, chat, createUser, restoreDefaults, putSettings, TestUser, uniq } from './helpers';

test.describe.configure({ mode: 'serial' });

async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  const emailInput = page.getByTestId('login-email');
  const pwInput = page.getByTestId('login-password');
  await expect(emailInput).toBeVisible();
  // fill + verify (retry once if a reload swallowed the first fill), then click only when enabled
  await expect(async () => {
    await emailInput.fill(email);
    await pwInput.fill(password);
    await expect(emailInput).toHaveValue(email, { timeout: 1000 });
    await expect(pwInput).toHaveValue(password, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId('login-submit')).toBeEnabled();
  await page.getByTestId('login-submit').click();
}

// Warm-up so the first test in the run does not race the dev server's initial compile/reload.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.close();
});

let admin: string;
let user: TestUser;
let other: TestUser;
test.beforeAll(async () => {
  admin = await adminLogin();
  user = await createUser(admin);
  other = await createUser(admin);
});
test.afterAll(async () => { await restoreDefaults(); });

test.describe('AC-2 UI login', () => {
  test('invalid credentials show an error and stay on login; valid lands on chat', async ({ page }) => {
    await uiLogin(page, user.email, 'definitely-wrong-1');
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/eyJ/);
    await uiLogin(page, user.email, user.password);
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByTestId('composer-input')).toBeVisible();
  });
});

test.describe('AC-3 UI deactivated', () => {
  test('deactivated user cannot log in via the UI', async ({ page }) => {
    const u = await createUser(admin);
    await call('PATCH', `/admin/users/${u.id}`, admin, { isActive: false });
    await uiLogin(page, u.email, u.password);
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).not.toHaveURL(/\/chat/);
  });
});

test.describe('AC-4 UI admin guard', () => {
  test('USER is kept out of /admin and sees no admin link; ADMIN gets in', async ({ page }) => {
    await uiLogin(page, user.email, user.password);
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByTestId('admin-link')).toHaveCount(0);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/chat/);
    await page.getByTestId('logout').click();
    await uiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByTestId('admin-link')).toBeVisible();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole('tab', { name: 'Usage' })).toBeVisible();
  });
});

test.describe('AC-6/7/8/22 UI chat', () => {
  test('picker lists LiteLLM models; message streams; quota refreshes; history survives reload', async ({ page }) => {
    const models = ((await call('GET', '/models', user.token)).body.models as Array<{ id: string }>).map((m) => m.id);
    await uiLogin(page, user.email, user.password);
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByTestId('quota-user-remaining')).toContainText('$0.10');
    const sysBefore = await page.getByTestId('quota-system-remaining').innerText();
    await page.getByTestId('model-picker').click();
    await expect(page.getByTestId('model-option')).toHaveCount(models.length);
    expect((await page.getByTestId('model-option').allInnerTexts()).map((t) => t.trim())).toEqual(models);
    await page.keyboard.press('Escape');
    await page.getByTestId('composer-input').fill('Count from 1 to 15 separated by spaces.');
    await expect(page.getByTestId('composer-input')).not.toHaveValue('');
    await expect(page.getByTestId('send-button')).toBeEnabled();
    await page.getByTestId('send-button').click();
    await expect(page.getByTestId('message-assistant').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('message-model').first()).toHaveText('claude-sonnet-5-5', { timeout: 30_000 });
    await expect(page.getByTestId('conversation-item')).toHaveCount(1);
    expect(await page.getByTestId('message-assistant').first().innerText()).toMatch(/\d/);
    await expect(page.getByTestId('quota-user-remaining')).not.toContainText('$0.100000 left');
    expect(sysBefore).toBeTruthy();
    await page.reload();
    await expect(page.getByTestId('conversation-item')).toHaveCount(1);
    await page.getByTestId('conversation-item').first().click();
    await expect(page.getByTestId('message-user')).toHaveCount(1);
    await expect(page.getByTestId('message-assistant')).toHaveCount(1);
    await expect(page.getByTestId('message-model')).toHaveText('claude-sonnet-5-5');
  });
});

test.describe('AC-10 UI isolation', () => {
  test("another user's conversation is not visible or openable", async ({ page }) => {
    const r = await chat(user.token, { message: 'Say the word SECRETPLUM only.' });
    const cid = r.events.find((e) => e.event === 'done')!.data.conversationId as string;
    await uiLogin(page, other.email, other.password);
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByTestId('conversation-item')).toHaveCount(0);
    await page.goto(`/chat/${cid}`);
    await page.waitForTimeout(1500);
    await expect(page.locator('body')).not.toContainText('SECRETPLUM');
    await expect(page.getByTestId('message-user')).toHaveCount(0);
  });
});

test.describe('AC-23 UI blocked messages', () => {
  test('personal block shows reason and IST reset; system block shows system reason', async ({ page }) => {
    const u = await createUser(admin);
    await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: '0.000001' });
    await chat(u.token, { message: SHORT });
    await uiLogin(page, u.email, u.password);
    await expect(page).toHaveURL(/\/chat/);
    await page.getByTestId('composer-input').fill(SHORT);
    await expect(page.getByTestId('composer-input')).not.toHaveValue('');
    await expect(page.getByTestId('send-button')).toBeEnabled();
    await page.getByTestId('send-button').click();
    await expect(page.getByTestId('quota-block-reason')).toContainText(/personal/i);
    await expect(page.getByTestId('quota-reset-time')).toContainText(/IST/);
    try {
      await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: null });
      await putSettings(admin, { systemQuotaUsd: '0.000001' });
      await page.reload();
      await page.getByTestId('composer-input').fill(SHORT);
      await expect(page.getByTestId('composer-input')).not.toHaveValue('');
    await expect(page.getByTestId('send-button')).toBeEnabled();
    await page.getByTestId('send-button').click();
      await expect(page.getByTestId('quota-block-reason')).toContainText(/system/i);
      await expect(page.getByTestId('quota-reset-time')).toContainText(/IST/);
    } finally {
      await restoreDefaults();
    }
  });
});

test.describe('AC-24/25/26/27/28 UI admin', () => {
  test('settings save + validation, usage tables, user create/duplicate/self-lockout controls', async ({ page }) => {
    await uiLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/chat/);
    await page.goto('/admin');
    // usage tab
    await expect(page.getByTestId('system-usage')).toContainText('of $0.50');
    await expect(page.getByTestId('user-usage-row').first()).toBeVisible();
    // settings tab
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByTestId('setting-system-quota').fill('-5');
    await expect(page.getByTestId('settings-save')).toBeDisabled();
    await page.getByTestId('setting-system-quota').fill('0.5');
    await page.getByTestId('setting-default-user-quota').fill('0.1');
    await expect(page.getByTestId('setting-system-quota')).toHaveValue('0.5');
    await expect(page.getByTestId('setting-default-user-quota')).toHaveValue('0.1');
    await expect(page.getByTestId('settings-save')).toBeEnabled();
    await page.getByTestId('settings-save').click();
    await expect(page.getByTestId('settings-saved')).toBeVisible();
    // users tab
    await page.getByRole('tab', { name: 'Users' }).click();
    await page.getByTestId('create-user').click();
    // wait for the dialog's own autofocus (applied after its open animation) before typing, so it cannot steal focus mid-fill
    await expect(page.getByTestId('user-name')).toBeFocused();
    const email = `${uniq('ui')}@example.test`;
    await page.getByTestId('user-name').fill('UI Created');
    await page.getByTestId('user-email').fill(email);
    await page.getByTestId('user-password').fill('UiCreated-pass-1');
    await expect(page.getByTestId('user-save')).toBeEnabled();
    await page.getByTestId('user-save').click();
    await expect(page.getByTestId('user-row-email').filter({ hasText: email })).toBeVisible();
    const row = page.getByTestId('user-row').filter({ hasText: ADMIN_EMAIL });
    await expect(row.getByTestId('active-toggle').locator('button')).toBeDisabled();
    // duplicate email is rejected with a clear message and no second row (dialog timing is not asserted)
    await page.getByTestId('create-user').click();
    await expect(page.getByTestId('user-name')).toBeFocused();
    await page.getByTestId('user-name').fill('Dup');
    await page.getByTestId('user-email').fill(email);
    await page.getByTestId('user-password').fill('UiCreated-pass-1');
    await expect(page.getByTestId('user-save')).toBeEnabled();
    await page.getByTestId('user-save').click();
    await expect(page.getByText(/already exists|already in use|email.*taken/i).first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('user-row-email').filter({ hasText: email })).toHaveCount(1);
    await page.reload();
    await page.getByRole('tab', { name: 'Users' }).click();
    await expect(page.getByTestId('user-row-email').filter({ hasText: email })).toHaveCount(1);
    expect((await call('GET', '/admin/users', admin)).body.users.filter((x: { email: string }) => x.email === email)).toHaveLength(1);
  });
});
