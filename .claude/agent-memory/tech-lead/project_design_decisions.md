---
name: project-design-decisions
description: Durable design decisions for LLM usage control demo tech spec — LiteLLM own DB, streaming-cost gate, rollup union rule, quota check order, TS migrations, PG 18, model ids, provisional Q3-Q6
metadata:
  type: project
---
Decisions in docs/tech-spec.md (first written 2026-11-05, revised same day with user answers):
- **Cost (R-1, user decision 2026-11-05):** cost only from LiteLLM on the response of that request. T-2 is a decision gate: cost in final stream chunk `usage.cost` -> Path A (SSE streaming). Not present -> Path B (non-streamed call, cost from response body/`x-litellm-response-cost`; endpoint still SSE with a single `delta` event). `/spend/calculate` after-the-fact pricing is REJECTED by the user. Path B conflicts with PRD AC-7 + CLAUDE.md streaming, so engineer must stop at the gate and the user must change AC-7 first. Only one path implemented, no runtime toggle.
- Period usage = rollup rows for days in `usage_rollup_days` + ledger rows for days not in it (IST `usage_date`). Rollup = delete+reinsert per day under advisory lock.
- Quota check order: SYSTEM first, then USER. Settings read fresh every request.
- **T-2 gate PASSED 2026-11-05 → Path A final** (recorded in spec R-1/T-2). R-13 option (a) credential-from-config works.
- Migrations in TS, compiled for sequelize-cli; `.cjs` fallback is a stack deviation needing user OK.
- Postgres is version 18 (user-confirmed).
- LiteLLM models: claude-sonnet-5-5 (first/default), claude-haiku-5-5, claude-opus-5-5. QA acceptance uses Sonnet.
- Risks R-2..R-9 accepted by user as written.
- **LiteLLM has its own DB (user decision 2026-11-05, supersedes "stateless"):** separate `litellm` DB on the same host PG 18 (Postgres.app), never the app's `llmusage`, never in Docker. Env `LITELLM_DATABASE_URL`, written with `host.docker.internal` directly (my choice: compose can't substring-replace localhost); compose maps it to container `DATABASE_URL` via `${LITELLM_DATABASE_URL:?}`, plus extra_hosts host-gateway. Still no env_file; app's DATABASE_URL never passed in. (Superseded same day:) **Provider key in LiteLLM UI, not .env:** no ANTHROPIC_API_KEY anywhere; user adds credential named `anthropic` in /ui; STORE_MODEL_IN_DB=True. Chose option (a): config.yaml keeps the 3 models (sonnet, haiku, opus) with `litellm_credential_name: anthropic` so baseline models stay in git; option (b) all-in-UI is fallback needing approval (R-13). Picker default via app env `DEFAULT_MODEL` (default claude-sonnet-5-5), `GET /api/models` returns `defaultModel`, since /v1/models order isn't guaranteed with DB models. LITELLM_SALT_KEY required, never changes (R-12). UI-added models appear with no restart (AC-29). Engineer never handles provider key. PRD line ~97 still lists ANTHROPIC_API_KEY in .env (PM-owned; flagged). LiteLLM's internal Prisma migrations are allowed (not app code). App never reads LiteLLM DB; cost gate unchanged. `createdb litellm` is a README setup step. R-10: Postgres.app pg_hba trust may reject Docker VM -> user sets password; engineer must report, not loosen auth. R-11: shared DB name = blocker.
- Provisional, pending user confirmation (spec section 9): Q3 system limit reported when both hit; Q4 nothing saved on LLM failure; Q5 12h JWT in localStorage, no refresh; Q6 luxon/node-cron/pino/helmet added.

**Why:** keeps cost authoritative from LiteLLM (AC-12) and AC-14 union == ledger sum; user explicitly preferred losing streaming over after-the-fact pricing.
**How to apply:** in REVIEW, blocker for: any app-side cost computation, `/spend/calculate`, Path B without user-approved AC-7 change, sync(), parseFloat on money, check-order change. Re-check spec section 9 for answers to provisional Q3-Q6.
