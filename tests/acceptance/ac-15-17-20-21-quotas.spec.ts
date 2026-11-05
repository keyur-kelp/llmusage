import { test, expect } from '@playwright/test';
import { Decimal } from 'decimal.js';
import {
  SHORT, adminLogin, call, chat, createUser, istDateStr, istNow, putSettings, restoreDefaults,
} from './helpers';

test.describe.configure({ mode: 'serial' });
const TINY = '0.000001';
let admin: string;

test.beforeAll(async () => {
  admin = await adminLogin();
  await restoreDefaults();
});
test.afterAll(async () => { await restoreDefaults(); });

const ledgerCount = async (userId: string): Promise<number> => {
  const t = istDateStr(istNow());
  const r = await call('GET', `/admin/usage/ledger?from=${t}&to=${t}&userId=${userId}&limit=500`, admin);
  return r.body.rows.length;
};
const convCount = async (token: string): Promise<number> => (await call('GET', '/conversations', token)).body.conversations.length;

test.describe('AC-15 + AC-17 personal quota', () => {
  test('under quota allowed even if overshoot; next blocked with USER_QUOTA_EXCEEDED + reset time; nothing written', async () => {
    const u = await createUser(admin);
    expect((await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: TINY })).status).toBe(200);
    // AC-17: first message allowed although its cost >> quota
    const first = await chat(u.token, { message: SHORT });
    expect(first.status).toBe(200);
    const done = first.events.find((e) => e.event === 'done')!.data;
    expect(new Decimal(done.usage.costUsd).gt(TINY)).toBe(true);
    expect(done.quota.user.remainingUsd).toBe('0.000000');
    expect(done.quota.user.remainingPct).toBe('0.00');
    expect(await ledgerCount(u.id)).toBe(1);
    const convs = await convCount(u.token);

    // AC-15: next is blocked before any LLM call
    const blocked = await chat(u.token, { message: SHORT });
    expect(blocked.status).toBe(429);
    expect(blocked.errorBody.error.code).toBe('USER_QUOTA_EXCEEDED');
    expect(blocked.errorBody.error.details.limit).toBe('USER');
    expect(blocked.errorBody.error.details.resetsAtIst).toMatch(/\+05:30$/);
    expect(Date.parse(blocked.errorBody.error.details.resetsAt)).toBeGreaterThan(Date.now());
    expect(await ledgerCount(u.id)).toBe(1);
    expect(await convCount(u.token)).toBe(convs);
    // also blocked for follow-up in existing conversation
    const cid = done.conversationId as string;
    const fu = await chat(u.token, { conversationId: cid, message: SHORT });
    expect(fu.status).toBe(429);
    const conv = await call('GET', `/conversations/${cid}`, u.token);
    expect(conv.body.messages.length).toBe(2);

    // other users are unaffected
    const v = await createUser(admin);
    expect((await chat(v.token, { message: SHORT })).status).toBe(200);
  });
});

test.describe('AC-16 system quota', () => {
  test('every user blocked with SYSTEM_QUOTA_EXCEEDED even with personal quota left; no ledger writes', async () => {
    const u = await createUser(admin);
    const adm = await createUser(admin, 'ADMIN');
    expect((await chat(u.token, { message: SHORT })).status).toBe(200); // ensure usage exists
    const before = await ledgerCount(u.id);
    try {
      expect((await putSettings(admin, { systemQuotaUsd: TINY })).status).toBe(200);
      for (const who of [u, adm]) {
        const r = await chat(who.token, { message: SHORT });
        expect(r.status).toBe(429);
        expect(r.errorBody.error.code).toBe('SYSTEM_QUOTA_EXCEEDED');
        expect(r.errorBody.error.details.limit).toBe('SYSTEM');
        expect(r.errorBody.error.details.resetsAtIst).toMatch(/\+05:30$/);
      }
      expect(await ledgerCount(u.id)).toBe(before);
      expect(await ledgerCount(adm.id)).toBe(0);
      // personal quota is still available
      const q = await call('GET', '/quota/me', u.token);
      expect(new Decimal(q.body.user.remainingUsd).gt(0)).toBe(true);
      expect(q.body.system.remainingUsd).toBe('0.000000');
      // both exceeded -> system reason wins
      await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: '0.000000' });
      const both = await chat(u.token, { message: SHORT });
      expect(both.errorBody.error.code).toBe('SYSTEM_QUOTA_EXCEEDED');
    } finally {
      await restoreDefaults();
    }
    // after raising the system quota, a user with personal quota is allowed again
    const ok = await createUser(admin);
    expect((await chat(ok.token, { message: SHORT })).status).toBe(200);
  });
});

test.describe('AC-20 settings apply without restart', () => {
  test('lowering and raising the default user quota takes effect on the next message', async () => {
    const u = await createUser(admin);
    try {
      expect((await chat(u.token, { message: SHORT })).status).toBe(200);
      expect((await putSettings(admin, { defaultUserQuotaUsd: TINY })).status).toBe(200);
      const blocked = await chat(u.token, { message: SHORT });
      expect(blocked.status).toBe(429);
      expect(blocked.errorBody.error.code).toBe('USER_QUOTA_EXCEEDED');
      expect((await call('GET', '/quota/me', u.token)).body.user.quotaUsd).toBe('0.000001');
      expect((await putSettings(admin, { defaultUserQuotaUsd: '0.1' })).status).toBe(200);
      expect((await call('GET', '/quota/me', u.token)).body.user.quotaUsd).toBe('0.100000');
      expect((await chat(u.token, { message: SHORT })).status).toBe(200);
      // reset day change applies immediately too
      const before = (await call('GET', '/quota/me', u.token)).body.user.periodStart;
      const dow = istNow().weekday === 1 ? 2 : 1;
      await putSettings(admin, { userResetDow: dow });
      const after = (await call('GET', '/quota/me', u.token)).body.user.periodStart;
      expect(after).not.toBe(before);
      // system quota change reflected
      await putSettings(admin, { systemQuotaUsd: '0.4' });
      expect((await call('GET', '/quota/me', u.token)).body.system.quotaUsd).toBe('0.400000');
    } finally {
      await restoreDefaults();
    }
  });
});

test.describe('AC-21 clearing the override restores the default', () => {
  test('override applies, then null clears it and the default quota applies', async () => {
    const u = await createUser(admin);
    expect((await chat(u.token, { message: SHORT })).status).toBe(200);
    await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: TINY });
    let q = (await call('GET', '/quota/me', u.token)).body.user;
    expect(q.quotaUsd).toBe('0.000001');
    expect(q.isOverride).toBe(true);
    expect((await chat(u.token, { message: SHORT })).status).toBe(429);
    const clr = await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: null });
    expect(clr.status).toBe(200);
    expect(clr.body.quotaOverrideUsd).toBeNull();
    q = (await call('GET', '/quota/me', u.token)).body.user;
    expect(q.quotaUsd).toBe('0.100000');
    expect(q.isOverride).toBe(false);
    expect((await chat(u.token, { message: SHORT })).status).toBe(200);
  });
});

test.describe('AC-22 quota status API', () => {
  test('remaining USD and % for user and system; updated in done event', async () => {
    const u = await createUser(admin);
    const q0 = (await call('GET', '/quota/me', u.token)).body;
    expect(q0.user.usedUsd).toBe('0.000000');
    expect(q0.user.remainingPct).toBe('100.00');
    const r = await chat(u.token, { message: SHORT });
    const done = r.events.find((e) => e.event === 'done')!.data;
    const q1 = (await call('GET', '/quota/me', u.token)).body;
    expect(q1.user.usedUsd).toBe(done.usage.costUsd);
    expect(done.quota.user.usedUsd).toBe(q1.user.usedUsd);
    expect(new Decimal(q1.user.remainingUsd).plus(q1.user.usedUsd).toFixed(6)).toBe('0.100000');
    expect(q1.user.remainingPct).toBe(new Decimal(q1.user.remainingUsd).div(q1.user.quotaUsd).times(100).toFixed(2));
    expect(new Decimal(q1.system.quotaUsd).minus(q1.system.usedUsd).toFixed(6)).toBe(q1.system.remainingUsd);
  });
});
