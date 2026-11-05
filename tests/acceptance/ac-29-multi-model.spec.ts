import { test, expect } from '@playwright/test';
import { Decimal } from 'decimal.js';
import { SHORT, adminLogin, call, chat, createUser, istDateStr, istNow, putSettings, restoreDefaults } from './helpers';

const LITELLM = process.env['LITELLM_BASE_URL'] ?? 'http://localhost:4000';
const KEY = (): string => process.env['LITELLM_MASTER_KEY'] ?? '';
const ALIAS = `qa-extra-${Date.now().toString(36)}`;

test.afterAll(async () => { await restoreDefaults(); });

test.describe('AC-29 new LiteLLM model appears and is tracked/enforced with no app change', () => {
  test('model added through LiteLLM API shows in picker, is ledgered, counts toward quotas', async () => {
    test.setTimeout(120_000);
    const admin = await adminLogin();
    const u = await createUser(admin);
    const before = ((await call('GET', '/models', u.token)).body.models as Array<{ id: string }>).map((m) => m.id);
    expect(before).not.toContain(ALIAS);

    const add = await fetch(`${LITELLM}/model/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
      body: JSON.stringify({ model_name: ALIAS, litellm_params: { model: 'anthropic/claude-haiku-5-5', litellm_credential_name: 'anthropic' } }),
    });
    expect(add.status).toBe(200);
    const added = (await add.json()) as { model_id?: string; model_info?: { id?: string } };
    const modelId = added.model_id ?? added.model_info?.id;
    try {
      let ids: string[] = [];
      for (let i = 0; i < 15; i += 1) {
        ids = ((await call('GET', '/models', u.token)).body.models as Array<{ id: string }>).map((m) => m.id);
        if (ids.includes(ALIAS)) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      expect(ids).toContain(ALIAS);
      expect(ids.length).toBe(before.length + 1);

      const r = await chat(u.token, { model: ALIAS, message: SHORT });
      expect(r.status).toBe(200);
      const done = r.events.find((e) => e.event === 'done')!.data;
      const t = istDateStr(istNow());
      const led = await call('GET', `/admin/usage/ledger?from=${t}&to=${t}&userId=${u.id}`, admin);
      expect(led.body.rows.length).toBe(1);
      expect(led.body.rows[0].model).toBe(ALIAS);
      expect(new Decimal(led.body.rows[0].costUsd).gt(0)).toBe(true);
      const q = await call('GET', '/quota/me', u.token);
      expect(q.body.user.usedUsd).toBe(done.usage.costUsd);
      const conv = await call('GET', `/conversations/${done.conversationId}`, u.token);
      expect(conv.body.messages[1].model).toBe(ALIAS);

      // counts against quota: tiny override blocks the next message with the new model
      await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: '0.000001' });
      const blocked = await chat(u.token, { model: ALIAS, message: SHORT });
      expect(blocked.status).toBe(429);
      expect(blocked.errorBody.error.code).toBe('USER_QUOTA_EXCEEDED');
      // and counts against the system quota too
      await call('PATCH', `/admin/users/${u.id}`, admin, { quotaOverrideUsd: null });
    } finally {
      if (modelId) {
        await fetch(`${LITELLM}/model/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY()}` },
          body: JSON.stringify({ id: modelId }),
        });
      }
      await restoreDefaults();
    }
    let gone = false;
    for (let i = 0; i < 10 && !gone; i += 1) {
      const ids = ((await call('GET', '/models', u.token)).body.models as Array<{ id: string }>).map((m) => m.id);
      gone = !ids.includes(ALIAS);
      if (!gone) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(gone).toBe(true);
    expect(putSettings).toBeDefined();
  });
});
