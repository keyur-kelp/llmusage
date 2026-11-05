import request from 'supertest';
import { Ctx, createCtx, describeDb, insertLedger, makeUser, resetDb } from '../helpers';

describeDb('rollup (AC-13, AC-14)', () => {
  let ctx: Ctx;
  let admin: { id: string; token: string };
  beforeAll(async () => {
    ctx = await createCtx();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => {
    await resetDb(ctx);
    admin = await makeUser(ctx, { role: 'ADMIN' });
  });

  const rollupRows = async (): Promise<Record<string, unknown>[]> =>
    ((await ctx.sequelize.query(
      `SELECT usage_date::text AS d, model, input_tokens::int AS i, output_tokens::int AS o, cost_usd::text AS c, request_count AS n
         FROM usage_daily_rollup ORDER BY d, model`,
    )) as [Record<string, unknown>[], unknown])[0];

  it('AC-13: one row per user/model/day with sums; re-running does not double count', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-03', '1.000000');
    await insertLedger(ctx, u.id, '2026-11-03', '0.500000');
    await insertLedger(ctx, u.id, '2026-11-03', '0.250000', 'claude-haiku-5-5');
    for (let i = 0; i < 3; i++) {
      const r = await request(ctx.app).post('/api/admin/rollup/run').set({ Authorization: `Bearer ${admin.token}` }).send({ date: '2026-11-03' });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ date: '2026-11-03', rows: 2 });
    }
    expect(await rollupRows()).toEqual([
      { d: '2026-11-03', model: 'claude-haiku-5-5', i: 10, o: 5, c: '0.250000', n: 1 },
      { d: '2026-11-03', model: 'claude-sonnet-5-5', i: 20, o: 10, c: '1.500000', n: 2 },
    ]);
  });

  it('refuses today and future dates', async () => {
    for (const date of ['2026-11-05', '2026-11-06']) {
      const r = await request(ctx.app).post('/api/admin/rollup/run').set({ Authorization: `Bearer ${admin.token}` }).send({ date });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('ROLLUP_DATE_NOT_PAST');
    }
  });

  it('defaults to yesterday (IST)', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-04', '1.000000');
    const r = await request(ctx.app).post('/api/admin/rollup/run').set({ Authorization: `Bearer ${admin.token}` }).send({});
    expect(r.body).toEqual({ date: '2026-11-04', rows: 1 });
  });

  it('AC-14: usage with rolled-up + un-rolled days equals the plain ledger sum', async () => {
    const u = await makeUser(ctx);
    const other = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-01', '1.100000');
    await insertLedger(ctx, u.id, '2026-11-02', '2.200000');
    await insertLedger(ctx, other.id, '2026-11-02', '4.000000');
    await insertLedger(ctx, u.id, '2026-11-03', '3.300000');
    await insertLedger(ctx, u.id, '2026-11-05', '0.400000'); // today, never rolled
    const plain = async (userId: string | null): Promise<string> =>
      ((await ctx.sequelize.query(
        `SELECT COALESCE(SUM(cost_usd),0)::text AS s FROM usage_ledger WHERE usage_date >= '2026-11-01' AND usage_date < '2026-12-01'
          AND (CAST(:u AS uuid) IS NULL OR user_id = CAST(:u AS uuid))`,
        { replacements: { u: userId } },
      )) as [{ s: string }[], unknown])[0][0]!.s;
    const repo = ctx.services.repos.usage;
    const check = async (): Promise<void> => {
      expect(await repo.periodCost('2026-11-01', '2026-12-01', null)).toBe(await plain(null));
      expect(await repo.periodCost('2026-11-01', '2026-12-01', u.id)).toBe(await plain(u.id));
    };
    await check();
    await ctx.services.rollup.rollUpDay('2026-11-02');
    await check();
    await ctx.services.rollup.rollUpDay('2026-11-01');
    await ctx.services.rollup.rollUpDay('2026-11-03');
    await check();
    expect(await repo.periodCost('2026-11-01', '2026-12-01', u.id)).toBe('7.000000');
    expect((await repo.costByUser('2026-11-01', '2026-12-01')).get(other.id)).toBe('4.000000');
  });

  it('a rolled-up day is authoritative even for an empty day; daily report is identical before and after', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-02', '2.000000');
    const before = await ctx.services.repos.usage.daily('2026-11-01', '2026-11-05', null);
    await ctx.services.rollup.rollUpDay('2026-11-02');
    const after = await ctx.services.repos.usage.daily('2026-11-01', '2026-11-05', null);
    expect(after).toEqual(before);
  });

  it('catchUp rolls every past unrolled ledger date once and skips today', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-01', '1.000000');
    await insertLedger(ctx, u.id, '2026-11-03', '1.000000');
    await insertLedger(ctx, u.id, '2026-11-05', '1.000000');
    expect(await ctx.services.rollup.catchUp()).toEqual(['2026-11-01', '2026-11-03']);
    expect(await ctx.services.rollup.catchUp()).toEqual([]);
  });
});
