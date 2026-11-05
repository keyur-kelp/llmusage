import path from 'path';
import { spawn, execSync, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { DateTime } from 'luxon';

export const ROOT = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(ROOT, '.env') });

export const API = process.env['API_URL'] ?? 'http://localhost:3000/api';
export const MODEL = 'claude-sonnet-5-5';
export const ADMIN_EMAIL = process.env['ADMIN_EMAIL'] ?? '';
export const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] ?? '';
export const DEFAULT_SETTINGS = {
  systemQuotaUsd: '0.500000',
  defaultUserQuotaUsd: '0.100000',
  userResetDow: 6,
  systemResetDom: 1,
};

export interface Resp<T = any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  status: number;
  body: T;
}

export async function call<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  method: string,
  p: string,
  token?: string | null,
  body?: unknown,
  base: string = API,
): Promise<Resp<T>> {
  const res = await fetch(base + p, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed as T };
}

export async function login(email: string, password: string, base: string = API): Promise<string> {
  const r = await call<{ token: string }>('POST', '/auth/login', null, { email, password }, base);
  if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status}`);
  return r.body.token;
}

export const adminLogin = (base: string = API): Promise<string> => login(ADMIN_EMAIL, ADMIN_PASSWORD, base);

let seq = 0;
export function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq}`;
}

export interface TestUser { id: string; email: string; password: string; token: string; name: string }

export async function createUser(
  adminToken: string,
  role: 'USER' | 'ADMIN' = 'USER',
  base: string = API,
): Promise<TestUser> {
  const email = `${uniq('qa')}@example.test`;
  const password = `Pw-${uniq('x')}-aA1`;
  const name = `QA ${uniq('n')}`;
  const r = await call('POST', '/admin/users', adminToken, { name, email, password, role }, base);
  if (r.status !== 201) throw new Error(`createUser failed: ${r.status} ${JSON.stringify(r.body)}`);
  const token = await login(email, password, base);
  return { id: r.body.id, email, password, token, name };
}

export interface SseEvent { event: string; data: any } // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ChatResult {
  status: number;
  errorBody?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  events: SseEvent[];
  firstDeltaAtMs?: number;
  doneAtMs?: number;
}

export async function chat(
  token: string,
  body: { conversationId?: string; model?: string; message: string },
  base: string = API,
): Promise<ChatResult> {
  const t0 = Date.now();
  const res = await fetch(base + '/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!(res.headers.get('content-type') ?? '').includes('text/event-stream')) {
    const text = await res.text();
    let j: unknown = text;
    try { j = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, errorBody: j, events: [] };
  }
  const events: SseEvent[] = [];
  let firstDeltaAtMs: number | undefined;
  let doneAtMs: number | undefined;
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let ev = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) ev = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      const parsed = data ? JSON.parse(data) : null;
      if (ev === 'delta' && firstDeltaAtMs === undefined) firstDeltaAtMs = Date.now() - t0;
      if (ev === 'done') doneAtMs = Date.now() - t0;
      events.push({ event: ev, data: parsed });
    }
  }
  return { status: res.status, events, firstDeltaAtMs, doneAtMs };
}

export const answerText = (r: ChatResult): string =>
  r.events.filter((e) => e.event === 'delta').map((e) => e.data.text as string).join('');

export const SHORT = 'Reply with just the word OK.';

export async function putSettings(adminToken: string, patch: Partial<typeof DEFAULT_SETTINGS>, base: string = API): Promise<Resp> {
  const cur = await call('GET', '/admin/settings', adminToken, undefined, base);
  const body = {
    systemQuotaUsd: cur.body.systemQuotaUsd,
    defaultUserQuotaUsd: cur.body.defaultUserQuotaUsd,
    userResetDow: cur.body.userResetDow,
    systemResetDom: cur.body.systemResetDom,
    ...patch,
  };
  return call('PUT', '/admin/settings', adminToken, body, base);
}

export async function restoreDefaults(base: string = API): Promise<void> {
  const t = await adminLogin(base);
  const r = await call('PUT', '/admin/settings', t, DEFAULT_SETTINGS, base);
  if (r.status !== 200) throw new Error('could not restore default settings');
  await clearQaOverrides(t, base);
}

// Test hygiene: clear quota overrides left on throwaway QA users (emails qa-*@example.test).
export async function clearQaOverrides(adminToken: string, base: string = API): Promise<void> {
  const list = await call('GET', '/admin/users', adminToken, undefined, base);
  const users: Array<{ id: string; email: string; quotaOverrideUsd: string | null }> = list.body?.users ?? [];
  for (const u of users) {
    if (/^qa-.*@example\.test$/.test(u.email) && u.quotaOverrideUsd !== null) {
      await call('PATCH', `/admin/users/${u.id}`, adminToken, { quotaOverrideUsd: null }, base);
    }
  }
}

// ---------- database access ----------
export function appDbConfig(): { connectionString?: string } {
  const u = process.env['DATABASE_URL'];
  return u ? { connectionString: u } : {};
}
export function testDbUrl(): string {
  const u = process.env['DATABASE_URL_TEST'];
  if (!u) throw new Error('DATABASE_URL_TEST not set');
  return u;
}
export async function withDb<T>(cfg: { connectionString?: string }, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client(cfg);
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

// ---------- spawned backend against the disposable test DB ----------
export interface SpawnedBackend { base: string; logs: () => string; stop: () => Promise<void>; adminEmail: string; adminPassword: string }

export async function startTestBackend(port: number, opts: { adminEmail: string; adminPassword: string }): Promise<SpawnedBackend> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: testDbUrl(),
    PORT: String(port),
    DISABLE_CRON: 'true',
    ADMIN_EMAIL: opts.adminEmail,
    ADMIN_PASSWORD: opts.adminPassword,
    LOG_LEVEL: 'info',
  };
  const proc: ChildProcess = spawn('npx', ['tsx', 'src/server.ts'], { cwd: path.join(ROOT, 'backend'), env });
  let out = '';
  proc.stdout?.on('data', (d) => (out += d.toString()));
  proc.stderr?.on('data', (d) => (out += d.toString()));
  const base = `http://localhost:${port}/api`;
  const deadline = Date.now() + 45_000;
  for (;;) {
    if (/backend listening/.test(out)) break;
    if (proc.exitCode !== null) throw new Error('test backend exited early');
    if (Date.now() > deadline) { proc.kill(); throw new Error('test backend did not start'); }
    await new Promise((r) => setTimeout(r, 300));
  }
  const stop = async (): Promise<void> => {
    if (proc.exitCode !== null) return;
    // npx spawns a child; kill the process group listener by port as well
    proc.kill('SIGTERM');
    try { execSync(`lsof -ti tcp:${port} -sTCP:LISTEN | xargs -r kill`, { stdio: 'ignore' }); } catch { /* none */ }
    await new Promise((r) => setTimeout(r, 800));
  };
  return { base, logs: () => out, stop, adminEmail: opts.adminEmail, adminPassword: opts.adminPassword };
}

export function resetTestDb(): void {
  const env = { ...process.env, DATABASE_URL: testDbUrl() };
  const cwd = path.join(ROOT, 'backend');
  execSync('npx tsc -p tsconfig.migrations.json', { cwd, env, stdio: 'ignore' });
  execSync('npx sequelize-cli db:migrate:undo:all', { cwd, env, stdio: 'ignore' });
  execSync('npx sequelize-cli db:migrate', { cwd, env, stdio: 'ignore' });
}

// ---------- IST helpers ----------
export const istNow = (): DateTime => DateTime.now().setZone('Asia/Kolkata');
export const istDateStr = (dt: DateTime): string => dt.toFormat('yyyy-MM-dd');

export async function seedLedgerRow(
  c: Client,
  p: { userId: string; date: string; cost: string; model?: string; inTok?: number; outTok?: number },
): Promise<void> {
  const conv = await c.query(`INSERT INTO conversations (user_id, title) VALUES ($1, 'seed') RETURNING id`, [p.userId]);
  const model = p.model ?? MODEL;
  const msg = await c.query(
    `INSERT INTO messages (conversation_id, role, content, model, created_at) VALUES ($1,'assistant','x',$2, ($3::date + time '12:00') AT TIME ZONE 'Asia/Kolkata') RETURNING id`,
    [conv.rows[0].id, model, p.date],
  );
  await c.query(
    `INSERT INTO usage_ledger (user_id, conversation_id, assistant_message_id, model, input_tokens, output_tokens, cost_usd, litellm_cost_raw, usage_date, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$7::text,$8::date, ($8::date + time '12:00') AT TIME ZONE 'Asia/Kolkata')`,
    [p.userId, conv.rows[0].id, msg.rows[0].id, model, p.inTok ?? 10, p.outTok ?? 5, p.cost, p.date],
  );
}
