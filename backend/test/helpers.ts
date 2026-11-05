import { Express } from 'express';
import request from 'supertest';
import { Sequelize } from 'sequelize';
import { createApp, Services } from '../src/app';
import { createSequelize } from '../src/config/database';
import { initModels } from '../src/models';
import { createLogger } from '../src/lib/logger';
import { LiteLlmGateway } from '../src/services/llm-gateway';
import { hashPassword } from '../src/services/auth-service';
import { FakeLiteLlm } from './fakes/fake-litellm';
import { Writable } from 'stream';

export const hasDb = Boolean(process.env['DATABASE_URL_TEST']);

/** describe() that is reported as skipped (never silently green) when no test DB is configured. */
export const describeDb: jest.Describe = hasDb ? describe : describe.skip;

export const JWT_SECRET = 'test-secret-test-secret-test-secret-123';
export const PASSWORD = 'correct-horse-battery';

export interface Ctx {
  app: Express;
  services: Services;
  sequelize: Sequelize;
  fake: FakeLiteLlm;
  clock: { now: Date };
  logs: string[];
  close(): Promise<void>;
}

export async function createCtx(): Promise<Ctx> {
  const url = process.env['DATABASE_URL_TEST'];
  if (!url) throw new Error('DATABASE_URL_TEST is not set');
  const sequelize = createSequelize(url);
  initModels(sequelize);
  const fake = new FakeLiteLlm();
  const base = await fake.start();
  const logs: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer, _enc, cb) {
      logs.push(chunk.toString());
      cb();
    },
  });
  const logger = createLogger('debug', sink);
  const clock = { now: new Date('2026-11-05T06:00:00Z') }; // Thursday 11:30 IST
  const gateway = new LiteLlmGateway(base, 'fake-key', logger);
  const { app, services } = createApp({ sequelize, gateway, jwtSecret: JWT_SECRET, logger, now: () => clock.now });
  return {
    app,
    services,
    sequelize,
    fake,
    clock,
    logs,
    close: async () => {
      await fake.stop();
      await sequelize.close();
    },
  };
}

export async function resetDb(ctx: Ctx): Promise<void> {
  await ctx.sequelize.query(
    'TRUNCATE usage_rollup_days, usage_daily_rollup, usage_ledger, messages, conversations, users RESTART IDENTITY CASCADE',
  );
  await ctx.sequelize.query(
    `UPDATE settings SET system_quota_usd = 100, default_user_quota_usd = 10, user_reset_dow = 6, system_reset_dom = 1`,
  );
  ctx.fake.reset();
  ctx.clock.now = new Date('2026-11-05T06:00:00Z');
  ctx.logs.length = 0;
}

let seq = 0;
export async function makeUser(
  ctx: Ctx,
  opts: { role?: 'USER' | 'ADMIN'; email?: string; password?: string } = {},
): Promise<{ id: string; email: string; token: string }> {
  seq += 1;
  const email = opts.email ?? `user${seq}@example.com`;
  const user = await ctx.services.repos.users.create({
    email,
    name: `User ${seq}`,
    role: opts.role ?? 'USER',
    passwordHash: await hashPassword(opts.password ?? PASSWORD),
  });
  const res = await request(ctx.app).post('/api/auth/login').send({ email, password: opts.password ?? PASSWORD });
  return { id: user.id, email, token: res.body.token as string };
}

export interface ErrorBody {
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

export interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

export function parseSse(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((b) => b.trim().length > 0)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? 'message';
      const data = /^data: (.+)$/m.exec(block)?.[1] ?? '{}';
      return { event, data: JSON.parse(data) as Record<string, unknown> };
    });
}

/** POST /api/chat/stream and return the parsed SSE events (200) or the JSON error response. */
export async function chat(
  ctx: Ctx,
  token: string,
  body: { model?: string; message: string; conversationId?: string },
): Promise<{ status: number; events: SseEvent[]; json: ErrorBody }> {
  const res = await request(ctx.app)
    .post('/api/chat/stream')
    .set('Authorization', `Bearer ${token}`)
    .buffer(true)
    .parse((r, cb) => {
      let data = '';
      r.on('data', (c: Buffer) => (data += c.toString()));
      r.on('end', () => cb(null, data));
    })
    .send({ model: 'claude-sonnet-5-5', ...body });
  const isSse = String(res.headers['content-type'] ?? '').startsWith('text/event-stream');
  const raw = res.body as string;
  return {
    status: res.status,
    events: isSse ? parseSse(raw) : [],
    json: isSse ? {} : (JSON.parse(raw || '{}') as ErrorBody),
  };
}

export async function insertLedger(
  ctx: Ctx,
  userId: string,
  usageDate: string,
  cost: string,
  model = 'claude-sonnet-5-5',
): Promise<void> {
  await ctx.sequelize.transaction(async (tx) => {
    const conv = await ctx.services.repos.conversations.create(userId, 't', tx);
    const msg = await ctx.services.repos.messages.create(
      { conversationId: conv.id, role: 'assistant', content: 'x', model, createdAt: new Date() },
      tx,
    );
    await ctx.services.repos.usage.insertLedger(
      {
        userId,
        conversationId: conv.id,
        assistantMessageId: msg.id,
        model,
        inputTokens: 10,
        outputTokens: 5,
        costUsd: cost,
        litellmCostRaw: cost,
        litellmCallId: null,
        usageDate,
        createdAt: new Date(`${usageDate}T06:00:00Z`),
      },
      tx,
    );
  });
}
