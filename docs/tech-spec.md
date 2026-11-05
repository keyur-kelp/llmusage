# Tech Spec: LLM Usage Control Demo

Source: `docs/prd.md` (AC-1 … AC-29, NFRs). Stack rules: `CLAUDE.md`. Owner: tech-lead.

---

## 1. Stack and why

All choices follow CLAUDE.md. **No deviations.** Additions (libraries CLAUDE.md doesn't mention) are listed so the user can veto them.

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node 22, npm 10 workspaces (`backend`, `frontend`), TypeScript `strict: true` everywhere (including migrations, see 1.1) | |
| Backend | Express 5, TypeScript, `tsx` for dev watch, `tsc` for build | Express 5 propagates async errors to the error handler natively |
| ORM / DB | Sequelize v6 + `pg` + `pg-hstore`; `sequelize-cli` for migrations/seeders; PostgreSQL **18** (user-provided, confirmed) | `gen_random_uuid()` is built in, no `pgcrypto` needed. No `sync()`. |
| Validation | `zod` at every route boundary (body, params, query) | |
| Auth | `bcrypt` (cost 12), `jsonwebtoken` (HS256) | |
| Money | `DECIMAL(14,6)` in DB, strings in JSON, `decimal.js` in code | ESLint bans `parseFloat` / `Number()` on money (see T-1) |
| LLM | `openai` npm client, `baseURL = LITELLM_BASE_URL`, `apiKey = LITELLM_API_KEY` (LiteLLM master key) | Never `@anthropic-ai/sdk` (ESLint `no-restricted-imports`) |
| Time | `luxon` (zone `Asia/Kolkata`) | **Addition.** IST has no DST; luxon keeps period maths readable and testable |
| Scheduler | `node-cron` with `timezone: 'Asia/Kolkata'` | **Addition.** In-process, no extra infrastructure |
| Logging | `pino` + `pino-http` with `redact` on `req.headers.authorization`, `*.password`, `*.passwordHash`, `*.token` | **Addition** |
| HTTP hardening | `helmet`; JSON body limit 100 kb | **Addition** |
| Frontend | Angular 20, standalone components, signals, Angular Material (M3 theme), functional interceptors and guards | Dev server proxies `/api` to the backend (`proxy.conf.json`), so CORS isn't needed |
| Tests | Jest + ts-jest + supertest (backend); Angular default runner, which is Karma + ChromeHeadless in v20 (frontend); Playwright (`tests/acceptance/`, QA-owned) | |
| LiteLLM | Docker image `ghcr.io/berriai/litellm` **pinned to a specific stable tag** (no `latest`), models in `config.yaml` referencing a UI-stored credential, plus any added in the UI (`STORE_MODEL_IN_DB=True`), port 4000. The Anthropic key lives only in LiteLLM's DB (entered in `/ui`, encrypted with `LITELLM_SALT_KEY`), never in `.env`. Has **its own Postgres database** (`litellm`, separate from the app's `llmusage` DB, same user-provided PG 18 server on the host, never in Docker) via `LITELLM_DATABASE_URL` | LiteLLM runs its own **Prisma** migrations on startup against its DB. That Prisma lives inside LiteLLM's container image, not in app code, so the CLAUDE.md "no Prisma" rule does **not** apply. Reviewers: do not flag it |

### 1.1 Migrations in TypeScript
Migrations and seeders are written as strict TS in `backend/migrations/*.ts` and `backend/seeders/*.ts`, compiled by `tsc -p backend/tsconfig.migrations.json` into `backend/dist-migrations/`. `.sequelizerc` points `migrations-path` and `seeders-path` at the compiled folders. `npm run migrate` = compile, then `sequelize-cli db:migrate`, then `db:seed:all`. This keeps "TypeScript everywhere" and the CLAUDE.md layout (sources live in `backend/migrations`). Seeders run through `sequelize-cli`'s `SequelizeData` storage, so re-running is a no-op.
*Fallback if the engineer can't get sequelize-cli to work with compiled TS:* `.cjs` with `// @ts-check` and JSDoc types. That would be a stack deviation and **needs the user's OK first**.

### 1.2 Why LiteLLM is used this way
- **Model list:** `GET {LITELLM_BASE_URL}/v1/models` (`openai.models.list()`). Nothing is hard-coded in the app (AC-6, AC-29).
- **Per-request cost:** always the cost LiteLLM reports **on the response of that request**. The app never computes cost itself, and never asks LiteLLM to price it afterwards (no `/spend/calculate`) (AC-12).
  - **Path A (target): streaming.** `stream: true`, `stream_options: { include_usage: true }`, LiteLLM config `litellm_settings.include_cost_in_streaming_usage: true`, so the final chunk's `usage` has `prompt_tokens`, `completion_tokens` and `cost`.
  - **Path B (only if the T-2 gate fails): non-streaming.** `stream: false`; cost is read from the completed response (`usage.cost` in the body, or LiteLLM's `x-litellm-response-cost` header if the body lacks it).
  - Which path is built is decided by the **T-2 decision gate** (section 6, risk R-1). Only one path is implemented; there is no runtime toggle.
- **LiteLLM's own database (user decision, 2026-11-05):** LiteLLM is no longer stateless. It has its own Postgres database (suggested name `litellm`) on the same user-provided PG 18 server as the app DB (Postgres.app on the host Mac). It is **never** the app's `llmusage` database and is **never** run in Docker.
  - Purpose: operator convenience only. LiteLLM keeps its keys, spend logs etc. there, and its admin UI (`http://localhost:4000/ui`, log in with `LITELLM_MASTER_KEY`) becomes usable.
  - **The app never reads or writes LiteLLM's DB.** No connection, no model, no query, no migration in `backend/` touches it. Quotas, ledger and reporting stay in the app DB. Cost is still taken from the per-request response (T-2 gate unchanged). LiteLLM's virtual keys, budgets and spend logs are not used for app features (PRD Out of scope).
  - **Provider key (user decision, 2026-11-05):** the Anthropic API key is **not** in `.env`, the compose file or `config.yaml`. The user enters it once in the LiteLLM UI as a stored credential named **`anthropic`**; LiteLLM saves it in its DB, encrypted with `LITELLM_SALT_KEY`. The app and the engineer never see or handle the provider key.
  - **Models: option (a) chosen.** `config.yaml` keeps a `model_list` with the three models in order (`claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5`), each with `litellm_params: { model: anthropic/<id>, litellm_credential_name: anthropic }`. This keeps the baseline models reproducible and reviewable in git; only the secret lives in the UI. Option (b) (no `model_list`, everything in the UI) was rejected because the model set would exist only in a DB and couldn't be reproduced from the repo.
  - `STORE_MODEL_IN_DB=True`, so credentials and any models added in the UI persist across restarts. Extra models may be added in the UI or in `config.yaml`. Either way they appear via `/v1/models` with no app change (AC-29).
  - **Picker default:** with config and DB models mixed, the order of `/v1/models` is not guaranteed. The app therefore has its own default: optional env `DEFAULT_MODEL` (default `claude-sonnet-5-5`). `GET /api/models` returns `defaultModel` = `DEFAULT_MODEL` if it is in the list, else the first listed model. The picker pre-selects `defaultModel`. This is configuration, not a hard-coded model list, so AC-6/AC-29 still hold.
  - Schema: LiteLLM applies its own Prisma migrations to the `litellm` DB on startup. This Prisma is part of LiteLLM's container, not app code, so it is not a violation of the CLAUDE.md "no Prisma" rule.

---

## 2. Modules / folder layout

```
package.json                  # workspaces + root scripts (dev:backend, dev:frontend, migrate, lint, test, rollup)
playwright.config.ts          # testDir tests/acceptance, baseURL http://localhost:4200 (engineer creates; QA owns the tests)
.env.example
litellm/
  docker-compose.yml          # litellm service only; no env_file; only LITELLM_MASTER_KEY, LITELLM_SALT_KEY and DATABASE_URL: ${LITELLM_DATABASE_URL} via ${VAR} interpolation (never the app's DATABASE_URL, no ANTHROPIC_API_KEY); STORE_MODEL_IN_DB=True; extra_hosts host.docker.internal:host-gateway; port 4000; mounts config.yaml read-only
  config.yaml                 # model_list (3 models, litellm_credential_name: anthropic, no key), general_settings.master_key, litellm_settings (see T-2)
backend/
  .sequelizerc
  tsconfig.json  tsconfig.migrations.json  jest.config.ts  .eslintrc / eslint.config.mjs
  migrations/                 # TS sources (T-3)
  seeders/                    # TS sources (T-3)
  src/
    server.ts                 # load env → connect DB → bootstrap admin → rollup catch-up → start cron → listen
    app.ts                    # createApp(deps) for supertest; no listen
    config/env.ts             # zod-validated env; fails fast on startup
    config/database.ts        # Sequelize instance + the config sequelize-cli uses
    lib/
      errors.ts               # AppError(code, httpStatus, message, details?)
      money.ts                # Decimal helpers: parseMoney, toMoneyString(6dp), pct(2dp), clampZero
      time.ts                 # IST period maths (pure functions)
      logger.ts               # pino + redaction
    middleware/
      validate.ts             # zod → 400 VALIDATION_ERROR
      authenticate.ts         # JWT verify + DB user load + is_active + token_version check
      require-admin.ts
      error-handler.ts
    models/                   # user.ts, conversation.ts, message.ts, usage-ledger.ts, usage-daily-rollup.ts,
                              # usage-rollup-day.ts, setting.ts, index.ts (init + associations)
    repositories/             # only place with Sequelize model queries / sequelize.query
      user-repository.ts  conversation-repository.ts  message-repository.ts
      usage-repository.ts     # ledger insert, aggregate queries (raw SQL with replacements)
      rollup-repository.ts  settings-repository.ts
    services/
      auth-service.ts  admin-bootstrap-service.ts  user-service.ts  settings-service.ts
      quota-service.ts        # period usage, quota status, pre-call check
      rollup-service.ts       # rollUpDay(date), catchUp()
      llm-gateway.ts          # LiteLLM client: listModels(), chat() (path per T-2 gate)
      chat-service.ts         # orchestrates check → stream → persist
      usage-report-service.ts # admin summary / daily / ledger
    routes/
      auth-routes.ts  model-routes.ts  conversation-routes.ts  chat-routes.ts  quota-routes.ts
      admin-settings-routes.ts  admin-user-routes.ts  admin-usage-routes.ts
    jobs/rollup-cron.ts       # '5 0 * * *' Asia/Kolkata → rollUpDay(yesterday IST)
    cli/rollup.ts             # npm run rollup -- --date=YYYY-MM-DD (default: yesterday IST)
  test/
    unit/ ...                 # pure functions: time, money, quota decision, sse parser
    integration/ ...          # supertest against a real test Postgres (DATABASE_URL_TEST), migrated
    fakes/fake-litellm.ts     # tiny OpenAI-compatible HTTP server: /v1/models, /v1/chat/completions (streaming or not, per gate) with fixed usage.cost
frontend/
  proxy.conf.json
  src/app/
    app.config.ts  app.routes.ts
    core/
      auth/ auth.service.ts  auth.interceptor.ts  auth.guard.ts  admin.guard.ts
      api/  api-error.ts  models.ts (DTO types mirroring section 4)
      ist-date.pipe.ts        # formats an ISO string in +0530 with an "IST" suffix
    features/
      login/ login.page.ts
      chat/  chat.page.ts  conversation-sidebar.component.ts  model-picker.component.ts
             message-list.component.ts  composer.component.ts  quota-panel.component.ts
             chat-stream.service.ts   # fetch + ReadableStream SSE parser (POST with Authorization header)
             chat.store.ts            # signals: conversations, active conversation, messages, streaming, quota, blockReason
      admin/ admin.page.ts (tabs) settings-tab.component.ts  usage-tab.component.ts  users-tab.component.ts
             user-dialog.component.ts  password-dialog.component.ts
```

Layering: routes (zod + HTTP) → services (business rules, transactions) → repositories (Sequelize). Routes never import models. Services never build SQL.

---

## 3. Data model

All tables snake_case, timestamps `timestamptz` UTC, money `DECIMAL(14,6)`.

### users
| column | type | notes |
|---|---|---|
| id | uuid PK default `gen_random_uuid()` | |
| email | varchar(320) not null | stored lower-cased and trimmed; **unique index on `email`** |
| name | varchar(200) not null | |
| password_hash | varchar(100) not null | bcrypt |
| role | enum `user_role` (`USER`,`ADMIN`) not null default `USER` | |
| is_active | boolean not null default true | |
| quota_override_usd | DECIMAL(14,6) null | null = use default; CHECK ≥ 0 |
| token_version | integer not null default 0 | bumped on password reset and deactivation → old JWTs rejected |
| created_at, updated_at | timestamptz | |

### settings (single row)
| column | type | notes |
|---|---|---|
| id | smallint PK, CHECK (id = 1) | |
| system_quota_usd | DECIMAL(14,6) not null default 100, CHECK ≥ 0 | |
| default_user_quota_usd | DECIMAL(14,6) not null default 10, CHECK ≥ 0 | |
| user_reset_dow | smallint not null default 6, CHECK 1–7 | ISO weekday: 1 = Mon … 6 = Sat, 7 = Sun |
| system_reset_dom | smallint not null default 1, CHECK 1–28 | |
| updated_at | timestamptz | |
The migration inserts row id = 1 with the defaults (AC-24a). This is done in the migration, not a seeder, so the row always exists once the schema exists.

### conversations
id uuid PK; user_id uuid FK → users not null; title varchar(120) not null (first 60 chars of the first user message); created_at; updated_at (bumped on each new pair). Index `(user_id, updated_at DESC)`.

### messages
id uuid PK; conversation_id uuid FK → conversations ON DELETE CASCADE not null; role enum `message_role` (`user`,`assistant`); content text not null; model varchar(200) not null (the model the pair was sent with); created_at. Index `(conversation_id, created_at)`.

### usage_ledger (append-only)
| column | type |
|---|---|
| id | bigserial PK |
| user_id | uuid FK → users not null |
| conversation_id | uuid FK → conversations not null |
| assistant_message_id | uuid FK → messages not null, unique |
| model | varchar(200) not null (model id as sent to LiteLLM) |
| input_tokens | integer not null CHECK ≥ 0 |
| output_tokens | integer not null CHECK ≥ 0 |
| cost_usd | DECIMAL(14,6) not null CHECK ≥ 0 |
| litellm_cost_raw | varchar(64) not null — exact textual cost LiteLLM reported (audit for AC-12) |
| litellm_call_id | varchar(100) null — `x-litellm-call-id` response header if present |
| usage_date | date not null — IST calendar date of `created_at` |
| created_at | timestamptz not null default now() |
Indexes: `(usage_date, user_id)`, `(user_id, usage_date)`.

### usage_daily_rollup
PK `(usage_date, user_id, model)`; input_tokens bigint; output_tokens bigint; cost_usd DECIMAL(14,6); request_count integer; created_at; updated_at.

### usage_rollup_days
usage_date date PK; rolled_at timestamptz. A row here means "rollup rows for this date are authoritative".

### Usage-for-period rule (AC-14)
For `[startDate, endDate)` (IST dates; periods always start and end at 00:00 IST, so they line up with whole `usage_date` days):
```
rollup rows with usage_date in range AND usage_date IN usage_rollup_days
+ ledger rows with usage_date in range AND usage_date NOT IN usage_rollup_days
```
One raw `sequelize.query` with `UNION ALL` and named replacements (`:start`, `:end`, `:userId`). Optional user filter. Because a day counts from exactly one source, the result equals the plain ledger sum. An integration test asserts this.

`usage_date` is derived from the ledger insert time (the moment the response finishes), so a ledger row can never land on a past IST day after that day's rollup has run.

---

## 4. API contracts

Base `/api`, JSON. Money is always a decimal **string** with 6 dp (`"10.000000"`). Percentages are strings with 2 dp. Times are ISO-8601 UTC (`resetsAt`) plus `resetsAtIst` (same instant, `+05:30` offset).
Error body: `{ "error": { "code": "UPPER_SNAKE", "message": "...", "details"?: {...} } }`. `details` is an optional extension used only for quota blocks and validation issues.

Common error codes: `VALIDATION_ERROR` 400, `UNAUTHENTICATED` 401, `ACCOUNT_DISABLED` 403, `FORBIDDEN` 403, `NOT_FOUND` 404, `EMAIL_TAKEN` 409, `SELF_LOCKOUT` 409, `MODEL_NOT_AVAILABLE` 400, `USER_QUOTA_EXCEEDED` 429, `SYSTEM_QUOTA_EXCEEDED` 429, `LLM_UNAVAILABLE` 502, `ROLLUP_DATE_NOT_PAST` 400, `INTERNAL_ERROR` 500.

### Auth
- `POST /api/auth/login` `{ email, password }` → 200 `{ token, user: UserDto }`. Wrong email or password → 401 `INVALID_CREDENTIALS` (same message for both). Deactivated → 403 `ACCOUNT_DISABLED`. (AC-2, AC-3)
- `GET /api/auth/me` → `UserDto`.
- JWT: `{ sub: userId, tv: tokenVersion }`, expires in 12 h, `JWT_SECRET` from env (minimum 32 chars, checked at startup). `authenticate` loads the user on **every** request. Missing or invalid token, or `tv` mismatch → 401. `is_active = false` → 403 `ACCOUNT_DISABLED` (AC-3). Role comes from the DB, not the token, so role changes apply immediately (AC-4).
- `UserDto = { id, email, name, role, isActive, quotaOverrideUsd: string|null }`. It never includes the hash.

### Models (any authenticated user)
- `GET /api/models` → `{ models: [{ id }], defaultModel: string }`, models straight from LiteLLM `/v1/models`, in LiteLLM's order (AC-6, AC-29). `defaultModel` = env `DEFAULT_MODEL` (default `claude-sonnet-5-5`) if it is in `models`, else `models[0].id` (section 1.2). No cache for the picker. For validating `model` on send, the gateway uses a 30 s in-memory cache that is refreshed on a miss. LiteLLM down → 502 `LLM_UNAVAILABLE`.

### Quota
- `GET /api/quota/me` → `QuotaStatus`:
```json
{
  "user":   { "quotaUsd":"10.000000","usedUsd":"1.234567","remainingUsd":"8.765433","remainingPct":"87.65",
              "periodStart":"…Z","resetsAt":"…Z","resetsAtIst":"…+05:30","isOverride":false },
  "system": { "quotaUsd":"100.000000","usedUsd":"…","remainingUsd":"…","remainingPct":"…",
              "periodStart":"…Z","resetsAt":"…Z","resetsAtIst":"…+05:30" }
}
```
`remainingUsd = max(0, quota − used)`. `remainingPct = remaining / quota × 100`, or `"0.00"` when quota is 0 (AC-22).

### Conversations (owner only)
- `GET /api/conversations` → `{ conversations: [{ id, title, updatedAt }] }`, newest first.
- `GET /api/conversations/:id` → `{ id, title, messages: [{ id, role, content, model, createdAt }] }`. Not the owner, or doesn't exist → **404 `NOT_FOUND`**. This applies to admins too (AC-10).

### Chat (SSE)
The endpoint shape is the same for both cost paths (section 1.2), so the frontend and QA tests don't change shape. Under Path A, `delta` events arrive incrementally. Under Path B, the server makes one non-streamed call and then sends exactly **one** `delta` event with the whole answer, followed by `done` (or a single `error`). This is deliberately still SSE with a single event rather than plain JSON, which keeps one client code path.

- `POST /api/chat/stream` body `{ conversationId?: uuid, model: string (1–200), message: string (1–20000) }`.
- Checks before any SSE headers are sent, in this order. Each failure is a normal JSON error:
  1. zod validation → 400.
  2. `conversationId` exists and belongs to the caller → else 404.
  3. `model` is in the LiteLLM model list → else 400 `MODEL_NOT_AVAILABLE`.
  4. **Quota check** (`quota-service.check(userId)`): reads settings fresh (AC-20), computes both periods. **System is checked first.** System used ≥ quota → 429 `SYSTEM_QUOTA_EXCEEDED`. Otherwise user used ≥ effective quota (`COALESCE(override, default)`, AC-21) → 429 `USER_QUOTA_EXCEEDED`. `details = { limit: "SYSTEM"|"USER", resetsAt, resetsAtIst, quotaUsd, usedUsd }`. No LLM call and no rows written (AC-15, AC-16). Usage below quota → allowed even if this request overshoots (AC-17).
- Then `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, `res.flushHeaders()`. Events:
  - `event: delta` `data: {"text":"…"}`. Path A: written immediately per upstream chunk, with no buffering (NFR, first token within 1 s). Path B: one event containing the full answer.
  - `event: done` `data: {"conversationId","userMessageId","assistantMessageId","usage":{"inputTokens","outputTokens","costUsd"},"quota": QuotaStatus}`
  - `event: error` `data: {"code":"LLM_UNAVAILABLE"|"INTERNAL_ERROR","message"}`. The stream then ends.
- Context sent to LiteLLM: all prior messages of the conversation in order, then the new user message (AC-9). No truncation in v1 (see R-5).
- Persistence: in **one Sequelize transaction** after the upstream response is complete (end of stream under Path A, response received under Path B) and usage + cost are present. The transaction creates the conversation if it's new, inserts the user message, the assistant message (both with `model`), and the ledger row, and bumps `conversations.updated_at` (AC-8, AC-9, AC-11).
- Upstream fails before completion, or the response has no cost (final chunk `usage.cost` under Path A; body/header cost under Path B) → nothing is persisted, an `error` event is sent, and the failure is logged at `error` level with model and call id (no content). If the upstream reported usage but no cost, that is a config bug (R-1) and is logged loudly.
- Client disconnects mid-request → the upstream is **not** aborted. The server keeps consuming to the end and persists normally, so spend is never lost. Writes to the closed socket are skipped.

### Admin (`authenticate` + `requireAdmin` → 403 `FORBIDDEN` for USER, AC-4)
- `GET /api/admin/settings` → `{ systemQuotaUsd, defaultUserQuotaUsd, userResetDow (1–7), systemResetDom (1–28), updatedAt }`.
- `PUT /api/admin/settings`, same fields, all required. Money matches `^\d{1,8}(\.\d{1,6})?$` (string only, so it's never ≥ 0 as a float). `userResetDow` is an int 1–7, `systemResetDom` an int 1–28. Otherwise 400 `VALIDATION_ERROR` (AC-24).
- `GET /api/admin/users` → `{ users: UserDto[] }`.
- `POST /api/admin/users` `{ name, email, password (min 8), role }` → 201 `UserDto`. Duplicate email (case-insensitive) → 409 `EMAIL_TAKEN` (AC-27). The DB unique violation is also mapped, to cover races.
- `PATCH /api/admin/users/:id` with any subset of `{ name, role, isActive, quotaOverrideUsd: string|null }`. `null` clears the override (AC-21). If the target is the caller and the request has `isActive:false` or `role:"USER"` → 409 `SELF_LOCKOUT` (AC-28). Deactivation bumps `token_version`.
- `POST /api/admin/users/:id/password` `{ password (min 8) }` → 204. Bumps `token_version`.
- `GET /api/admin/usage/summary` → `{ system: QuotaPart, users: [{ userId, name, email, role, isActive, usedUsd, quotaUsd, remainingUsd, usedPct, isOverride }] }`. Sorted by `usedUsd` desc by default, sortable in the UI with MatSort (AC-25).
- `GET /api/admin/usage/daily?from=YYYY-MM-DD&to=YYYY-MM-DD&userId=uuid?` (inclusive IST dates; `from ≤ to`, at most 366 days) → `{ rows: [{ date, userId, userName, model, inputTokens, outputTokens, costUsd, requestCount }], totals: { inputTokens, outputTokens, costUsd, requestCount } }`. Uses the same rollup-plus-unrolled-ledger union, grouped by date/user/model (AC-26).
- `GET /api/admin/usage/ledger?from&to&userId?&limit≤500` → raw ledger rows including `costUsd`, `litellmCostRaw` and `litellmCallId`. Gives QA evidence for AC-11 and AC-12.
- `POST /api/admin/rollup/run` `{ date?: YYYY-MM-DD }` (default yesterday IST) → `{ date, rows }`. A date ≥ today IST → 400 `ROLLUP_DATE_NOT_PAST` (AC-13, manual run).

---

## 5. Key algorithms

### 5.1 Periods (`lib/time.ts`, pure, unit-tested)
- `userPeriod(nowUtc, resetDow)`: convert now to IST. `start` = the most recent date with ISO weekday = `resetDow` at 00:00 IST, counting today if today is that day. `end = start + 7 days` (AC-18).
- `systemPeriod(nowUtc, resetDom)`: `start` = day `resetDom` of the current IST month at 00:00 if today's IST date ≥ `resetDom`, otherwise day `resetDom` of the previous month. `end` = same day next month (AC-19). `resetDom ≤ 28`, so the date always exists.
- Each returns `{ startUtc, endUtc, startDate, endDate }` (IST `YYYY-MM-DD` for the SQL).
- `istDate(instant)` is used for `usage_date`.

### 5.2 Rollup (`rollup-service.rollUpDay(date)`)
Runs in one transaction:
1. `pg_advisory_xact_lock(hashtext('usage_rollup'))`
2. `DELETE FROM usage_daily_rollup WHERE usage_date = :d`
3. `INSERT … SELECT usage_date, user_id, model, SUM(...), COUNT(*) FROM usage_ledger WHERE usage_date = :d GROUP BY …`
4. Upsert `usage_rollup_days(:d)`.

Re-running it recomputes the same values rather than adding to them, so it never double-counts (AC-13). Dates ≥ today IST are refused.
- Cron `5 0 * * *` in `Asia/Kolkata` → yesterday.
- On startup, `catchUp()` rolls every distinct ledger `usage_date` < today that isn't in `usage_rollup_days`.
- CLI `npm run rollup -- --date=YYYY-MM-DD`.
- Cron is off when `NODE_ENV=test` or `DISABLE_CRON=true`.

### 5.3 Admin bootstrap (AC-1)
On startup, after DB connect: if `ADMIN_EMAIL`/`ADMIN_PASSWORD` are set, `findOrCreate` by lower-cased email with role `ADMIN` and a bcrypt hash. If the user already exists, nothing changes (the password isn't overwritten either). The unique index guarantees there are no duplicates. Logs the "admin created" or "admin exists" event and the email only, never the password.

### 5.4 Cost capture (`llm-gateway.chat`) — decided by the T-2 gate
The gateway exposes one method, `chat({ model, messages })`, returning `{ deltas: AsyncIterable<string>, result: Promise<UsageResult> }` where `UsageResult = { inputTokens, outputTokens, costUsd: string, costRaw: string, callId: string|null }`. Chat-service code is identical for both paths.

**Common to both paths**
- Use `.withResponse()` to read the `x-litellm-call-id` header.
- Cost arrives as a JSON number (or a header string). Convert with `new Decimal(String(cost)).toDecimalPlaces(6, ROUND_HALF_UP)`; `String(cost)` goes into `litellm_cost_raw`.
- No other arithmetic on cost. `cost` isn't in the openai SDK types, so it's parsed with a zod schema. Never `any`.
- Missing cost → throw, persist nothing, `error` event (section 4). **No fallback to `/spend/calculate` or any after-the-fact pricing.**

**Path A — streaming (built if the T-2 gate passes)**
- `client.chat.completions.create({ model, messages, stream: true, stream_options: { include_usage: true } }).withResponse()`.
- Iterate chunks, yield each `delta.content`, capture `usage` (incl. `cost`) from the final chunk.

**Path B — non-streaming (built only if the T-2 gate fails AND the user approves the AC-7 change)**
- `client.chat.completions.create({ model, messages, stream: false }).withResponse()`.
- `deltas` yields the full `choices[0].message.content` once. Cost from `usage.cost` in the body, else the `x-litellm-response-cost` response header. Tokens from `usage.prompt_tokens` / `usage.completion_tokens`.
- **This conflicts with PRD AC-7** ("answer is streamed, first tokens shown before the full answer completes"), the PRD NFR "first streamed token within 1 s", and CLAUDE.md "Chat streaming via Server-Sent Events" (the transport stays SSE, but the content isn't streamed). Path B therefore needs the user to change AC-7/NFR in the PRD first.

---

## 6. Task breakdown

| Task | Description | ACs |
|---|---|---|
| **T-1** | **Scaffolding.** Root `package.json` workspaces and scripts (`dev:backend`, `dev:frontend`, `migrate`, `lint`, `test` running backend Jest + frontend `ng test --watch=false --browsers=ChromeHeadless`, `rollup`). Strict tsconfigs. ESLint (typescript-eslint, angular-eslint) with `@typescript-eslint/no-explicit-any: error`, `no-restricted-imports` banning `@anthropic-ai/sdk`, `prisma`, `typeorm`, `knex`, and `no-restricted-syntax`/`no-restricted-globals` banning `parseFloat` and `.sync(`. `.env.example` with `DATABASE_URL` (or `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`), `DATABASE_URL_TEST`, `LITELLM_BASE_URL=http://localhost:4000`, `LITELLM_API_KEY`, `LITELLM_MASTER_KEY`, `LITELLM_SALT_KEY` (required; comment: encrypts credentials stored in LiteLLM's DB, set once and **never change**), `LITELLM_DATABASE_URL` (example `postgres://llmusage:CHANGE_ME@host.docker.internal:5432/litellm`, with a comment that it is read only by the LiteLLM container, see T-2), `DEFAULT_MODEL=claude-sonnet-5-5` (optional), `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT=3000`, `DISABLE_CRON`. **No `ANTHROPIC_API_KEY`** (it is entered in the LiteLLM UI, section 1.2). The backend's `env.ts` does **not** read `LITELLM_DATABASE_URL` or `LITELLM_SALT_KEY`. Root `playwright.config.ts`. README run steps, including the one-time `litellm` database setup from T-2. | NFRs, AC-5 (lint guard on logs) |
| **T-2** | **LiteLLM + streaming-cost decision gate. Status 2026-11-05: done, gate PASSED → Path A (see R-1 for the recorded result).** `litellm/docker-compose.yml` (pinned image, port 4000, `config.yaml` mounted read-only, own DB per section 1.2; update the header comment, which still says "Stateless ... no database"). **No `env_file`**: the app's `.env` holds the app's `DATABASE_URL`, and LiteLLM would treat it as its own DB. The app's `DATABASE_URL` must **never** reach the container. Pass only what LiteLLM needs via `environment:` with `${VAR}` interpolation: `LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY:?...}` (required, fail fast), `LITELLM_SALT_KEY: ${LITELLM_SALT_KEY:?...}` (required, fail fast), `DATABASE_URL: ${LITELLM_DATABASE_URL:?set LITELLM_DATABASE_URL in .env}` (required, fail fast), `STORE_MODEL_IN_DB: "True"`. **No `ANTHROPIC_API_KEY`** anywhere in compose, `config.yaml` or `.env.example`. Add `extra_hosts: ["host.docker.internal:host-gateway"]` (no-op on Docker Desktop, makes the name resolve on Linux). **Host name decision:** the user writes `host.docker.internal` directly in `LITELLM_DATABASE_URL` (e.g. `postgres://llmusage:<password>@host.docker.internal:5432/litellm`). Compose interpolation can't do substring replacement, so a `localhost` URL can't be rewritten without a wrapper script, and `localhost` inside the container is the container itself. The variable is only consumed by the container, so it is written from the container's point of view; `.env.example` and the README say so. Start command (from repo root, values interpolated from the root `.env`): `docker compose --env-file .env -f litellm/docker-compose.yml up -d`. README must show this command. **One-time DB setup (README step, before the first `up`):** create the database on the host server, e.g. `createdb litellm` (Postgres.app's `bin` on `PATH`) or `psql -d postgres -c 'CREATE DATABASE litellm'`; set a password on the DB user if it has none (`ALTER ROLE <user> PASSWORD '...'`, see R-10). The app's `npm run migrate` does **not** create or migrate this DB; LiteLLM applies its own Prisma migrations on startup (allowed, see section 1.2). **Verify:** after `up`, `docker compose ... logs litellm` shows the Prisma migration and DB connection succeeding, `GET http://localhost:4000/health/readiness` reports the DB connected, and `/ui` accepts the master key. If the connection is rejected (`no pg_hba.conf entry`, trust/auth failure), **STOP and report it** to the tech-lead/user; do not loosen `pg_hba.conf`, switch to trust auth, or point LiteLLM at the app DB as a workaround. `config.yaml` `model_list` in this order: `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5`, each `litellm_params: { model: anthropic/<id>, litellm_credential_name: anthropic }` (no `api_key`, no `os.environ/ANTHROPIC_API_KEY`); `general_settings.master_key: os.environ/LITELLM_MASTER_KEY`; `litellm_settings: { include_cost_in_streaming_usage: true, drop_params: true }`. The picker default comes from the app's `DEFAULT_MODEL` (section 1.2), not from list order. **User setup step (README; blocks the gate and QA):** after `up`, the user logs into `http://localhost:4000/ui` with the master key and adds an Anthropic credential named exactly `anthropic` with their API key. The engineer and the app never handle the provider key; the engineer must not ask for it, put it in any file, or pass it via env. If no credential exists yet, the engineer stops at the gate and reports "waiting on user credential setup". **Check credential resolution first:** with the credential in place, a non-streamed request to `claude-sonnet-5-5` must succeed. If LiteLLM with the pinned image does not resolve `litellm_credential_name` for config-defined models against a UI-stored credential, **STOP and report** (fallback is option (b), all three models defined in the UI in the same order, which needs the tech-lead/user OK because the model set then isn't in git). **Decision gate, do before anything in T-10/T-11:** `curl` a streaming request to `claude-sonnet-5-5` with `stream_options.include_usage: true` and check the final chunk for `usage.cost`. **Pass** (cost present, non-zero) → build Path A (SSE streaming), record the curl output in the PR. **Fail** → also check a non-streamed request returns cost (body `usage.cost` or `x-litellm-response-cost` header), then **STOP and report to the tech-lead/user**. Do not build Path B, and do not change AC-7 behaviour, until the user has approved the PRD change to AC-7 (see R-1). Do not use `/spend/calculate` in either case. | AC-6, AC-7, AC-12, AC-29 |
| **T-3** | **DB config and migrations.** `config/database.ts`, `.sequelizerc`, `tsconfig.migrations.json`. Migrations for every table, enum, index and CHECK in section 3, plus the settings row insert. `npm run migrate` works on an empty DB and is a no-op when re-run. | AC-24a, NFR (migrations) |
| **T-4** | **Models and repositories.** Sequelize models (typed with `InferAttributes`/`InferCreationAttributes`, `DECIMAL` typed as `string`). All repositories, including the period-usage `UNION ALL` aggregates with replacements. | AC-11, AC-14 |
| **T-5** | **App skeleton.** `env.ts` (zod, fail fast), `createApp`, pino with redaction, helmet, the `validate` middleware, `AppError` and the error handler (unknown error → 500 `INTERNAL_ERROR` with no stack in the response), and the 404 handler. | NFRs |
| **T-6** | **Auth.** bcrypt hashing, login, JWT, `authenticate` (active plus token_version), `requireAdmin`, `/auth/me`, admin bootstrap at startup. | AC-1, AC-2, AC-3, AC-4, AC-5 |
| **T-7** | **Time and money libs.** `userPeriod`, `systemPeriod`, `istDate`, money helpers. Exhaustive unit tests: every weekday, reset day equal to today, month boundaries, Dec→Jan, Feb with dom 28, instants just before and after 00:00 IST (18:29:59Z / 18:30:00Z UTC). | AC-18, AC-19 |
| **T-8** | **Quota service.** `getStatus(userId)` and `check(userId)` (system first, then user, effective quota, fresh settings read every call), and `GET /api/quota/me`. | AC-14, AC-15, AC-16, AC-17, AC-20, AC-21, AC-22 |
| **T-9** | **Rollup.** `rollUpDay`, `catchUp`, cron job, CLI, `POST /api/admin/rollup/run`. | AC-13, AC-14 |
| **T-10** | **LLM gateway.** `listModels` (with the 30 s validation cache), `chat` per section 5.4 using the path the T-2 gate selected (only that path is implemented), returning deltas plus a final usage/cost result. Injectable into `createApp` so tests use the fake LiteLLM. | AC-6, AC-7, AC-12, AC-29 |
| **T-11** | **Chat and conversations API.** `GET /api/models` (with `defaultModel` from `DEFAULT_MODEL`, section 4), conversations list/get with owner-only access, `POST /api/chat/stream` exactly as in section 4: pre-checks, SSE, the persistence transaction, disconnect handling, error events. | AC-6 to AC-11, AC-15, AC-16, AC-17 |
| **T-12** | **Admin API.** Settings get/put, users CRUD, password reset, self-lockout guard, usage summary/daily/ledger. | AC-20, AC-21, AC-24, AC-25, AC-26, AC-27, AC-28 |
| **T-13** | **Frontend foundation.** Angular 20 app with Material theme, routes (`/login`, `/chat`, `/chat/:id`, `/admin`), `AuthService` (signals, token in `localStorage`), auth interceptor (attaches the bearer token; on 401 clears the token and goes to `/login`; on 403 `ACCOUNT_DISABLED` does the same and shows the message), `authGuard`, `adminGuard` (USER → redirect to `/chat` with a "not authorised" snackbar). The server's 403 is the real control. Login page goes to `/chat` on success. | AC-2, AC-3, AC-4 |
| **T-14** | **Chat UI.** Conversation sidebar (list plus "New chat"), model picker (`mat-select` filled from `/api/models`, `defaultModel` pre-selected, i.e. `claude-sonnet-5-5` unless `DEFAULT_MODEL` says otherwise), message list (each assistant message shows its model), composer (disabled while streaming), `ChatStreamService` (fetch POST + SSE parser, appends deltas to a signal as they arrive; works unchanged whether one or many `delta` events arrive), quota panel (personal and system: remaining USD and %, `mat-progress-bar`, reset time in IST) refreshed from `done.quota`, and on load. Block banner on 429 showing "Personal quota reached" or "System quota reached" plus "Resets <date time> IST". Stable `data-testid` attributes on key elements for QA: `model-picker`, `composer-input`, `send-button`, `message-assistant`, `quota-user-remaining`, `quota-system-remaining`, `quota-block-reason`, `quota-reset-time`, `conversation-item`. | AC-6, AC-7, AC-8, AC-9, AC-10, AC-22, AC-23 |
| **T-15** | **Admin UI.** Tabs. **Settings:** reactive form; money inputs as text with the pattern validator; weekday select Mon–Sun mapped to 1–7; dom select 1–28; server errors shown. **Usage:** system MTD card, per-user table with MatSort, daily breakdown with a date-range picker plus user filter, and a totals row. **Users:** table, create dialog, edit dialog (name, role, override set/clear), password reset dialog, activate/deactivate toggle. Self-row controls are disabled in the UI and enforced by the server. | AC-21, AC-24, AC-25, AC-26, AC-27, AC-28 |
| **T-16** | **Backend tests and perf check.** Fake LiteLLM server. Integration tests (supertest + test Postgres) covering every backend AC above. A perf test that seeds 20 users × 30 days of ledger rows (about 10 per user per day) and asserts `quotaService.check` p95 ≤ 100 ms over 50 runs. Frontend unit tests: SSE parser, quota panel formatting, IST pipe, guards. | AC-1 to AC-29 (unit/integration level), NFR p95 |

Suggested order: T-1 → T-2 (spike) → T-3 → T-4 → T-5 → T-7 → T-6 → T-10 → T-8 → T-9 → T-11 → T-12 → T-13 → T-14 → T-15, with T-16 tests written alongside each task.

---

## 7. Test strategy

**Unit (Jest, no DB):**
- `time.ts` period maths
- `money.ts`
- quota decision function `(systemUsed, systemQuota, userUsed, userQuota) → allow | SYSTEM | USER`
- cost extraction from a final chunk (number → 6 dp string)
- zod schemas (negative, out-of-range and float-number money rejected)

**Integration (Jest + supertest, real Postgres from `DATABASE_URL_TEST`, migrated once per run, tables truncated between tests, fake LiteLLM injected):**
- auth (AC-1 to AC-5, including asserting the DB column is a bcrypt hash and that captured logs contain no password)
- owner isolation (AC-10)
- chat persistence and context passed to the fake (AC-8, AC-9: the fake records the received messages)
- the ledger row matches the fake's reported cost exactly (AC-11, AC-12)
- quota blocks with zero fake calls and zero ledger rows (AC-15, AC-16)
- the overshoot rule (AC-17)
- settings changes applied without restart (AC-20, AC-21)
- rollup idempotency and the union-equals-ledger property (AC-13, AC-14)
- admin validation, users, self-lockout and usage totals (AC-24 to AC-28)
- the p95 perf check

Mocks are allowed only for LiteLLM (the fake server). The DB is never mocked.

**Frontend unit (Karma):** SSE parser, chat store reducer logic, quota panel rendering, block banner text, IST pipe, guards, interceptor.

**Acceptance (Playwright, QA-owned, `tests/acceptance/`):** real stack (LiteLLM in Docker → Anthropic, local backend + frontend, real Postgres 18). Acceptance tests use `claude-sonnet-5-5`. QA drives quota scenarios through the admin API/UI. For example, setting the default user quota to `0.000001` makes one short Sonnet message exhaust it. AC-12 evidence is LiteLLM's reported cost (`litellmCostRaw` / call id from `GET /api/admin/usage/ledger`) compared with `costUsd`. AC-29 can be shown either way: add a model in the LiteLLM UI (no restart needed, since `STORE_MODEL_IN_DB=True`), or add it to `config.yaml` and restart the container. Either way it must appear in the picker and be tracked. Before acceptance runs, the user must have added the `anthropic` credential in the LiteLLM UI (T-2). Engineers don't edit `tests/acceptance/`.

`npm test` must stay green (Stop hook). Integration tests skip with a clear message if `DATABASE_URL_TEST` is unset. They must **not** silently pass.

---

## 8. Risks

- **R-1 — RESOLVED 2026-11-05: T-2 gate PASSED, Path A confirmed.** Verified by the orchestrator against the live pinned image (`main-v1.83.14-stable`, own `litellm` DB connected, credential `anthropic` resolving for all three config models): a streamed request with `stream_options.include_usage` returns `usage.cost` in the final chunk for every model (sonnet `0.000134` for 17 in / 10 out tokens, haiku `5.999999999999999e-6`, opus `0.00024`). Non-streamed requests carry the cost only in the `x-litellm-response-cost` header (body `usage.cost` is null); irrelevant because Path A is built. R-13 (credential reference from config) is also resolved: option (a) works. Path B is not built. The haiku value shows R-2 in practice: `String(cost)` gives `0.000005999999999999999`, which `decimal.js` rounds HALF_UP to `0.000006` for `cost_usd`, and that string is kept in `litellm_cost_raw`. Original risk text below.
- **R-1 (high): getting the streaming cost from LiteLLM — resolved by a decision gate (user decision, 2026-11-05).** The plan depends on `include_cost_in_streaming_usage` putting `usage.cost` in the final stream chunk with the pinned image. The T-2 gate checks this first:
  - Cost in the stream → **Path A**, SSE streaming as specified.
  - Cost not in the stream → **Path B**, non-streamed call with the cost taken from that response; the API still answers over SSE but with a single `delta` event, and the UI shows the whole answer at once.
  - The "ask LiteLLM to price it afterwards" fallback (`/spend/calculate`) is **rejected**. The app never prices tokens itself.
  - Path B **conflicts with PRD AC-7** (streamed, first tokens before the full answer), the first-token NFR, and CLAUDE.md "Chat streaming via SSE". It needs a PRD change by the user. The engineer must stop and report at the gate, not change AC-7 behaviour silently. Reviewers treat an unapproved Path B as a blocker.
- **R-2: float to decimal.** LiteLLM emits cost as a JSON float. Rounding `String(cost)` to 6 dp HALF_UP is the defined conversion, and `litellm_cost_raw` keeps the original for audit. Comparisons for AC-12 are at 6 dp.
- **R-3: concurrent overshoot.** Two simultaneous requests from one user can both pass the check. The PRD's simple rule (AC-17) accepts this. No row locking is planned. Ledger writes are transactional.
- **R-4: spend on failed or disconnected streams.** A disconnect keeps consuming upstream so cost is recorded. If the upstream errors mid-stream without usage, LiteLLM/Anthropic may still bill for partial tokens that the app can't see. This is accepted for the demo and logged.
- **R-5: context growth.** Sending the whole conversation each time (AC-9) can hit the model's context limit or cost a lot on long chats. No truncation in v1, and the upstream error surfaces as `LLM_UNAVAILABLE`.
- **R-6: Karma needs Chrome.** `npm test` runs frontend tests in ChromeHeadless, so CI or dev machines need Chrome or Chromium installed.
- **R-7: JWT in localStorage** is exposed to XSS. Acceptable for a local demo. Angular's default sanitisation, rendering message content as text only (no `innerHTML` and no markdown HTML), and helmet reduce the risk.
- **R-8: migrations via compiled TS** may cause friction with sequelize-cli. The fallback in 1.1 needs the user's approval.
- **R-9: model ids.** Configured ids are `claude-sonnet-5-5`, `claude-haiku-5-5`, `claude-opus-5-5`. Ids change over time; a wrong id fails only at request time (`LLM_UNAVAILABLE`). The T-2 gate curl doubles as a check for the Sonnet id; the engineer should also send one request to Haiku and Opus.
- **R-10: LiteLLM container can't reach the host Postgres.** Postgres.app's default `pg_hba.conf` uses trust auth for local connections and identifies/permits the client app. A connection from the Docker VM (via `host.docker.internal`) may be rejected with `no pg_hba.conf entry` or a trust/permission rejection, and LiteLLM then fails to start. Mitigation: the user gives the DB user a password and puts it in `LITELLM_DATABASE_URL`. The engineer verifies the connection in T-2 and reports a failure instead of working around it (no loosening of auth, no trust rules for the Docker network, no reuse of the app DB). Until fixed, LiteLLM, and so chat (AC-6/AC-7), is down; app-only features and backend tests with the fake LiteLLM are unaffected.
- **R-12: provider key stored in LiteLLM's DB.** The Anthropic key exists only as a LiteLLM stored credential, encrypted with `LITELLM_SALT_KEY`. If `LITELLM_SALT_KEY` changes or is lost after credentials are saved, LiteLLM can't decrypt them and every model call fails (`LLM_UNAVAILABLE`) until the user re-enters the key in the UI. Rule: set `LITELLM_SALT_KEY` once to a long random value, never change it, keep it out of git and logs. Anyone with the master key can use (not read back) the credential through the UI/API, so `LITELLM_MASTER_KEY` is as sensitive as the provider key. A fresh/dropped `litellm` DB loses the credential and any UI-added models; the three baseline models come back from `config.yaml`, the key must be re-entered.
- **R-13: credential reference from config.** Option (a) relies on config-defined models resolving `litellm_credential_name` against a UI-stored credential in the pinned image. T-2 checks this first; the fallback (option b) needs approval.
- **R-11: LiteLLM's DB is a second stateful component.** LiteLLM's Prisma migrations run on every start against `litellm` and can be slow or fail on an image upgrade. The image stays pinned (T-2). Pointing `LITELLM_DATABASE_URL` at `llmusage` by mistake would let LiteLLM's Prisma create tables in the app DB; the README and `.env.example` warn against this, and reviewers treat any shared DB name as a blocker.

---

## 9. Open questions for the user

### Answered (2026-11-05)
1. **PostgreSQL version:** PG **18**. `gen_random_uuid()` is built in; no `pgcrypto` needed.
2. **Initial models in LiteLLM:** `claude-sonnet-5-5` (first in `model_list`; picker default via `DEFAULT_MODEL`), `claude-haiku-5-5`, `claude-opus-5-5`. QA acceptance tests use Sonnet.
- **Streaming cost (R-1):** decision gate in T-2, no after-the-fact pricing. See R-1 and section 5.4.
- **Other risks (R-2 to R-9):** accepted as written.
- **LiteLLM database:** LiteLLM gets its own Postgres DB (`litellm`, same host server, separate from `llmusage`, never in Docker) via `LITELLM_DATABASE_URL`; the app never reads it. See section 1.2, T-2, R-10, R-11.
- **Provider key in LiteLLM (2026-11-05):** no `ANTHROPIC_API_KEY` in `.env`; the user stores it in the LiteLLM UI as credential `anthropic`; `STORE_MODEL_IN_DB=True`; `config.yaml` keeps the three models referencing that credential (option a); app picker default via `DEFAULT_MODEL`; `LITELLM_SALT_KEY` required and immutable. See section 1.2, T-2, R-12, R-13.

### Provisional — pending user confirmation
The spec is built on these defaults until the user answers.
3. **Both limits exceeded:** report `SYSTEM_QUOTA_EXCEEDED` (system checked first). *Provisional — pending user confirmation.*
4. **Failed LLM call:** save nothing, not even the user's message; the user resends. *Provisional — pending user confirmation.*
5. **Session:** JWT valid for 12 h, stored in localStorage, no refresh token. *Provisional — pending user confirmation.*
6. **New libraries:** luxon, node-cron, pino/pino-http and helmet (not named in CLAUDE.md) are used. *Provisional — pending user confirmation.*
