import { Ctx, createCtx, describeDb, makeUser, resetDb } from '../helpers';
import { DateTime } from 'luxon';

describeDb('quota check performance (NFR: p95 <= 100 ms, 20 users x 30 days)', () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await createCtx();
  });
  afterAll(async () => ctx.close());

  it('p95 over 50 runs', async () => {
    await resetDb(ctx);
    const users: string[] = [];
    for (let i = 0; i < 20; i++) users.push((await makeUser(ctx)).id);
    // Bulk-seed ~10 requests per user per day for 30 days (test-only raw SQL).
    await ctx.sequelize.query(`
      INSERT INTO conversations (id, user_id, title) SELECT gen_random_uuid(), id, 'perf' FROM users;
    `);
    for (let day = 0; day < 30; day++) {
      const date = DateTime.fromISO('2026-11-05').minus({ days: day }).toFormat('yyyy-MM-dd');
      await ctx.sequelize.query(
        `WITH m AS (
           INSERT INTO messages (id, conversation_id, role, content, model)
           SELECT gen_random_uuid(), c.id, 'assistant', 'x', 'claude-sonnet-5-5'
             FROM conversations c, generate_series(1, 10)
           RETURNING id, conversation_id
         )
         INSERT INTO usage_ledger (user_id, conversation_id, assistant_message_id, model, input_tokens, output_tokens, cost_usd, litellm_cost_raw, usage_date)
         SELECT c.user_id, m.conversation_id, m.id, 'claude-sonnet-5-5', 10, 5, 0.0001, '0.0001', CAST(:d AS date)
           FROM m JOIN conversations c ON c.id = m.conversation_id`,
        { replacements: { d: date } },
      );
    }
    await ctx.services.rollup.catchUp(); // realistic: past days rolled, today live

    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      const t = process.hrtime.bigint();
      await ctx.services.quota.check(users[i % users.length]!);
      samples.push(Number(process.hrtime.bigint() - t) / 1e6);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1]!;
    console.log(`quota.check p95 = ${p95.toFixed(1)} ms`);
    expect(p95).toBeLessThanOrEqual(100);
  });
});
