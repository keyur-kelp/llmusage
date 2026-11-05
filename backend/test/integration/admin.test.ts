import request from 'supertest';
import { Ctx, PASSWORD, chat, createCtx, describeDb, insertLedger, makeUser, resetDb } from '../helpers';

describeDb('admin API and settings (AC-20, AC-21, AC-24 to AC-28)', () => {
  let ctx: Ctx;
  let admin: { id: string; email: string; token: string };
  beforeAll(async () => {
    ctx = await createCtx();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDb(ctx);
    admin = await makeUser(ctx, { role: 'ADMIN' });
  });

  const auth = (t = admin.token): { Authorization: string } => ({ Authorization: `Bearer ${t}` });
  const put = (body: unknown) => request(ctx.app).put('/api/admin/settings').set(auth()).send(body as object);
  const valid = { systemQuotaUsd: '50', defaultUserQuotaUsd: '5', userResetDow: 1, systemResetDom: 10 };

  it('AC-24a: defaults after migration', async () => {
    const r = await request(ctx.app).get('/api/admin/settings').set(auth());
    expect(r.body).toEqual(
      expect.objectContaining({ systemQuotaUsd: '100.000000', defaultUserQuotaUsd: '10.000000', userResetDow: 6, systemResetDom: 1 }),
    );
  });

  it('AC-24: saves valid settings and rejects invalid ones', async () => {
    expect((await put(valid)).body).toEqual(expect.objectContaining({ systemQuotaUsd: '50.000000', userResetDow: 1, systemResetDom: 10 }));
    for (const bad of [
      { ...valid, systemQuotaUsd: '-1' },
      { ...valid, defaultUserQuotaUsd: 5 },
      { ...valid, userResetDow: 8 },
      { ...valid, systemResetDom: 29 },
      { ...valid, systemResetDom: 0 },
      { systemQuotaUsd: '1' },
    ]) {
      const r = await put(bad);
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
    }
    // unchanged by failed requests
    const g = await request(ctx.app).get('/api/admin/settings').set(auth());
    expect(g.body.systemResetDom).toBe(10);
  });

  it('AC-20: changed quota and reset day apply to the next message without restart', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-05', '6.000000');
    expect((await chat(ctx, u.token, { message: 'ok' })).events.at(-1)?.event).toBe('done');
    await put({ ...valid, defaultUserQuotaUsd: '5', userResetDow: 6 }); // now 6.123 >= 5
    expect((await chat(ctx, u.token, { message: 'blocked' })).json.error?.code).toBe('USER_QUOTA_EXCEEDED');
    // move the weekly reset to Thursday (dow 4): today (Thu 2026-11-05) starts a new period; the 11-05 usage still counts
    await put({ ...valid, defaultUserQuotaUsd: '50', userResetDow: 4 });
    expect((await chat(ctx, u.token, { message: 'ok again' })).events.at(-1)?.event).toBe('done');
    // move to Friday (5): period began Fri 2026-10-30... usage on 11-05 still within; with Fri->11-06 not yet
    const q = await request(ctx.app).get('/api/quota/me').set(auth(u.token));
    expect(q.body.user.quotaUsd).toBe('50.000000');
  });

  it('AC-18: usage before the period start does not count', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-10-30', '9.000000'); // before Sat 2026-10-31
    await insertLedger(ctx, u.id, '2026-10-31', '1.000000');
    const q = await request(ctx.app).get('/api/quota/me').set(auth(u.token));
    expect(q.body.user.usedUsd).toBe('1.000000');
    expect(q.body.system.usedUsd).toBe('0.000000'); // both rows are in October, previous system month
  });

  it('AC-19: system period honours reset day-of-month', async () => {
    const u = await makeUser(ctx);
    await put({ ...valid, systemResetDom: 4, systemQuotaUsd: '100' });
    await insertLedger(ctx, u.id, '2026-11-03', '2.000000'); // before Nov 4 -> previous period
    await insertLedger(ctx, u.id, '2026-11-04', '3.000000');
    const q = await request(ctx.app).get('/api/quota/me').set(auth(u.token));
    expect(q.body.system.periodStart).toBe('2026-11-03T18:30:00.000Z');
    expect(q.body.system.usedUsd).toBe('3.000000');
    expect(q.body.system.resetsAtIst).toBe('2026-12-04T00:00:00.000+05:30');
  });

  it('AC-21: override beats default; clearing it restores the default', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-05', '2.000000');
    let r = await request(ctx.app).patch(`/api/admin/users/${u.id}`).set(auth()).send({ quotaOverrideUsd: '1.5' });
    expect(r.body.quotaOverrideUsd).toBe('1.500000');
    expect((await chat(ctx, u.token, { message: 'x' })).json.error?.code).toBe('USER_QUOTA_EXCEEDED');
    r = await request(ctx.app).patch(`/api/admin/users/${u.id}`).set(auth()).send({ quotaOverrideUsd: null });
    expect(r.body.quotaOverrideUsd).toBeNull();
    expect((await chat(ctx, u.token, { message: 'x' })).events.at(-1)?.event).toBe('done');
  });

  it('override of 0 blocks the user and shows 0.00%', async () => {
    const u = await makeUser(ctx);
    await request(ctx.app).patch(`/api/admin/users/${u.id}`).set(auth()).send({ quotaOverrideUsd: '0' });
    const q = await request(ctx.app).get('/api/quota/me').set(auth(u.token));
    expect(q.body.user.remainingPct).toBe('0.00');
    expect((await chat(ctx, u.token, { message: 'x' })).status).toBe(429);
  });

  it('AC-27: create user, duplicate email (case-insensitive) rejected, edit, reset password, deactivate/reactivate', async () => {
    const c = await request(ctx.app)
      .post('/api/admin/users')
      .set(auth())
      .send({ name: 'Newbie', email: ' New@Example.com ', password: 'password123', role: 'USER' });
    expect(c.status).toBe(201);
    expect(c.body).toEqual(expect.objectContaining({ email: 'new@example.com', role: 'USER', isActive: true, quotaOverrideUsd: null }));
    expect(JSON.stringify(c.body)).not.toMatch(/hash|password/i);
    const dup = await request(ctx.app)
      .post('/api/admin/users')
      .set(auth())
      .send({ name: 'Dup', email: 'NEW@example.com', password: 'password123', role: 'USER' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
    const short = await request(ctx.app).post('/api/admin/users').set(auth()).send({ name: 'S', email: 's@example.com', password: 'short', role: 'USER' });
    expect(short.status).toBe(400);

    const id = c.body.id as string;
    const e = await request(ctx.app).patch(`/api/admin/users/${id}`).set(auth()).send({ name: 'Renamed', role: 'ADMIN' });
    expect(e.body).toEqual(expect.objectContaining({ name: 'Renamed', role: 'ADMIN' }));
    await request(ctx.app).patch(`/api/admin/users/${id}`).set(auth()).send({ isActive: false });
    expect((await request(ctx.app).post('/api/auth/login').send({ email: 'new@example.com', password: 'password123' })).status).toBe(403);
    await request(ctx.app).patch(`/api/admin/users/${id}`).set(auth()).send({ isActive: true });
    expect((await request(ctx.app).post('/api/auth/login').send({ email: 'new@example.com', password: 'password123' })).status).toBe(200);
    const list = await request(ctx.app).get('/api/admin/users').set(auth());
    expect(list.body.users).toHaveLength(2);
    expect((await request(ctx.app).patch(`/api/admin/users/${'0'.repeat(8)}-0000-4000-8000-${'0'.repeat(12)}`).set(auth()).send({ name: 'x' })).status).toBe(404);
  });

  it('AC-28: admin cannot deactivate self or drop own ADMIN role; other changes to self are fine', async () => {
    for (const body of [{ isActive: false }, { role: 'USER' }]) {
      const r = await request(ctx.app).patch(`/api/admin/users/${admin.id}`).set(auth()).send(body);
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('SELF_LOCKOUT');
    }
    const ok = await request(ctx.app).patch(`/api/admin/users/${admin.id}`).set(auth()).send({ name: 'Me', role: 'ADMIN', isActive: true });
    expect(ok.status).toBe(200);
  });

  it('AC-25: summary shows system MTD vs quota and per-user WTD vs effective quota, sorted by usage', async () => {
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    await insertLedger(ctx, a.id, '2026-11-05', '1.000000');
    await insertLedger(ctx, b.id, '2026-11-05', '3.500000');
    await insertLedger(ctx, b.id, '2026-10-20', '4.000000'); // this month? no: October -> outside Nov period
    await request(ctx.app).patch(`/api/admin/users/${a.id}`).set(auth()).send({ quotaOverrideUsd: '2' });
    const r = await request(ctx.app).get('/api/admin/usage/summary').set(auth());
    expect(r.body.system).toEqual(expect.objectContaining({ quotaUsd: '100.000000', usedUsd: '4.500000', remainingUsd: '95.500000' }));
    expect(r.body.users.map((u: { userId: string }) => u.userId)).toEqual([b.id, a.id, admin.id]);
    expect(r.body.users[0]).toEqual(expect.objectContaining({ usedUsd: '3.500000', quotaUsd: '10.000000', usedPct: '35.00', isOverride: false }));
    expect(r.body.users[1]).toEqual(expect.objectContaining({ usedUsd: '1.000000', quotaUsd: '2.000000', usedPct: '50.00', isOverride: true }));
  });

  it('AC-26: daily breakdown by date/user/model with totals matching the ledger; validates range', async () => {
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    await insertLedger(ctx, a.id, '2026-11-01', '1.000000', 'claude-sonnet-5-5');
    await insertLedger(ctx, a.id, '2026-11-01', '0.250000', 'claude-sonnet-5-5');
    await insertLedger(ctx, a.id, '2026-11-01', '0.500000', 'claude-haiku-5-5');
    await insertLedger(ctx, b.id, '2026-11-02', '2.000000');
    await insertLedger(ctx, b.id, '2026-11-09', '9.000000'); // outside range
    const r = await request(ctx.app).get('/api/admin/usage/daily?from=2026-11-01&to=2026-11-02').set(auth());
    expect(r.status).toBe(200);
    expect(r.body.rows).toHaveLength(3);
    expect(r.body.rows.find((x: { model: string }) => x.model === 'claude-sonnet-5-5' && true)).toEqual(
      expect.objectContaining({ date: '2026-11-01', userId: a.id, costUsd: '1.250000', requestCount: 2, inputTokens: 20, outputTokens: 10 }),
    );
    expect(r.body.totals).toEqual({ inputTokens: 40, outputTokens: 20, costUsd: '3.750000', requestCount: 4 });
    const f = await request(ctx.app).get(`/api/admin/usage/daily?from=2026-11-01&to=2026-11-30&userId=${b.id}`).set(auth());
    expect(f.body.totals.costUsd).toBe('11.000000');
    expect((await request(ctx.app).get('/api/admin/usage/daily?from=2026-11-05&to=2026-11-01').set(auth())).status).toBe(400);
    expect((await request(ctx.app).get('/api/admin/usage/daily?from=2025-01-01&to=2026-11-01').set(auth())).status).toBe(400);
    expect((await request(ctx.app).get('/api/admin/usage/daily?from=bad&to=2026-11-01').set(auth())).status).toBe(400);
  });

  it('ledger endpoint exposes cost and the raw LiteLLM cost for AC-11/12 evidence', async () => {
    const u = await makeUser(ctx);
    ctx.fake.behavior.cost = 0.00004321;
    await chat(ctx, u.token, { message: 'hi' });
    const r = await request(ctx.app).get('/api/admin/usage/ledger?from=2026-11-05&to=2026-11-05').set(auth());
    expect(r.body.rows).toHaveLength(1);
    expect(r.body.rows[0]).toEqual(expect.objectContaining({ costUsd: '0.000043', litellmCostRaw: '0.00004321', litellmCallId: 'fake-call-1', userId: u.id }));
  });

  it('error responses have the standard shape; unknown routes 404', async () => {
    const r = await request(ctx.app).get('/api/nope').set(auth());
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
    const bad = await request(ctx.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(PASSWORD).toBeTruthy();
  });
});
