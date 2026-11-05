VERDICT: APPROVE
SCORE: 98/100
BLOCKERS: 0  MAJORS: 0  MINORS: 2

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 24 | t2-gate-todo-stale −1 |
| Correctness | 25 | 25 | none |
| Tests | 20 | 19 | cost-float-artifact-untested −1 |
| Security | 15 | 15 | none |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **98** | |

Review round 3. Scope: every file in `git status --porcelain`. The change set is untracked, so I reviewed it by reading the files. Focus: the revised T-1/T-2/T-14 (LiteLLM has its own DB, the provider key is stored as credential `anthropic`, `STORE_MODEL_IN_DB=True`, `DEFAULT_MODEL`), the `stream-survives-logout` fix, and the T-2 gate result the orchestrator verified on the live environment. I did not read `.env`.

## Test and lint run
- `npm test` was run in full. `DATABASE_URL_TEST` was set from `.env` and not blanked, so the integration suites ran against PG 18.
  - Backend Jest: **12 of 12 suites passed, 116 of 116 tests passed, 0 skipped.** That is 5 integration suites (admin, auth, chat, perf, rollup) and 7 unit suites, including the new `model-routes.test.ts`. Migrations were already up to date on the test DB. The perf test reports `quota.check p95 = 5.3 ms`.
  - Frontend Karma (ChromeHeadless): **44 of 44 passed**, up from 42. New tests: reset() aborts the stream in flight, and a late `done` cannot repopulate the store.
  - Exit code 0.
- `npm run lint`: ESLint plus backend `tsc --noEmit` (app and migrations) are clean. Exit code 0.

## Blocker check: ANTHROPIC_API_KEY
I grepped `backend/src`, `backend/test`, `backend/migrations`, `frontend/src`, `litellm/`, `.env.example`, `README.md`, `package.json`, `playwright.config.ts` and `tests/`. **There are no matches.** The name now appears only in docs and the agent memory, as "no ANTHROPIC_API_KEY". `config.yaml` uses `litellm_credential_name: anthropic` for all three models and has no `api_key` and no `os.environ/ANTHROPIC_*`. **No blocker.**

## Issues
- [t2-gate-todo-stale] backend/src/services/llm-gateway.ts:104 — minor — The comment `TODO(T-2 gate UNVERIFIED) ... The gate ... has not been run` is now false, because the gate passed on 2026-11-05 and Path A is confirmed (spec R-1 and T-2). Replace it with a short note: "Path A: T-2 gate passed 2026-11-05; cost comes from the final stream chunk `usage.cost` (include_cost_in_streaming_usage). No fallback pricing."
- [cost-float-artifact-untested] backend/test/unit/llm-usage.test.ts:8 — minor — The live haiku cost `5.999999999999999e-6` is handled correctly. I checked it by hand: `String(5.999999999999999e-6)` is `"0.000005999999999999999"`, and `new Decimal(...)` rounded HALF_UP to 6 dp gives `"0.000006"`, with no float math (`money.ts:13-15`). The raw string is 23 characters and fits `litellm_cost_raw varchar(64)`. No unit test pins this case, though. Add `parseUsage({ ..., cost: 5.999999999999999e-6 })` and expect `costUsd: '0.000006'` and `costRaw: '0.000005999999999999999'`. Also add an exponent-form case below 1e-7, e.g. `cost: 4e-8` gives `costUsd: '0.000000'` and `costRaw: '4e-8'`. Decimal parses exponent strings, but this should be locked in by a test.

## Resolved since last review
- integration-tests-not-run: Postgres now accepts connections. All 5 integration suites ran and passed, 0 skipped. That covers AC-12, AC-14 (rollup union equals the ledger sum), AC-15/16, the auth/admin paths and the p95 perf check.
- stream-survives-logout: `chat.store.ts` adds `generation` and `abort: AbortController`. `reset()` increments the generation and aborts before clearing state. `send()` captures `gen` and passes `abort.signal` to `ChatStreamService.stream` (the `fetch` `signal`). `onDelta`, `onDone` and `onError` all return early when the generation is stale. The catch path and the tail of `send()` return `false` without touching the reset store. The abort controller is released only if it is still the current one. Covered by the new Karma test.

## Revised T-1 / T-2 / T-14 (assessed, all to spec)
- `litellm/docker-compose.yml`:
  - It has no `env_file`, and only `LITELLM_MASTER_KEY`, `LITELLM_SALT_KEY` and `DATABASE_URL: ${LITELLM_DATABASE_URL:?}` are passed in. All three use `:?` and fail fast.
  - `STORE_MODEL_IN_DB: "True"`, `extra_hosts host.docker.internal:host-gateway`, the image pinned to `main-v1.83.14-stable`, and config mounted `:ro` are all present.
  - The header comment no longer says "stateless".
  - The app's `DATABASE_URL` cannot reach the container.
- `litellm/config.yaml`: the order is sonnet, haiku, opus, each with `litellm_credential_name: anthropic`. It has `master_key: os.environ/LITELLM_MASTER_KEY`, `include_cost_in_streaming_usage: true` and `drop_params: true`.
- `.env.example`:
  - `LITELLM_SALT_KEY` carries the "set once, never change" comment.
  - `LITELLM_DATABASE_URL` uses `host.docker.internal` and explains it is written from the container's view.
  - It includes `DEFAULT_MODEL=claude-sonnet-5-5` and has no provider key.
  - The backend `env.ts` does not read `LITELLM_DATABASE_URL` or `LITELLM_SALT_KEY`, as the spec requires. The app never touches LiteLLM's DB.
- README step 3 covers `createdb litellm`, setting a role password (R-10, no `pg_hba` loosening), the `--env-file .env` start command, and creating the UI credential named exactly `anthropic`.
- `GET /api/models`:
  - It returns `{ models, defaultModel }`. `pickDefaultModel` uses `DEFAULT_MODEL` if it is listed, otherwise the first id, otherwise `null`.
  - The env default is `claude-sonnet-5-5` (zod default). If LiteLLM is down, the route returns 502 `LLM_UNAVAILABLE`.
  - Unit-tested, including a list in which sonnet is not first.
  - The frontend `loadModels` pre-selects `defaultModel`, guarded against ids that are not listed.
- Cost path:
  - Path A only. Cost comes from the final chunk's `usage.cost`. A missing, negative or non-numeric cost raises `LlmError`, and nothing is persisted.
  - There is no `/spend/calculate`, no app-side pricing and no `parseFloat`.
  - `maxRetries: 0` avoids double billing.

## T-2 gate (resolved, recorded in the spec)
- **PASSED, Path A confirmed** on the live pinned image:
  - The `litellm` DB is connected.
  - Credential `anthropic` resolves for all three config models, so R-13 option (a) works.
  - The final stream chunk carries `usage.cost` for sonnet (`0.000134`, 17 in / 10 out tokens), haiku (`5.999999999999999e-6`) and opus (`0.00024`).
  - Non-streamed requests carry the cost only in `x-litellm-response-cost`. That doesn't matter, because Path B is not built.
- `docs/tech-spec.md` has been updated (tech-lead-owned): T-2 is marked done/PASSED, and R-1 has a "RESOLVED 2026-11-05" entry with the measured values and the haiku rounding note (R-2 in practice).
- Note on `litellm_cost_raw`: it stores `String(cost)` of the parsed JSON number, as spec §5.4 defines (`"0.000005999999999999999"`), not the literal JSON token text (`5.999999999999999e-6`). Both are the same IEEE double, so audit value equality holds. This is not a deviation.

## Doc drift (for the user, not scored)
- None outstanding. `CLAUDE.md:9-10,29` now describes the LiteLLM DB and the `--env-file` command. `docs/prd.md:97` now says that the provider key is a LiteLLM credential, not part of `.env`.

## Open items carried from the spec (unchanged)
- Provisional Q3 to Q6 in spec §9 still need user confirmation.
