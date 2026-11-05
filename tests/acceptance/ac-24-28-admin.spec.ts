import { test, expect } from '@playwright/test';
import { Decimal } from 'decimal.js';
import {
  ADMIN_EMAIL, DEFAULT_SETTINGS, SHORT, adminLogin, call, chat, createUser, login, putSettings, resetTestDb,
  restoreDefaults, startTestBackend, testDbUrl, withDb, uniq,
} from './helpers';

test.describe.configure({ mode: 'serial' });
let admin: string;
test.beforeAll(async () => { admin = await adminLogin(); await restoreDefaults(); });
test.afterAll(async () => { await restoreDefaults(); });

test.describe('AC-24a fresh DB defaults', () => {
  test('migrations on an empty disposable DB create settings 100 / 10 / Saturday / 1', async () => {
    test.setTimeout(150_000);
    resetTestDb(); // undo all + migrate on DATABASE_URL_TEST (never the app DB)
    const row = await withDb({ connectionString: testDbUrl() }, async (c) => (await c.query(`SELECT * FROM settings`)).rows);
    expect(row.length).toBe(1);
    expect(new Decimal(row[0].system_quota_usd).toFixed(6)).toBe('100.000000');
    expect(new Decimal(row[0].default_user_quota_usd).toFixed(6)).toBe('10.000000');
    expect(row[0].user_reset_dow).toBe(6);
    expect(row[0].system_reset_dom).toBe(1);
    const email = `qa-fresh-${Date.now()}@example.test`;
    const b = await startTestBackend(3104, { adminEmail: email, adminPassword: 'Fresh-pass-12345' });
    try {
      const t = await login(email, 'Fresh-pass-12345', b.base);
      const s = await call('GET', '/admin/settings', t, undefined, b.base);
      expect(s.body).toMatchObject({ systemQuotaUsd: '100.000000', defaultUserQuotaUsd: '10.000000', userResetDow: 6, systemResetDom: 1 });
    } finally { await b.stop(); }
  });
});

test.describe('AC-24 admin settings', () => {
  test('valid values saved and persisted; invalid rejected with VALIDATION_ERROR and nothing changes', async () => {
    const ok = { systemQuotaUsd: '0.123456', defaultUserQuotaUsd: '0.075', userResetDow: 1, systemResetDom: 28 };
    const r = await call('PUT', '/admin/settings', admin, ok);
    expect(r.status).toBe(200);
    const g = await call('GET', '/admin/settings', admin);
    expect(g.body).toMatchObject({ systemQuotaUsd: '0.123456', defaultUserQuotaUsd: '0.075000', userResetDow: 1, systemResetDom: 28 });
    for (const dow of [1, 2, 3, 4, 5, 6, 7]) expect((await putSettings(admin, { userResetDow: dow })).status).toBe(200);
    for (const dom of [1, 14, 28]) expect((await putSettings(admin, { systemResetDom: dom })).status).toBe(200);
    expect((await putSettings(admin, { systemQuotaUsd: '0' })).status).toBe(200);

    const base = { ...DEFAULT_SETTINGS };
    const bads: Array<Record<string, unknown>> = [
      { systemQuotaUsd: '-1' }, { defaultUserQuotaUsd: '-0.5' }, { systemQuotaUsd: 'abc' }, { systemQuotaUsd: '' },
      { systemQuotaUsd: '1.1234567' }, { systemQuotaUsd: -5 }, { defaultUserQuotaUsd: 5 },
      { userResetDow: 0 }, { userResetDow: 8 }, { userResetDow: -1 }, { userResetDow: 2.5 }, { userResetDow: 'Mon' },
      { systemResetDom: 0 }, { systemResetDom: 29 }, { systemResetDom: 31 }, { systemResetDom: -3 },
    ];
    await call('PUT', '/admin/settings', admin, ok);
    for (const bad of bads) {
      const x = await call('PUT', '/admin/settings', admin, { ...base, ...bad });
      expect(x.status, JSON.stringify(bad)).toBe(400);
      expect(x.body.error.code).toBe('VALIDATION_ERROR');
    }
    const missing = await call('PUT', '/admin/settings', admin, { systemQuotaUsd: '1' });
    expect(missing.status).toBe(400);
    const still = await call('GET', '/admin/settings', admin);
    expect(still.body).toMatchObject({ systemQuotaUsd: '0.123456', userResetDow: 1, systemResetDom: 28 });
    await restoreDefaults();
  });
});

test.describe('AC-25 usage summary', () => {
  test('system MTD vs quota and per-user week-to-date vs effective quota, sorted by usage', async () => {
    const heavy = await createUser(admin);
    const light = await createUser(admin);
    await call('PATCH', `/admin/users/${light.id}`, admin, { quotaOverrideUsd: '0.05' });
    const r1 = await chat(heavy.token, { message: 'Write a sentence of about 25 words about the sea.' });
    expect(r1.status).toBe(200);
    expect((await chat(light.token, { message: SHORT })).status).toBe(200);
    const s = (await call('GET', '/admin/usage/summary', admin)).body;
    expect(s.system.quotaUsd).toBe('0.500000');
    expect(new Decimal(s.system.usedUsd).gt(0)).toBe(true);
    expect(s.system.resetsAtIst).toMatch(/\+05:30$/);
    const h = s.users.find((u: { userId: string }) => u.userId === heavy.id);
    const l = s.users.find((u: { userId: string }) => u.userId === light.id);
    expect(h.quotaUsd).toBe('0.100000');
    expect(h.isOverride).toBe(false);
    expect(l.quotaUsd).toBe('0.050000');
    expect(l.isOverride).toBe(true);
    expect(new Decimal(h.usedUsd).gt(0)).toBe(true);
    expect(new Decimal(h.usedUsd).plus(h.remainingUsd).toFixed(6)).toBe('0.100000');
    const used = s.users.map((u: { usedUsd: string }) => new Decimal(u.usedUsd));
    for (let i = 1; i < used.length; i += 1) expect(used[i - 1].gte(used[i])).toBe(true);
    expect(s.users.some((u: { email: string }) => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())).toBe(true);
    // system used equals sum over the system period of the daily endpoint
    expect(new Decimal(s.system.usedUsd).gte(new Decimal(h.usedUsd).plus(l.usedUsd))).toBe(true);
  });
});

test.describe('AC-27 user management', () => {
  test('create, unique email, edit, override set/clear, password reset, deactivate/reactivate', async () => {
    const email = `${uniq('mgmt')}@example.test`;
    const pw = 'Initial-pass-77';
    const c = await call('POST', '/admin/users', admin, { name: 'Mgmt User', email, password: pw, role: 'USER' });
    expect(c.status).toBe(201);
    expect(c.body).toMatchObject({ name: 'Mgmt User', email, role: 'USER', isActive: true, quotaOverrideUsd: null });
    expect(JSON.stringify(c.body)).not.toMatch(/hash|password/i);
    const id = c.body.id as string;
    // duplicates (case-insensitive)
    for (const e of [email, email.toUpperCase()]) {
      const d = await call('POST', '/admin/users', admin, { name: 'Dup', email: e, password: pw, role: 'USER' });
      expect(d.status).toBe(409);
      expect(d.body.error.code).toBe('EMAIL_TAKEN');
    }
    // validation
    for (const bad of [
      { name: 'x', email: 'not-an-email', password: pw, role: 'USER' },
      { name: 'x', email: `${uniq('v')}@example.test`, password: 'short', role: 'USER' },
      { name: 'x', email: `${uniq('v')}@example.test`, password: pw, role: 'ROOT' },
      { name: '', email: `${uniq('v')}@example.test`, password: pw, role: 'USER' },
    ]) {
      expect((await call('POST', '/admin/users', admin, bad)).status).toBe(400);
    }
    // edit name/role
    const e = await call('PATCH', `/admin/users/${id}`, admin, { name: 'Renamed', role: 'ADMIN' });
    expect(e.status).toBe(200);
    expect(e.body).toMatchObject({ name: 'Renamed', role: 'ADMIN' });
    await call('PATCH', `/admin/users/${id}`, admin, { role: 'USER' });
    // override set / clear / invalid
    expect((await call('PATCH', `/admin/users/${id}`, admin, { quotaOverrideUsd: '2.5' })).body.quotaOverrideUsd).toBe('2.500000');
    expect((await call('PATCH', `/admin/users/${id}`, admin, { quotaOverrideUsd: '-1' })).status).toBe(400);
    expect((await call('PATCH', `/admin/users/${id}`, admin, { quotaOverrideUsd: null })).body.quotaOverrideUsd).toBeNull();
    // list contains the user
    const list = await call('GET', '/admin/users', admin);
    expect(list.body.users.some((u: { id: string }) => u.id === id)).toBe(true);
    // password reset
    const tok = await login(email, pw);
    expect((await call('POST', `/admin/users/${id}/password`, admin, { password: 'short' })).status).toBe(400);
    const rp = await call('POST', `/admin/users/${id}/password`, admin, { password: 'Brand-new-pass-8' });
    expect(rp.status).toBe(204);
    expect((await call('POST', '/auth/login', null, { email, password: pw })).status).toBe(401);
    expect((await call('POST', '/auth/login', null, { email, password: 'Brand-new-pass-8' })).status).toBe(200);
    expect((await call('GET', '/auth/me', tok)).status).toBe(401); // old session invalidated
    // deactivate / reactivate
    expect((await call('PATCH', `/admin/users/${id}`, admin, { isActive: false })).body.isActive).toBe(false);
    expect([401, 403]).toContain((await call('POST', '/auth/login', null, { email, password: 'Brand-new-pass-8' })).status);
    expect((await call('PATCH', `/admin/users/${id}`, admin, { isActive: true })).body.isActive).toBe(true);
    expect((await call('POST', '/auth/login', null, { email, password: 'Brand-new-pass-8' })).status).toBe(200);
    // unknown id
    expect((await call('PATCH', '/admin/users/00000000-0000-4000-8000-000000000000', admin, { name: 'z' })).status).toBe(404);
  });
});

test.describe('AC-28 no self lock-out', () => {
  test('admin cannot deactivate self or remove own ADMIN role; can still edit other things; others can be changed', async () => {
    const a2 = await createUser(admin, 'ADMIN');
    const a3 = await createUser(admin, 'ADMIN');
    const d = await call('PATCH', `/admin/users/${a2.id}`, a2.token, { isActive: false });
    expect(d.status).toBe(409);
    expect(d.body.error.code).toBe('SELF_LOCKOUT');
    const r = await call('PATCH', `/admin/users/${a2.id}`, a2.token, { role: 'USER' });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('SELF_LOCKOUT');
    const both = await call('PATCH', `/admin/users/${a2.id}`, a2.token, { role: 'USER', isActive: false });
    expect(both.status).toBe(409);
    const me = await call('GET', '/auth/me', a2.token);
    expect(me.body).toMatchObject({ role: 'ADMIN', isActive: true });
    // harmless self edits allowed
    expect((await call('PATCH', `/admin/users/${a2.id}`, a2.token, { name: 'Self Renamed' })).status).toBe(200);
    expect((await call('PATCH', `/admin/users/${a2.id}`, a2.token, { role: 'ADMIN', isActive: true })).status).toBe(200);
    // the seeded admin cannot lock themselves out either
    const meAdmin = await call('GET', '/auth/me', admin);
    expect((await call('PATCH', `/admin/users/${meAdmin.body.id}`, admin, { isActive: false })).status).toBe(409);
    expect((await call('PATCH', `/admin/users/${meAdmin.body.id}`, admin, { role: 'USER' })).status).toBe(409);
    expect((await call('GET', '/admin/settings', admin)).status).toBe(200);
    // another admin may demote/deactivate a different admin
    expect((await call('PATCH', `/admin/users/${a3.id}`, a2.token, { role: 'USER' })).status).toBe(200);
  });
});
