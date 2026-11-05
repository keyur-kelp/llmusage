import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_TEST: z.string().min(1).optional(),
  PGHOST: z.string().optional(),
  PGPORT: z.string().optional(),
  PGUSER: z.string().optional(),
  PGPASSWORD: z.string().optional(),
  PGDATABASE: z.string().optional(),
  LITELLM_BASE_URL: z.string().url(),
  LITELLM_API_KEY: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  DISABLE_CRON: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.string().default('info'),
  DEFAULT_MODEL: z.string().min(1).default('claude-sonnet-5-5'),
});

export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  litellmBaseUrl: string;
  litellmApiKey: string;
  jwtSecret: string;
  adminEmail?: string;
  adminPassword?: string;
  cronEnabled: boolean;
  logLevel: string;
  defaultModel: string;
}

function resolveDatabaseUrl(e: z.infer<typeof schema>): string {
  if (e.DATABASE_URL) return e.DATABASE_URL;
  if (e.PGHOST && e.PGUSER && e.PGDATABASE) {
    const pw = encodeURIComponent(e.PGPASSWORD ?? '');
    return `postgres://${encodeURIComponent(e.PGUSER)}:${pw}@${e.PGHOST}:${e.PGPORT ?? '5432'}/${e.PGDATABASE}`;
  }
  throw new Error('Database not configured: set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD/PGDATABASE');
}

/** Validates the environment; throws a readable error (names only, never values) on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // A blank value in .env (e.g. `ADMIN_PASSWORD=`) is treated as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    databaseUrl: resolveDatabaseUrl(e),
    litellmBaseUrl: e.LITELLM_BASE_URL.replace(/\/+$/, ''),
    litellmApiKey: e.LITELLM_API_KEY,
    jwtSecret: e.JWT_SECRET,
    adminEmail: e.ADMIN_EMAIL,
    adminPassword: e.ADMIN_PASSWORD,
    cronEnabled: e.NODE_ENV !== 'test' && !e.DISABLE_CRON,
    logLevel: e.LOG_LEVEL,
    defaultModel: e.DEFAULT_MODEL,
  };
}
