import { test, expect } from '@playwright/test';
import {
  API, ADMIN_EMAIL, adminLogin, call, createUser, login, uniq, withDb, appDbConfig, testDbUrl,
  resetTestDb, startTestBackend, SpawnedBackend,
} from './helpers';

test.describe('AC-1 admin seeded from env, no duplicate on second start', () => {
  test.describe.configure({ mode: 'serial' });
  const adminEmail = `qa-seed-${Date.now()}@example.test`;
  const adminPassword = `Seed-${uniq('p')}-Zz9`;
  let b: SpawnedBackend | undefined;

  test('first start creates an ADMIN; second start creates no duplicate', async () => {
    test.setTimeout(150_000);
    resetTestDb(); // fresh, empty disposable DB (never the app DB)
    const count = (): Promise<{ n: number; role: string | null }> =>
      withDb({ connectionString: testDbUrl() }, async (c) => {
        const r = await c.query(`SELECT count(*)::int AS n, max(role::text) AS role FROM users WHERE lower(email) = lower($1)`, [adminEmail]);
        return r.rows[0];
      });
    expect((await count()).n).toBe(0);

    b = await startTestBackend(3101, { adminEmail, adminPassword });
    let c = await count();
    expect(c).toEqual({ n: 1, role: 'ADMIN' });
    const t = await login(adminEmail, adminPassword, b.base);
    const me = await call('GET', '/auth/me', t, undefined, b.base);
    expect(me.body.role).toBe('ADMIN');
    await b.stop();

    b = await startTestBackend(3101, { adminEmail, adminPassword });
    c = await count();
    expect(c).toEqual({ n: 1, role: 'ADMIN' });
    await b.stop();
    b = undefined;
  });
  test.afterAll(async () => { await b?.stop(); });
});

test.describe('AC-2 login', () => {
  test('valid credentials return a token that works; invalid return error and no token', async () => {
    const admin = await adminLogin();
    const u = await createUser(admin);
    const ok = await call('POST', '/auth/login', null, { email: u.email, password: u.password });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.token).toBe('string');
    expect(ok.body.user.email).toBe(u.email);
    expect(JSON.stringify(ok.body)).not.toMatch(/password/i);
    const me = await call('GET', '/auth/me', ok.body.token);
    expect(me.status).toBe(200);

    const badPw = await call('POST', '/auth/login', null, { email: u.email, password: 'wrong-password-1' });
    expect(badPw.status).toBe(401);
    expect(badPw.body.token).toBeUndefined();
    expect(badPw.body.error.code).toBe('INVALID_CREDENTIALS');
    const badEmail = await call('POST', '/auth/login', null, { email: 'nobody@example.test', password: 'wrong-password-1' });
    expect(badEmail.status).toBe(401);
    expect(badEmail.body.error.message).toBe(badPw.body.error.message);
    const noTok = await call('GET', '/auth/me');
    expect(noTok.status).toBe(401);
    const junk = await call('GET', '/auth/me', 'not.a.jwt');
    expect(junk.status).toBe(401);
  });
});

test.describe('AC-3 deactivated user rejected', () => {
  test('login and existing token both rejected; reactivation restores access', async () => {
    const admin = await adminLogin();
    const u = await createUser(admin);
    expect((await call('GET', '/auth/me', u.token)).status).toBe(200);
    const d = await call('PATCH', `/admin/users/${u.id}`, admin, { isActive: false });
    expect(d.status).toBe(200);
    const l = await call('POST', '/auth/login', null, { email: u.email, password: u.password });
    expect([401, 403]).toContain(l.status);
    expect(l.body.token).toBeUndefined();
    for (const p of ['/auth/me', '/models', '/quota/me', '/conversations']) {
      const r = await call('GET', p, u.token);
      expect([401, 403], p).toContain(r.status);
    }
    const chatR = await call('POST', '/chat/stream', u.token, { model: 'claude-sonnet-5-5', message: 'hi' });
    expect([401, 403]).toContain(chatR.status);
    await call('PATCH', `/admin/users/${u.id}`, admin, { isActive: true });
    expect((await call('POST', '/auth/login', null, { email: u.email, password: u.password })).status).toBe(200);
  });
});

test.describe('AC-4 role enforcement', () => {
  test('USER gets 403 on every admin API; ADMIN allowed', async () => {
    const admin = await adminLogin();
    const u = await createUser(admin, 'USER');
    const id = u.id;
    const calls: Array<[string, string, unknown?]> = [
      ['GET', '/admin/settings'],
      ['PUT', '/admin/settings', { systemQuotaUsd: '1', defaultUserQuotaUsd: '1', userResetDow: 1, systemResetDom: 1 }],
      ['GET', '/admin/users'],
      ['POST', '/admin/users', { name: 'x', email: 'x@example.test', password: 'abcdefgh1', role: 'USER' }],
      ['PATCH', `/admin/users/${id}`, { role: 'ADMIN' }],
      ['POST', `/admin/users/${id}/password`, { password: 'abcdefgh1' }],
      ['GET', '/admin/usage/summary'],
      ['GET', '/admin/usage/daily?from=2026-01-01&to=2026-01-02'],
      ['GET', '/admin/usage/ledger?from=2026-01-01&to=2026-01-02'],
      ['POST', '/admin/rollup/run', {}],
    ];
    for (const [m, p, b] of calls) {
      const r = await call(m, p, u.token, b);
      expect(r.status, `${m} ${p}`).toBe(403);
    }
    // role unchanged after the attempted self-escalation
    const me = await call('GET', '/auth/me', u.token);
    expect(me.body.role).toBe('USER');
    for (const p of ['/admin/settings', '/admin/users', '/admin/usage/summary']) {
      expect((await call('GET', p, admin)).status, p).toBe(200);
    }
    // unauthenticated is 401
    expect((await call('GET', '/admin/settings')).status).toBe(401);
    // role change applies immediately to an existing token
    await call('PATCH', `/admin/users/${id}`, admin, { role: 'ADMIN' });
    expect((await call('GET', '/admin/settings', u.token)).status).toBe(200);
  });
});

test.describe('AC-5 passwords stored only as salted hashes, never logged', () => {
  test('DB holds bcrypt hashes (salted), no plaintext; logs contain no password', async () => {
    test.setTimeout(150_000);
    const admin = await adminLogin();
    const pw = `Same-${uniq('pw')}-Q1`;
    const e1 = `${uniq('h1')}@example.test`;
    const e2 = `${uniq('h2')}@example.test`;
    for (const e of [e1, e2]) {
      const r = await call('POST', '/admin/users', admin, { name: 'Hash', email: e, password: pw, role: 'USER' });
      expect(r.status).toBe(201);
      expect(JSON.stringify(r.body)).not.toContain(pw);
    }
    await withDb(appDbConfig(), async (c) => {
      const r = await c.query(`SELECT email, password_hash FROM users WHERE email = ANY($1)`, [[e1, e2]]);
      expect(r.rowCount).toBe(2);
      for (const row of r.rows) {
        expect(row.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
        expect(row.password_hash).not.toContain(pw);
      }
      expect(r.rows[0].password_hash).not.toBe(r.rows[1].password_hash); // salted
      const admins = await c.query(`SELECT password_hash FROM users WHERE lower(email)=lower($1)`, [ADMIN_EMAIL]);
      expect(admins.rows[0].password_hash).toMatch(/^\$2[aby]\$/);
      const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='users'`);
      expect(cols.rows.map((x) => x.column_name)).not.toContain('password');
    });

    // logs: spawn a backend on the disposable DB, exercise password flows, scan its logs
    resetTestDb();
    const ae = `qa-log-${Date.now()}@example.test`;
    const ap = `LogAdmin-${uniq('p')}-Y7`;
    const b = await startTestBackend(3103, { adminEmail: ae, adminPassword: ap });
    try {
      const t = await login(ae, ap, b.base);
      const up = `LogUser-${uniq('p')}-K3`;
      const ue = `${uniq('lg')}@example.test`;
      const cr = await call('POST', '/admin/users', t, { name: 'L', email: ue, password: up, role: 'USER' }, b.base);
      const id = cr.body.id as string;
      const wrong = `Wrong-${uniq('p')}-X5`;
      await call('POST', '/auth/login', null, { email: ue, password: wrong }, b.base);
      const np = `NewPw-${uniq('p')}-M2`;
      await call('POST', `/admin/users/${id}/password`, t, { password: np }, b.base);
      const tok = await login(ue, np, b.base);
      await call('GET', '/auth/me', tok, undefined, b.base);
      await new Promise((r) => setTimeout(r, 500));
      const logs = b.logs();
      expect(logs.length).toBeGreaterThan(100);
      for (const secret of [ap, up, wrong, np, tok, t]) expect(logs).not.toContain(secret);
    } finally {
      await b.stop();
    }
  });
});
