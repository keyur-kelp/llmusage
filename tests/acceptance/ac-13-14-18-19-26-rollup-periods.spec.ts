import { test, expect } from '@playwright/test';
import { Decimal } from 'decimal.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  ROOT, MODEL, call, createUser, putSettings, resetTestDb, seedLedgerRow, startTestBackend, testDbUrl, withDb,
  istNow, istDateStr, SpawnedBackend, TestUser,
} from './helpers';

// All of this file runs against a backend on the disposable test DB (port 3102), never the app DB.
test.describe.configure({ mode: 'serial' });
test.setTimeout(120_000);

let b: SpawnedBackend;
let admin: string;
let A: TestUser;
let B: TestUser;
const ae = `qa-roll-${Date.now()}@example.test`;
const ap = 'RollAdmin-pw-1234';
const today = istNow().startOf('day');
const d = (n: number): string => istDateStr(today.minus({ days: n }));
const db = { connectionString: '' };

test.beforeAll(async () => {
  db.connectionString = testDbUrl();
  resetTestDb();
  b = await startTestBackend(3102, { adminEmail: ae, adminPassword: ap });
  const r = await call('POST', '/auth/login', null, { email: ae, password: ap }, b.base);
  admin = r.body.token;
  A = await createUser(admin, 'USER', b.base);
  B = await createUser(admin, 'USER', b.base);
});
test.afterAll(async () => { await b?.stop(); });

const sumLedger = (from: string, toExcl: string, userId?: string): Promise<string> =>
  withDb(db, async (c) => {
    const r = await c.query(
      `SELECT COALESCE(SUM(cost_usd),0)::text AS s FROM usage_ledger WHERE usage_date >= $1 AND usage_date < $2 AND ($3::uuid IS NULL OR user_id = $3)`,
      [from, toExcl, userId ?? null],
    );
    return new Decimal(r.rows[0].s).toFixed(6);
  });

test.describe('AC-13 daily rollup', () => {
  test('one row per user per model per day with summed values; idempotent; manual + CLI; past dates only; cron at 00:05 IST', async () => {
    const day = d(10);
    await withDb(db, async (c) => {
      await seedLedgerRow(c, { userId: A.id, date: day, cost: '0.100001', inTok: 10, outTok: 5, model: 'claude-sonnet-5-5' });
      await seedLedgerRow(c, { userId: A.id, date: day, cost: '0.200002', inTok: 20, outTok: 7, model: 'claude-sonnet-5-5' });
      await seedLedgerRow(c, { userId: A.id, date: day, cost: '0.050000', inTok: 3, outTok: 1, model: 'claude-haiku-5-5' });
      await seedLedgerRow(c, { userId: B.id, date: day, cost: '0.400000', inTok: 40, outTok: 9, model: 'claude-sonnet-5-5' });
    });
    const snapshot = (): Promise<unknown[]> =>
      withDb(db, async (c) => (await c.query(
        `SELECT user_id, model, input_tokens::int AS i, output_tokens::int AS o, cost_usd::text AS c, request_count FROM usage_daily_rollup WHERE usage_date = $1 ORDER BY user_id, model`, [day])).rows);

    const run1 = await call('POST', '/admin/rollup/run', admin, { date: day }, b.base);
    expect(run1.status).toBe(200);
    const s1 = (await snapshot()) as Array<{ user_id: string; model: string; i: number; o: number; c: string; request_count: number }>;
    expect(s1.length).toBe(3);
    const find = (u: string, m: string) => s1.find((r) => r.user_id === u && r.model === m)!;
    expect(find(A.id, 'claude-sonnet-5-5')).toMatchObject({ i: 30, o: 12, c: '0.300003', request_count: 2 });
    expect(find(A.id, 'claude-haiku-5-5')).toMatchObject({ i: 3, o: 1, c: '0.050000', request_count: 1 });
    expect(find(B.id, 'claude-sonnet-5-5')).toMatchObject({ i: 40, o: 9, c: '0.400000', request_count: 1 });

    // re-run: no double counting
    await call('POST', '/admin/rollup/run', admin, { date: day }, b.base);
    await call('POST', '/admin/rollup/run', admin, { date: day }, b.base);
    expect(await snapshot()).toEqual(s1);

    // CLI against the disposable DB is also idempotent
    const out = execSync(`npm run rollup -- --date=${day}`, { cwd: ROOT, env: { ...process.env, DATABASE_URL: testDbUrl() }, encoding: 'utf8' });
    expect(out).toContain(day);
    expect(await snapshot()).toEqual(s1);

    // past/today/future guards
    for (const bad of [istDateStr(today), istDateStr(today.plus({ days: 1 }))]) {
      const r = await call('POST', '/admin/rollup/run', admin, { date: bad }, b.base);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('ROLLUP_DATE_NOT_PAST');
    }
    expect((await call('POST', '/admin/rollup/run', admin, { date: 'nope' }, b.base)).status).toBe(400);

    // scheduled at 00:05 IST
    const cron = fs.readFileSync(path.join(ROOT, 'backend/src/jobs/rollup-cron.ts'), 'utf8');
    expect(cron).toContain("'5 0 * * *'");
    expect(cron).toContain("timezone: 'Asia/Kolkata'");
  });
});

test.describe('AC-14 period usage = rollup + unrolled ledger = plain ledger sum', () => {
  test('mixed rolled-up and unrolled days equal the ledger sum for the period', async () => {
    // user period starts 3 days ago (weekday of that day)
    const start = today.minus({ days: 3 });
    expect((await putSettings(admin, { userResetDow: start.weekday }, b.base)).status).toBe(200);
    await withDb(db, async (c) => {
      for (const [n, cost] of [[4, '1.000000'], [3, '0.100001'], [2, '0.200002'], [1, '0.300003'], [0, '0.400004']] as Array<[number, string]>) {
        await seedLedgerRow(c, { userId: A.id, date: d(n), cost });
      }
    });
    await call('POST', '/admin/rollup/run', admin, { date: d(3) }, b.base);
    await call('POST', '/admin/rollup/run', admin, { date: d(2) }, b.base);
    await call('POST', '/admin/rollup/run', admin, { date: d(4) }, b.base);
    const expected = await sumLedger(d(3), istDateStr(today.plus({ days: 1 })), A.id);
    expect(expected).toBe('1.000010');
    const q = await call('GET', '/quota/me', A.token, undefined, b.base);
    expect(q.body.user.usedUsd).toBe(expected);
    // rolling up the remaining past day (d(1)) does not change the answer
    await call('POST', '/admin/rollup/run', admin, { date: d(1) }, b.base);
    const q2 = await call('GET', '/quota/me', A.token, undefined, b.base);
    expect(q2.body.user.usedUsd).toBe(expected);
    // admin summary agrees
    const s = await call('GET', '/admin/usage/summary', admin, undefined, b.base);
    expect(s.body.users.find((u: { userId: string }) => u.userId === A.id).usedUsd).toBe(expected);
  });
});

test.describe('AC-18 user period starts at reset weekday 00:00 IST', () => {
  test('periodStart/resetsAt follow the configured weekday; earlier usage excluded', async () => {
    for (let dow = 1; dow <= 7; dow += 1) {
      expect((await putSettings(admin, { userResetDow: dow }, b.base)).status).toBe(200);
      const q = await call('GET', '/quota/me', A.token, undefined, b.base);
      let s = today;
      while (s.weekday !== dow) s = s.minus({ days: 1 });
      expect(new Date(q.body.user.periodStart).getTime(), `dow ${dow}`).toBe(s.toMillis());
      expect(new Date(q.body.user.resetsAt).getTime()).toBe(s.plus({ days: 7 }).toMillis());
      expect(q.body.user.resetsAtIst).toMatch(/T00:00:00(\.000)?\+05:30$/);
      const expected = await sumLedger(istDateStr(s), istDateStr(s.plus({ days: 7 })), A.id);
      expect(q.body.user.usedUsd).toBe(expected);
    }
    // reset day == today => the period starts today and yesterday's usage does not count
    await putSettings(admin, { userResetDow: today.weekday }, b.base);
    const q = await call('GET', '/quota/me', A.token, undefined, b.base);
    expect(new Date(q.body.user.periodStart).getTime()).toBe(today.toMillis());
    expect(q.body.user.usedUsd).toBe('0.400004');
    // default is Saturday
    await putSettings(admin, { userResetDow: 6 }, b.base);
    const q6 = await call('GET', '/quota/me', A.token, undefined, b.base);
    let sat = today;
    while (sat.weekday !== 6) sat = sat.minus({ days: 1 });
    expect(new Date(q6.body.user.periodStart).getTime()).toBe(sat.toMillis());
  });
});

test.describe('AC-19 system period starts at reset day-of-month 00:00 IST', () => {
  test('periodStart/resetsAt follow day-of-month 1..28; earlier usage excluded', async () => {
    for (const dom of [1, 5, 15, 28]) {
      expect((await putSettings(admin, { systemResetDom: dom }, b.base)).status).toBe(200);
      const q = await call('GET', '/quota/me', A.token, undefined, b.base);
      const s = today.day >= dom ? today.set({ day: dom }) : today.minus({ months: 1 }).set({ day: dom });
      expect(new Date(q.body.system.periodStart).getTime(), `dom ${dom}`).toBe(s.toMillis());
      expect(new Date(q.body.system.resetsAt).getTime()).toBe(s.plus({ months: 1 }).toMillis());
      const expected = await sumLedger(istDateStr(s), istDateStr(s.plus({ months: 1 })));
      expect(q.body.system.usedUsd).toBe(expected);
    }
    // usage before the period start is excluded (period starting today excludes yesterday's rows)
    const dom = Math.min(today.day, 28);
    if (today.day <= 28) {
      await putSettings(admin, { systemResetDom: dom }, b.base);
      const q = await call('GET', '/quota/me', A.token, undefined, b.base);
      expect(q.body.system.usedUsd).toBe(await sumLedger(d(0), istDateStr(today.plus({ days: 1 }))));
      expect(new Decimal(q.body.system.usedUsd).eq('0.400004')).toBe(true);
    }
    await putSettings(admin, { systemResetDom: 1 }, b.base);
  });
});

test.describe('AC-26 per-user per-day breakdown, filters and totals', () => {
  test('rows (tokens, cost, requests, model) filter by date range and user; totals equal ledger', async () => {
    const all = await call('GET', `/admin/usage/daily?from=${d(12)}&to=${d(0)}`, admin, undefined, b.base);
    expect(all.status).toBe(200);
    for (const r of all.body.rows) {
      expect(r).toEqual(expect.objectContaining({
        date: expect.any(String), userId: expect.any(String), userName: expect.any(String), model: expect.any(String),
        inputTokens: expect.any(Number), outputTokens: expect.any(Number), costUsd: expect.any(String), requestCount: expect.any(Number),
      }));
    }
    const ledgerTotal = await sumLedger(d(12), istDateStr(today.plus({ days: 1 })));
    expect(all.body.totals.costUsd).toBe(ledgerTotal);
    const reqs = await withDb(db, async (c) => (await c.query(`SELECT count(*)::int n, sum(input_tokens)::int i, sum(output_tokens)::int o FROM usage_ledger WHERE usage_date BETWEEN $1 AND $2`, [d(12), d(0)])).rows[0]);
    expect(all.body.totals.requestCount).toBe(reqs.n);
    expect(all.body.totals.inputTokens).toBe(reqs.i);
    expect(all.body.totals.outputTokens).toBe(reqs.o);

    // user filter
    const ua = await call('GET', `/admin/usage/daily?from=${d(12)}&to=${d(0)}&userId=${B.id}`, admin, undefined, b.base);
    expect(ua.body.rows.every((r: { userId: string }) => r.userId === B.id)).toBe(true);
    expect(ua.body.totals.costUsd).toBe(await sumLedger(d(12), istDateStr(today.plus({ days: 1 })), B.id));
    // date range filter (single day)
    const one = await call('GET', `/admin/usage/daily?from=${d(10)}&to=${d(10)}`, admin, undefined, b.base);
    expect(one.body.rows.every((r: { date: string }) => r.date === d(10))).toBe(true);
    expect(one.body.rows.length).toBe(3);
    expect(one.body.totals.costUsd).toBe('0.750003');
    // model dimension
    expect(new Set(one.body.rows.map((r: { model: string }) => r.model))).toEqual(new Set(['claude-sonnet-5-5', 'claude-haiku-5-5']));
    // validation
    expect((await call('GET', `/admin/usage/daily?from=${d(0)}&to=${d(5)}`, admin, undefined, b.base)).status).toBe(400);
    expect((await call('GET', `/admin/usage/daily?from=bad&to=${d(5)}`, admin, undefined, b.base)).status).toBe(400);
    expect(MODEL).toBeTruthy();
  });
});
