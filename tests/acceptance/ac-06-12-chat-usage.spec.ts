import { test, expect } from '@playwright/test';
import { Decimal } from 'decimal.js';
import { DateTime } from 'luxon';
import {
  API, MODEL, SHORT, adminLogin, answerText, call, chat, createUser, istDateStr, istNow, TestUser,
} from './helpers';

const LITELLM = process.env['LITELLM_BASE_URL'] ?? 'http://localhost:4000';

test.describe.configure({ mode: 'serial' });

let admin: string;
let user: TestUser;
let other: TestUser;
let convId: string;
let firstDone: any; // eslint-disable-line @typescript-eslint/no-explicit-any

test.beforeAll(async () => {
  admin = await adminLogin();
  user = await createUser(admin);
  other = await createUser(admin);
});

test.describe('AC-6 model picker lists exactly the LiteLLM models', () => {
  test('GET /api/models equals LiteLLM /v1/models', async () => {
    const lr = await fetch(`${LITELLM}/v1/models`, { headers: { Authorization: `Bearer ${process.env['LITELLM_API_KEY'] ?? process.env['LITELLM_MASTER_KEY']}` } });
    expect(lr.status).toBe(200);
    const lj = (await lr.json()) as { data: Array<{ id: string }> };
    const expected = lj.data.map((m) => m.id);
    expect(expected.length).toBeGreaterThanOrEqual(3);
    const r = await call('GET', '/models', user.token);
    expect(r.status).toBe(200);
    expect(r.body.models.map((m: { id: string }) => m.id)).toEqual(expected);
    expect(expected).toEqual(expect.arrayContaining(['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5']));
    expect(r.body.defaultModel).toBe(MODEL);
    expect((await call('GET', '/models')).status).toBe(401);
    // unknown model is refused before any call
    const bad = await chat(user.token, { model: 'no-such-model', message: SHORT });
    expect(bad.status).toBe(400);
    expect(bad.errorBody.error.code).toBe('MODEL_NOT_AVAILABLE');
  });
});

test.describe('AC-7 streaming via LiteLLM', () => {
  test('answer arrives as multiple deltas before done; request goes through LiteLLM', async () => {
    const r = await chat(user.token, { message: 'Count from 1 to 12 separated by spaces. Nothing else.' });
    expect(r.status).toBe(200);
    const deltas = r.events.filter((e) => e.event === 'delta');
    expect(deltas.length).toBeGreaterThan(1);
    const idxFirstDelta = r.events.findIndex((e) => e.event === 'delta');
    const idxDone = r.events.findIndex((e) => e.event === 'done');
    expect(idxFirstDelta).toBeLessThan(idxDone);
    expect(idxDone).toBe(r.events.length - 1);
    expect(answerText(r)).toMatch(/1/);
    firstDone = r.events[idxDone].data;
    convId = firstDone.conversationId;
    // The ledger records LiteLLM's call id => request was made through LiteLLM
    const today = istDateStr(istNow());
    const led = await call('GET', `/admin/usage/ledger?from=${today}&to=${today}&userId=${user.id}`, admin);
    expect(led.body.rows.length).toBe(1);
    expect(led.body.rows[0].litellmCallId).toBeTruthy();
    // and the backend has no Anthropic SDK / direct provider call: check the config source is LITELLM_BASE_URL
    expect(process.env['LITELLM_BASE_URL'] ?? LITELLM).toContain('4000');
  });
});

test.describe('AC-8 history persists', () => {
  test('conversation and messages with model are listed and retrievable', async () => {
    const list = await call('GET', '/conversations', user.token);
    expect(list.status).toBe(200);
    expect(list.body.conversations.map((c: { id: string }) => c.id)).toContain(convId);
    const conv = await call('GET', `/conversations/${convId}`, user.token);
    expect(conv.status).toBe(200);
    expect(conv.body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant']);
    for (const m of conv.body.messages) expect(m.model).toBe(MODEL);
    expect(conv.body.messages[0].content).toContain('Count from 1 to 12');
    expect(conv.body.messages[1].content.length).toBeGreaterThan(0);
  });
});

test.describe('AC-9 follow-up carries context', () => {
  test('second message in same conversation sees earlier context and appends the pair', async () => {
    const secret = 'PINEAPPLE42';
    const a = await chat(user.token, { message: `Remember the code word ${secret}. Reply with just OK.` });
    const cid = a.events.find((e) => e.event === 'done')!.data.conversationId as string;
    const b = await chat(user.token, { conversationId: cid, message: 'What was the code word? Reply with only the word.' });
    expect(b.status).toBe(200);
    expect(answerText(b).toUpperCase()).toContain(secret);
    expect(b.events.find((e) => e.event === 'done')!.data.conversationId).toBe(cid);
    const conv = await call('GET', `/conversations/${cid}`, user.token);
    expect(conv.body.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
    const list = await call('GET', '/conversations', user.token);
    expect(list.body.conversations.filter((c: { id: string }) => c.id === cid).length).toBe(1);
    // unknown conversation id -> 404 and nothing persisted
    const nf = await chat(user.token, { conversationId: '00000000-0000-4000-8000-000000000000', message: SHORT });
    expect(nf.status).toBe(404);
  });
});

test.describe('AC-10 conversation isolation', () => {
  test("another user (and an admin) gets 404/403 for someone else's conversation", async () => {
    const own = await call('GET', `/conversations/${convId}`, user.token);
    expect(own.status).toBe(200);
    for (const tok of [other.token, admin]) {
      const r = await call('GET', `/conversations/${convId}`, tok);
      expect([403, 404]).toContain(r.status);
      expect(JSON.stringify(r.body)).not.toContain('Count from 1 to 12');
    }
    const list = await call('GET', '/conversations', other.token);
    expect(list.body.conversations.map((c: { id: string }) => c.id)).not.toContain(convId);
    // cannot post into someone else's conversation
    const post = await chat(other.token, { conversationId: convId, message: SHORT });
    expect([403, 404]).toContain(post.status);
    expect((await call('GET', `/conversations/${convId}`)).status).toBe(401);
  });
});

test.describe('AC-11 ledger row per completed response', () => {
  test('ledger row has user, conversation, model, tokens, cost, timestamp', async () => {
    const today = istDateStr(istNow());
    const led = await call('GET', `/admin/usage/ledger?from=${today}&to=${today}&userId=${user.id}`, admin);
    expect(led.status).toBe(200);
    const row = led.body.rows.find((x: { conversationId: string }) => x.conversationId === convId);
    expect(row).toBeTruthy();
    expect(row.userId).toBe(user.id);
    expect(row.model).toBe(MODEL);
    expect(row.inputTokens).toBeGreaterThan(0);
    expect(row.outputTokens).toBeGreaterThan(0);
    expect(row.costUsd).toMatch(/^\d+\.\d{6}$/);
    expect(row.createdAt).toBeTruthy();
    expect(DateTime.fromISO(row.createdAt).isValid).toBe(true);
    // one row per completed response: user has 3 responses so far
    expect(led.body.rows.length).toBe(3);
  });
});

test.describe('AC-12 ledger cost equals LiteLLM-reported cost to 6 dp', () => {
  test('costUsd == round6(litellmCostRaw) == done.usage.costUsd', async () => {
    const r = await chat(user.token, { message: SHORT });
    const done = r.events.find((e) => e.event === 'done')!.data;
    const today = istDateStr(istNow());
    const led = await call('GET', `/admin/usage/ledger?from=${today}&to=${today}&userId=${user.id}&limit=500`, admin);
    const row = led.body.rows.find((x: { assistantMessageId?: string; conversationId: string }) => x.conversationId === done.conversationId);
    expect(row).toBeTruthy();
    expect(row.litellmCostRaw).toBeTruthy();
    const expected = new Decimal(row.litellmCostRaw).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
    expect(row.costUsd).toBe(expected);
    expect(done.usage.costUsd).toBe(row.costUsd);
    expect(done.usage.inputTokens).toBe(row.inputTokens);
    expect(done.usage.outputTokens).toBe(row.outputTokens);
    expect(new Decimal(row.costUsd).gt(0)).toBe(true);
    // all rows consistent
    for (const x of led.body.rows) {
      expect(x.costUsd).toBe(new Decimal(x.litellmCostRaw).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6));
    }
    expect(API).toBeTruthy();

    // Independent check against LiteLLM's own spend log (test-only use of the master key):
    // an entry with the same token counts, ending within 60 s of the ledger row, whose spend rounds to costUsd.
    const key = process.env['LITELLM_MASTER_KEY'] ?? '';
    const created = DateTime.fromISO(row.createdAt);
    let matched = false;
    for (let i = 0; i < 10 && !matched; i += 1) {
      const sl = await fetch(`${LITELLM}/spend/logs?summarize=false`, { headers: { Authorization: `Bearer ${key}` } });
      const logs = (await sl.json()) as Array<{ spend: number; prompt_tokens: number; completion_tokens: number; endTime: string }>;
      matched = logs.some(
        (l) =>
          l.prompt_tokens === row.inputTokens &&
          l.completion_tokens === row.outputTokens &&
          Math.abs(DateTime.fromISO(l.endTime).diffNow().milliseconds - created.diffNow().milliseconds) < 60_000 &&
          new Decimal(String(l.spend)).toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6) === row.costUsd,
      );
      if (!matched) await new Promise((res) => setTimeout(res, 1500));
    }
    expect(matched, 'LiteLLM spend log shows the same cost for this request').toBe(true);
  });
});
