import request from 'supertest';
import jwt from 'jsonwebtoken';
import { Ctx, JWT_SECRET, PASSWORD, createCtx, describeDb, makeUser, resetDb } from '../helpers';
import { bootstrapAdmin } from '../../src/services/admin-bootstrap-service';
import { createLogger } from '../../src/lib/logger';

describeDb('auth (AC-1 to AC-5)', () => {
  let ctx: Ctx;
  beforeAll(async () => {
    ctx = await createCtx();
  });
  afterAll(async () => ctx.close());
  beforeEach(async () => resetDb(ctx));

  it('AC-1: bootstraps the admin once, no duplicate on second start, password not overwritten', async () => {
    const logger = createLogger('silent');
    await bootstrapAdmin(ctx.services.repos, logger, 'Boss@Example.com', 'bootstrap-pass-1');
    await bootstrapAdmin(ctx.services.repos, logger, 'boss@example.com', 'a-different-pass-2');
    const [rows] = await ctx.sequelize.query(`SELECT email, role FROM users`);
    expect(rows).toEqual([{ email: 'boss@example.com', role: 'ADMIN' }]);
    const ok = await request(ctx.app).post('/api/auth/login').send({ email: 'boss@example.com', password: 'bootstrap-pass-1' });
    expect(ok.status).toBe(200);
  });

  it('AC-2: valid login returns token; invalid returns the same 401 for wrong email or password', async () => {
    const u = await makeUser(ctx);
    const good = await request(ctx.app).post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    expect(good.status).toBe(200);
    expect(good.body.token).toEqual(expect.any(String));
    expect(good.body.user).toEqual(expect.objectContaining({ email: u.email, role: 'USER' }));
    expect(JSON.stringify(good.body)).not.toMatch(/hash/i);

    const badPw = await request(ctx.app).post('/api/auth/login').send({ email: u.email, password: 'nope-nope' });
    const badEmail = await request(ctx.app).post('/api/auth/login').send({ email: 'x@y.z', password: PASSWORD });
    expect(badPw.status).toBe(401);
    expect(badEmail.status).toBe(401);
    expect(badPw.body).toEqual(badEmail.body);
    expect(badPw.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(badPw.body.token).toBeUndefined();
  });

  it('AC-2: login is case-insensitive on email', async () => {
    const u = await makeUser(ctx, { email: 'mixed@example.com' });
    const res = await request(ctx.app).post('/api/auth/login').send({ email: 'MiXeD@Example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(u.token).toBeTruthy();
  });

  it('rejects missing, garbage and wrongly-signed tokens with 401', async () => {
    expect((await request(ctx.app).get('/api/auth/me')).status).toBe(401);
    expect((await request(ctx.app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const u = await makeUser(ctx);
    const forged = jwt.sign({ tv: 0 }, 'another-secret-another-secret-123456', { subject: u.id });
    expect((await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });

  it('AC-3: deactivated user cannot log in and existing tokens stop working', async () => {
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const u = await makeUser(ctx);
    expect((await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`)).status).toBe(200);
    const patch = await request(ctx.app)
      .patch(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(patch.status).toBe(200);
    const me = await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`);
    expect([401, 403]).toContain(me.status);
    const login = await request(ctx.app).post('/api/auth/login').send({ email: u.email, password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(login.body.token).toBeUndefined();
  });

  it('password reset invalidates old tokens', async () => {
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const u = await makeUser(ctx);
    const r = await request(ctx.app)
      .post(`/api/admin/users/${u.id}/password`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ password: 'brand-new-pass' });
    expect(r.status).toBe(204);
    expect((await request(ctx.app).get('/api/auth/me').set('Authorization', `Bearer ${u.token}`)).status).toBe(401);
    expect((await request(ctx.app).post('/api/auth/login').send({ email: u.email, password: 'brand-new-pass' })).status).toBe(200);
  });

  it('AC-4: USER gets 403 on every admin API, ADMIN is allowed; role change applies immediately', async () => {
    const admin = await makeUser(ctx, { role: 'ADMIN' });
    const u = await makeUser(ctx);
    const calls: [string, string][] = [
      ['get', '/api/admin/settings'],
      ['get', '/api/admin/users'],
      ['get', '/api/admin/usage/summary'],
      ['get', '/api/admin/usage/daily?from=2026-11-01&to=2026-11-02'],
      ['get', '/api/admin/usage/ledger?from=2026-11-01&to=2026-11-02'],
      ['post', '/api/admin/rollup/run'],
    ];
    for (const [method, url] of calls) {
      const r = await (request(ctx.app) as unknown as Record<string, (u: string) => request.Test>)[method]!(url).set(
        'Authorization',
        `Bearer ${u.token}`,
      );
      expect(r.status).toBe(403);
      expect(r.body.error.code).toBe('FORBIDDEN');
    }
    expect((await request(ctx.app).get('/api/admin/settings').set('Authorization', `Bearer ${admin.token}`)).status).toBe(200);
    await request(ctx.app).patch(`/api/admin/users/${u.id}`).set('Authorization', `Bearer ${admin.token}`).send({ role: 'ADMIN' });
    expect((await request(ctx.app).get('/api/admin/settings').set('Authorization', `Bearer ${u.token}`)).status).toBe(200);
  });

  it('AC-5: password stored as a bcrypt hash; no plaintext in DB or logs', async () => {
    const secret = 'super-secret-pass-9';
    const u = await makeUser(ctx, { password: secret });
    await request(ctx.app).post('/api/auth/login').send({ email: u.email, password: secret });
    await request(ctx.app).post('/api/auth/login').send({ email: u.email, password: 'wrong-wrong-1' });
    const [rows] = (await ctx.sequelize.query(`SELECT password_hash FROM users WHERE id = '${u.id}'`)) as [{ password_hash: string }[], unknown];
    expect(rows[0]!.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(rows[0]!.password_hash).not.toContain(secret);
    const logText = ctx.logs.join('');
    expect(logText).not.toContain(secret);
    expect(logText).not.toContain('wrong-wrong-1');
    expect(logText).not.toContain(u.token);
  });

  it('token is signed HS256 with a 12h expiry', async () => {
    const u = await makeUser(ctx);
    const decoded = jwt.verify(u.token, JWT_SECRET) as jwt.JwtPayload;
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(12 * 3600);
  });
});
