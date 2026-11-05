import { settingsSchema } from '../../src/services/settings-service';
import { createUserSchema, updateUserSchema } from '../../src/services/user-service';
import { buildHistory, chatBodySchema } from '../../src/services/chat-service';
import { loadEnv } from '../../src/config/env';

const ok = { systemQuotaUsd: '100', defaultUserQuotaUsd: '10.5', userResetDow: 6, systemResetDom: 1 };

describe('settingsSchema', () => {
  it('accepts valid input', () => expect(settingsSchema.safeParse(ok).success).toBe(true));
  it.each([
    ['negative money', { ...ok, systemQuotaUsd: '-1' }],
    ['float number money', { ...ok, systemQuotaUsd: 5 }],
    ['too many decimals', { ...ok, defaultUserQuotaUsd: '1.1234567' }],
    ['dow 0', { ...ok, userResetDow: 0 }],
    ['dow 8', { ...ok, userResetDow: 8 }],
    ['dom 29', { ...ok, systemResetDom: 29 }],
    ['dom 0', { ...ok, systemResetDom: 0 }],
    ['fractional dom', { ...ok, systemResetDom: 1.5 }],
    ['missing field', { systemQuotaUsd: '1' }],
  ])('rejects %s', (_n, input) => expect(settingsSchema.safeParse(input).success).toBe(false));
});

describe('user schemas', () => {
  it('requires password >= 8 and valid role', () => {
    const base = { name: 'A', email: 'a@b.co', role: 'USER' };
    expect(createUserSchema.safeParse({ ...base, password: '1234567' }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, password: '12345678' }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...base, password: '12345678', role: 'ROOT' }).success).toBe(false);
  });
  it('override must be a money string or null', () => {
    expect(updateUserSchema.safeParse({ quotaOverrideUsd: null }).success).toBe(true);
    expect(updateUserSchema.safeParse({ quotaOverrideUsd: '2.5' }).success).toBe(true);
    expect(updateUserSchema.safeParse({ quotaOverrideUsd: '-2' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ quotaOverrideUsd: 2 }).success).toBe(false);
  });
});

describe('chatBodySchema', () => {
  it('bounds message and model', () => {
    expect(chatBodySchema.safeParse({ model: 'm', message: 'hi' }).success).toBe(true);
    expect(chatBodySchema.safeParse({ model: '', message: 'hi' }).success).toBe(false);
    expect(chatBodySchema.safeParse({ model: 'm', message: '' }).success).toBe(false);
    expect(chatBodySchema.safeParse({ model: 'm', message: 'x'.repeat(20001) }).success).toBe(false);
    expect(chatBodySchema.safeParse({ model: 'm', message: 'hi', conversationId: 'nope' }).success).toBe(false);
  });
});

describe('loadEnv', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@localhost:5432/db',
    LITELLM_BASE_URL: 'http://localhost:4000/',
    LITELLM_API_KEY: 'k',
    JWT_SECRET: 'x'.repeat(32),
  };
  it('defaults DEFAULT_MODEL to claude-sonnet-5-5 and accepts an override', () => {
    expect(loadEnv(base).defaultModel).toBe('claude-sonnet-5-5');
    expect(loadEnv({ ...base, DEFAULT_MODEL: '' }).defaultModel).toBe('claude-sonnet-5-5');
    expect(loadEnv({ ...base, DEFAULT_MODEL: 'claude-opus-5-5' }).defaultModel).toBe('claude-opus-5-5');
  });
  it('parses and normalises', () => {
    const e = loadEnv(base);
    expect(e.litellmBaseUrl).toBe('http://localhost:4000');
    expect(e.port).toBe(3000);
    expect(e.cronEnabled).toBe(true);
  });
  it('rejects short JWT secret without echoing it', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
  it('treats blank optional values as unset', () => {
    const e = loadEnv({ ...base, ADMIN_EMAIL: '', ADMIN_PASSWORD: '', DISABLE_CRON: '' });
    expect(e.adminPassword).toBeUndefined();
    expect(e.adminEmail).toBeUndefined();
  });
  it('requires a database config', () => {
    const { DATABASE_URL: _d, ...rest } = base;
    expect(() => loadEnv(rest)).toThrow(/Database not configured/);
  });
  it('builds a URL from PG* vars and disables cron when asked', () => {
    const { DATABASE_URL: _d, ...rest } = base;
    const e = loadEnv({ ...rest, PGHOST: 'h', PGUSER: 'u', PGPASSWORD: 'p@ss', PGDATABASE: 'd', DISABLE_CRON: 'true' });
    expect(e.databaseUrl).toBe('postgres://u:p%40ss@h:5432/d');
    expect(e.cronEnabled).toBe(false);
  });
});

describe('chatBodySchema message', () => {
  const base = { model: 'm' };
  it('rejects whitespace-only messages', () => {
    expect(chatBodySchema.safeParse({ ...base, message: '   \n\t ' }).success).toBe(false);
  });
  it('trims surrounding whitespace', () => {
    const r = chatBodySchema.parse({ ...base, message: '  hi  ' });
    expect(r.message).toBe('hi');
  });
});

describe('buildHistory', () => {
  it('drops empty assistant turns but keeps everything else in order', () => {
    const out = buildHistory([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'ok' },
    ]);
    expect(out).toEqual([
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'ok' },
    ]);
  });
});
