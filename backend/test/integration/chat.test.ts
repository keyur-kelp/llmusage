import http from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { Ctx, chat, createCtx, describeDb, insertLedger, makeUser, resetDb } from '../helpers';

describeDb('models, chat and conversations', () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await createCtx();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetDb(ctx));

  const count = async (table: string): Promise<number> => {
    const [rows] = (await ctx.sequelize.query(`SELECT COUNT(*)::int AS n FROM ${table}`)) as [{ n: number }[], unknown];
    return rows[0]!.n;
  };

  it('AC-6/29: model list mirrors LiteLLM exactly and in order, with no app change', async () => {
    const u = await makeUser(ctx);
    const a = await request(ctx.app).get('/api/models').set('Authorization', `Bearer ${u.token}`);
    expect(a.body.models.map((m: { id: string }) => m.id)).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5']);
    ctx.fake.behavior.models = ['claude-sonnet-5-5', 'brand-new-model'];
    const b = await request(ctx.app).get('/api/models').set('Authorization', `Bearer ${u.token}`);
    expect(b.body.models).toEqual([{ id: 'claude-sonnet-5-5' }, { id: 'brand-new-model' }]);
    const c = await chat(ctx, u.token, { model: 'brand-new-model', message: 'hi' });
    expect(c.events.at(-1)?.event).toBe('done');
    expect(await count('usage_ledger')).toBe(1);
  });

  it('requires authentication', async () => {
    expect((await request(ctx.app).get('/api/models')).status).toBe(401);
    expect((await request(ctx.app).post('/api/chat/stream').send({})).status).toBe(401);
  });

  it('AC-7/8/11/12: streams deltas, persists the pair and a ledger row with the exact LiteLLM cost', async () => {
    ctx.fake.behavior.cost = 0.0001234567;
    const u = await makeUser(ctx);
    const r = await chat(ctx, u.token, { message: 'What is 2+2?' });
    expect(r.status).toBe(200);
    const deltas = r.events.filter((e) => e.event === 'delta').map((e) => e.data['text']);
    expect(deltas).toEqual(['Hello', ' world']);
    const done = r.events.at(-1)!;
    expect(done.event).toBe('done');
    expect(done.data['usage']).toEqual({ inputTokens: 10, outputTokens: 5, costUsd: '0.000123' });
    expect(ctx.fake.requests[0]).toEqual(expect.objectContaining({ stream: true, streamOptions: { include_usage: true } }));

    const convId = done.data['conversationId'] as string;
    const get = await request(ctx.app).get(`/api/conversations/${convId}`).set('Authorization', `Bearer ${u.token}`);
    expect(get.body.title).toBe('What is 2+2?');
    expect(get.body.messages.map((m: { role: string; content: string; model: string }) => [m.role, m.content, m.model])).toEqual([
      ['user', 'What is 2+2?', 'claude-sonnet-5-5'],
      ['assistant', 'Hello world', 'claude-sonnet-5-5'],
    ]);

    const [rows] = (await ctx.sequelize.query(
      `SELECT user_id, conversation_id, model, input_tokens, output_tokens, cost_usd::text AS cost, litellm_cost_raw, litellm_call_id, usage_date::text AS d
         FROM usage_ledger`,
    )) as [Record<string, unknown>[], unknown];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      user_id: u.id,
      conversation_id: convId,
      model: 'claude-sonnet-5-5',
      input_tokens: 10,
      output_tokens: 5,
      cost: '0.000123',
      litellm_cost_raw: '0.0001234567',
      litellm_call_id: 'fake-call-1',
      d: '2026-11-05',
    });
  });

  it('title is the first 60 chars of the first message', async () => {
    const u = await makeUser(ctx);
    const r = await chat(ctx, u.token, { message: 'a'.repeat(100) });
    const list = await request(ctx.app).get('/api/conversations').set('Authorization', `Bearer ${u.token}`);
    expect(list.body.conversations[0].title).toBe('a'.repeat(60));
    expect(r.events.at(-1)?.event).toBe('done');
  });

  it('AC-9: follow-up sends prior messages as context and appends to the same conversation', async () => {
    const u = await makeUser(ctx);
    const first = await chat(ctx, u.token, { message: 'first question' });
    const convId = first.events.at(-1)!.data['conversationId'] as string;
    ctx.fake.behavior.chunks = ['second', ' answer'];
    await chat(ctx, u.token, { message: 'follow up', conversationId: convId, model: 'claude-haiku-5-5' });
    expect(ctx.fake.requests[1]!.messages).toEqual([
      { role: 'user', content: 'first question' },
      { role: 'assistant', content: 'Hello world' },
      { role: 'user', content: 'follow up' },
    ]);
    expect(ctx.fake.requests[1]!.model).toBe('claude-haiku-5-5');
    const get = await request(ctx.app).get(`/api/conversations/${convId}`).set('Authorization', `Bearer ${u.token}`);
    expect(get.body.messages).toHaveLength(4);
    expect(get.body.messages[3].model).toBe('claude-haiku-5-5');
    expect(await count('conversations')).toBe(1);
    expect(await count('usage_ledger')).toBe(2);
  });

  it('AC-10: users see only their own conversations; others (admins too) get 404', async () => {
    const a = await makeUser(ctx);
    const b = await makeUser(ctx);
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const r = await chat(ctx, a.token, { message: 'private' });
    const id = r.events.at(-1)!.data['conversationId'] as string;
    for (const t of [b.token, admin.token]) {
      expect((await request(ctx.app).get(`/api/conversations/${id}`).set('Authorization', `Bearer ${t}`)).status).toBe(404);
      const list = await request(ctx.app).get('/api/conversations').set('Authorization', `Bearer ${t}`);
      expect(list.body.conversations).toEqual([]);
      const c = await chat(ctx, t, { message: 'sneaky', conversationId: id });
      expect(c.status).toBe(404);
    }
    expect((await request(ctx.app).get('/api/conversations/not-a-uuid').set('Authorization', `Bearer ${a.token}`)).status).toBe(404);
  });

  it('rejects unknown models with MODEL_NOT_AVAILABLE and makes no chat call', async () => {
    const u = await makeUser(ctx);
    const r = await chat(ctx, u.token, { model: 'gpt-nope', message: 'hi' });
    expect(r.status).toBe(400);
    expect(r.json.error?.code).toBe('MODEL_NOT_AVAILABLE');
    expect(ctx.fake.requests).toHaveLength(0);
  });

  it('validates the body', async () => {
    const u = await makeUser(ctx);
    const r = await chat(ctx, u.token, { message: '' });
    expect(r.status).toBe(400);
    expect(r.json.error?.code).toBe('VALIDATION_ERROR');
  });

  it('AC-15: user over quota is blocked before any LLM call, with reset time and no rows written', async () => {
    const u = await makeUser(ctx);
    await insertLedger(ctx, u.id, '2026-11-05', '10.000000'); // Thursday; week started Sat 2026-10-31
    const ledgerBefore = await count('usage_ledger');
    const r = await chat(ctx, u.token, { message: 'hi' });
    expect(r.status).toBe(429);
    expect(r.json.error?.code).toBe('USER_QUOTA_EXCEEDED');
    expect(r.json.error?.details).toEqual(
      expect.objectContaining({ limit: 'USER', resetsAtIst: '2026-11-07T00:00:00.000+05:30', quotaUsd: '10.000000', usedUsd: '10.000000' }),
    );
    expect(ctx.fake.requests).toHaveLength(0);
    expect(await count('usage_ledger')).toBe(ledgerBefore);
    expect(await count('messages')).toBe(ledgerBefore); // only the seeded assistant message
    // other users continue
    const other = await makeUser(ctx);
    expect((await chat(ctx, other.token, { message: 'hi' })).events.at(-1)?.event).toBe('done');
  });

  it('AC-16: system quota blocks everyone, even users with personal quota left; system reported first', async () => {
    const heavy = await makeUser(ctx);
    const light = await makeUser(ctx);
    await ctx.sequelize.query(`UPDATE settings SET system_quota_usd = 5`);
    await insertLedger(ctx, heavy.id, '2026-11-02', '5.000000');
    const r = await chat(ctx, light.token, { message: 'hi' });
    expect(r.status).toBe(429);
    expect(r.json.error?.code).toBe('SYSTEM_QUOTA_EXCEEDED');
    expect(r.json.error?.details).toEqual(expect.objectContaining({ limit: 'SYSTEM', resetsAtIst: '2026-12-01T00:00:00.000+05:30' }));
    expect(ctx.fake.requests).toHaveLength(0);
    // heavy user is over both: system wins
    await ctx.sequelize.query(`UPDATE settings SET default_user_quota_usd = 1`);
    expect((await chat(ctx, heavy.token, { message: 'hi' })).json.error?.code).toBe('SYSTEM_QUOTA_EXCEEDED');
  });

  it('AC-17: usage below quota is allowed even when the call overshoots; the next one is blocked', async () => {
    const u = await makeUser(ctx);
    await ctx.sequelize.query(`UPDATE settings SET default_user_quota_usd = 0.000100`);
    ctx.fake.behavior.cost = 0.5;
    const first = await chat(ctx, u.token, { message: 'one' });
    expect(first.events.at(-1)?.event).toBe('done');
    const quota = (first.events.at(-1)!.data['quota'] as { user: { remainingUsd: string; usedUsd: string } }).user;
    expect(quota.usedUsd).toBe('0.500000');
    expect(quota.remainingUsd).toBe('0.000000');
    const second = await chat(ctx, u.token, { message: 'two' });
    expect(second.status).toBe(429);
    expect(second.json.error?.code).toBe('USER_QUOTA_EXCEEDED');
  });

  it('AC-22: done event and /quota/me report remaining USD and %', async () => {
    const u = await makeUser(ctx);
    ctx.fake.behavior.cost = 1.234567;
    const r = await chat(ctx, u.token, { message: 'hi' });
    const q = r.events.at(-1)!.data['quota'] as Record<string, Record<string, unknown>>;
    expect(q['user']).toEqual(expect.objectContaining({ quotaUsd: '10.000000', usedUsd: '1.234567', remainingUsd: '8.765433', remainingPct: '87.65', isOverride: false }));
    expect(q['system']).toEqual(expect.objectContaining({ quotaUsd: '100.000000', remainingUsd: '98.765433', remainingPct: '98.77' }));
    const me = await request(ctx.app).get('/api/quota/me').set('Authorization', `Bearer ${u.token}`);
    expect(me.body).toEqual(q);
  });

  it('LLM failure: error event, nothing persisted (not even the user message)', async () => {
    const u = await makeUser(ctx);
    ctx.fake.behavior.failStatus = 500;
    const r = await chat(ctx, u.token, { message: 'will fail' });
    expect(r.status).toBe(200);
    expect(r.events.at(-1)).toEqual({ event: 'error', data: expect.objectContaining({ code: 'LLM_UNAVAILABLE' }) });
    expect(await count('messages')).toBe(0);
    expect(await count('conversations')).toBe(0);
    expect(await count('usage_ledger')).toBe(0);
  });

  it('missing cost in the final chunk: error event, nothing persisted (no fallback pricing)', async () => {
    const u = await makeUser(ctx);
    ctx.fake.behavior.cost = undefined;
    const r = await chat(ctx, u.token, { message: 'no cost' });
    expect(r.events.at(-1)?.event).toBe('error');
    expect(await count('usage_ledger')).toBe(0);
    expect(await count('messages')).toBe(0);
  });

  it('stream dropped mid-way: error event, nothing persisted', async () => {
    const u = await makeUser(ctx);
    ctx.fake.behavior.dropMidStream = true;
    const r = await chat(ctx, u.token, { message: 'drop' });
    expect(r.events.at(-1)?.event).toBe('error');
    expect(await count('usage_ledger')).toBe(0);
  });

  it('admin chat usage counts against the system quota (AC-16 includes admins)', async () => {
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    await chat(ctx, admin.token, { message: 'hi' });
    const me = await request(ctx.app).get('/api/quota/me').set('Authorization', `Bearer ${admin.token}`);
    expect(me.body.system.usedUsd).toBe('0.000123');
  });

  it('client disconnect mid-stream: upstream is still consumed and the ledger row is written', async () => {
    const u = await makeUser(ctx);
    ctx.fake.behavior.chunks = ['a', 'b', 'c', 'd'];
    ctx.fake.behavior.chunkDelayMs = 80;
    const server = http.createServer(ctx.app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    await new Promise<void>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port, path: '/api/chat/stream', method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${u.token}` } },
        (res) => {
          res.once('data', () => {
            req.destroy();
            resolve();
          });
        },
      );
      req.on('error', () => undefined);
      req.write(JSON.stringify({ model: 'claude-sonnet-5-5', message: 'bye' }));
      req.end();
      setTimeout(() => reject(new Error('no data received')), 5000);
    });
    let n = 0;
    for (let i = 0; i < 40 && n === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
      n = await count('usage_ledger');
    }
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    expect(n).toBe(1);
    expect(await count('messages')).toBe(2);
  });
});
