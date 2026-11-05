VERDICT: APPROVE
SCORE: 90/100
BLOCKERS: 0  MAJORS: 0  MINORS: 8

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 24 | money-number-lint-gap −1 |
| Correctness | 25 | 21 | chat-message-not-trimmed −1, empty-assistant-answer-persisted −1, chat-init-unhandled-rejection −1, usage-range-default-local-tz −1 |
| Tests | 20 | 18 | integration-tests-not-run −2 |
| Security | 15 | 14 | chat-store-not-reset-on-logout −1 |
| CLAUDE.md rules | 15 | 13 | routes-bypass-service-layer −2 |
| **Total** | 100 | **90** | |

Review round 1 (no earlier reviews). Scope: all untracked/modified files from `git status --porcelain` (backend/, frontend/, litellm/, root configs, README.md, .env.example). `.env` was not read.

## Test and lint run
- `DATABASE_URL_TEST= npm test`
  - Backend Jest: **5 unit suites passed (60 tests)**: time, money, quota-decision, llm-usage (cost parsing), schemas/env. **5 integration suites skipped (46 tests)**: auth, chat, admin, rollup, perf. They were skipped because `DATABASE_URL_TEST` was blank. The global setup prints a clear SKIPPED warning, and Jest reports them as skipped, not passed, which matches spec §7.
  - Frontend Karma (ChromeHeadless): **37 of 37 passed** (SSE parser, chat store, quota panel, IST pipe, guards, interceptor, format, admin logic).
- `npm run lint`: ESLint plus backend `tsc --noEmit` (app and migrations) are clean.

## Issues
- [money-number-lint-gap] eslint.config.mjs:11 — minor — T-1 asks ESLint to ban `parseFloat` **and `Number()` on money**. Only `parseFloat`/`Number.parseFloat` are banned. A general `Number()` ban isn't practical, so either add a `no-restricted-syntax` rule for `Number(` in `backend/src/services` and `backend/src/repositories` (token counts there already use `Number`, so they'd need an allow-comment), or note in the spec that review enforces this instead of lint. I found no misuse in the current code: the only `Number(` calls are on token counts, row counts and a display-only percent.
- [chat-message-not-trimmed] backend/src/services/chat-service.ts:14 — minor — `message: z.string().min(1)` accepts whitespace-only input. That gives an empty conversation title (line 118) and sends whitespace to the provider, which rejects it. Use `z.string().trim().min(1).max(20000)`. The frontend already trims, but the route boundary is the real control.
- [empty-assistant-answer-persisted] backend/src/services/chat-service.ts:87 — minor — if the upstream returns zero content chunks but valid usage/cost, an assistant message with `content = ''` is saved. Anthropic rejects empty assistant turns, so every later message in that conversation fails with `LLM_UNAVAILABLE`. Still record the ledger row, since spend happened, but either store a placeholder or skip empty assistant messages when building `history` (line 66).
- [chat-init-unhandled-rejection] frontend/src/app/features/chat/chat.page.ts:119 — minor — `await this.store.init()` rejects if `/api/conversations` or `/api/quota/me` fails (`chat.store.ts:48`, `65`, `70` have no catch). The `paramMap` subscription is then never set up, so `/chat/:id` never opens and the user sees no error. Catch errors per call in `init()` and set `store.error`, or subscribe before awaiting.
- [usage-range-default-local-tz] frontend/src/app/features/admin/usage-tab.component.ts:187 — minor — the default daily-range `from`/`to` comes from the browser's local date, not the IST date. CLAUDE.md says all displayed periods are IST. Compute today's IST date with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` and use that for the defaults.
- [chat-store-not-reset-on-logout] frontend/src/app/features/chat/chat.store.ts:30 — minor — `ChatStore` is a root singleton and `AuthService.clear()` (`auth.service.ts:45`) doesn't reset it. After logout, the next user on the same browser briefly sees the previous user's messages, conversations and quota until `init()` reloads, and can send with the previous `activeId` (the server then returns 404). Add a `reset()` to the store and call it from `clear()`/`logout()`, or provide the store at the `ChatPage` level.
- [integration-tests-not-run] backend/test/integration/*.test.ts — minor — 46 integration tests (every DB-backed AC path, including AC-12 cost equality, AC-14 union equals ledger, AC-15/16 blocking, and the p95 perf test) couldn't run in this review because no test DB is configured. The code looks correct, but whether they pass is unverified. Before QA, run `npm test` with a real `DATABASE_URL_TEST` (PG 18) and attach the output.
- [routes-bypass-service-layer] backend/src/routes/conversation-routes.ts:9 — minor — the route takes `Repositories` and calls `repos.conversations` / `repos.messages` directly. CLAUDE.md layering is routes → services → repositories. Move this into a small `ConversationService` (`list(userId)` and `getOwned(id, userId)` returning DTOs).

## Deviations the orchestrator asked me to judge
- **`backend/jest.config.cjs`, `backend/sequelize-cli-config.cjs` as CommonJS:** accepted, no deduction. These are tool config files: sequelize-cli needs a JS config, and the spec layout's `jest.config.ts` would need ts-node for no benefit. Migrations, the item spec §1.1 actually guards, are strict TS compiled with `tsconfig.migrations.json`, so the `.cjs` migration fallback wasn't used and doesn't need user approval. The `.cjs` files are excluded from ESLint, which is fine because they hold no app logic.
- **No seeders (the migration inserts the settings row):** accepted. Spec §3 explicitly puts the settings insert in the migration (AC-24a), and the admin is bootstrapped at startup (§5.3, AC-1). No seeder content is needed, so dropping `db:seed:all` from `npm run migrate` is correct. Spec §1.1's mention of seeders is moot.
- **Fonts and Material Icons from a CDN (`frontend/src/index.html:9-11`):** accepted for a local demo, no deduction. Not on the "Not allowed" list. Side effects: the UI needs internet access for icons and fonts, and Google receives the page referrer. If offline use or privacy matters, self-host later via `@fontsource/roboto` and `material-icons`.
- **Compose blanks `DATABASE_URL`/`DATABASE_URL_TEST` (`litellm/docker-compose.yml:13-16`):** accepted, and it's a good call. `env_file: ../.env` would otherwise give LiteLLM the app's Postgres URL and make it stateful, against the PRD ("LiteLLM database ... Out"). `STORE_MODEL_IN_DB=False` adds to this.
- **Extra `resetsAt` in quota-block `details`:** not a deviation. Spec §4 defines `details = { limit, resetsAt, resetsAtIst, quotaUsd, usedUsd }`, and the code matches it exactly (`quota-service.ts:107-113`).

## T-2 gate status (not scored)
- Only Path A (SSE streaming with `stream_options.include_usage`, cost from the final chunk `usage.cost`) is built, behind a single `chat()` with a TODO (`llm-gateway.ts:104-107`). There is **no Path B**, no `stream: false`, no `x-litellm-response-cost` read, and no `/spend/calculate`. A missing cost raises `LlmError`, nothing is saved, and an `error` event is sent (unit and integration tests cover this). This matches the orchestrator's instruction and is not a blocker.
- Still open: run the T-2 curl against the pinned `ghcr.io/berriai/litellm:main-v1.83.14-stable` once an Anthropic key exists. If `usage.cost` is absent, stop and escalate per R-1.

## What was checked and is in good shape
- Cost is only parsed from the LiteLLM response (`parseUsage`, using zod, `String(cost)` turned into a Decimal with 6 dp HALF_UP, and the raw value kept in `litellm_cost_raw`). The app never prices anything. `maxRetries: 0` prevents a retry from billing twice.
- Quota: settings are read fresh on every call. System is checked first, then user, against `COALESCE(override, default)` using `Decimal.gte`. The check runs before SSE headers and before any LLM call. The overshoot rule (AC-17) is implemented.
- AC-14 union (`usage-repository.ts:33-56`): each day comes from exactly one source, all queries use named replacements, and there is no string concatenation of values.
- Rollup: advisory lock, then delete and re-insert per day, all in one transaction. Today and future dates are refused. Catch-up on startup, cron at 00:05 Asia/Kolkata, CLI and admin endpoint all present.
- Persistence: conversation, both messages, ledger row and `updated_at` touch happen in one Sequelize transaction. On client disconnect the upstream keeps being consumed and the data is still saved.
- Auth: bcrypt cost 12, HS256 with the algorithm pinned, 12 h TTL, user reloaded on every request with an `is_active` and `token_version` check, role taken from the DB, dummy-hash timing equalisation, and the same 401 for a wrong email or a wrong password. Self-lockout guard is in place. pino redacts authorization, cookie, password and token fields.
- Schema: every table, enum, CHECK and index from spec §3 is present. Money is `numeric(14,6)`, timestamps are `timestamptz`. There is no `sync()` anywhere.
- Frontend: Angular 20 standalone components with signals and Material, a fetch-based SSE parser, text-only rendering (no `innerHTML`), all `data-testid`s from T-14 present, and decimal-string comparison for sorting (no float maths on money).

## Open items carried from the spec (unchanged)
- Provisional Q3 to Q6 in spec §9 are still pending user confirmation. The code follows the provisional defaults: system reported first, nothing saved on failure, 12 h JWT in localStorage, and the luxon/node-cron/pino/helmet additions.
