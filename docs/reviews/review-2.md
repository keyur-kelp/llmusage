VERDICT: APPROVE
SCORE: 97/100
BLOCKERS: 0  MAJORS: 0  MINORS: 2

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 25 | none |
| Correctness | 25 | 25 | none |
| Tests | 20 | 18 | integration-tests-not-run −2 |
| Security | 15 | 14 | stream-survives-logout −1 |
| CLAUDE.md rules | 15 | 15 | none (CLAUDE.md doc drift flagged for the user, not scored against the code) |
| **Total** | 100 | **97** | |

Review round 2. Scope: every file in `git status --porcelain` (the whole change set is untracked, so it was reviewed by reading the files). Focus: the 7 fixes from review-1 and the new LiteLLM compose setup. `.env` was not read.

## Test and lint run
- `DATABASE_URL_TEST= npm test`
  - Backend Jest: **6 unit suites passed (66 tests)**, up from 5/60. New: `conversation-service.test.ts`, plus trim and `buildHistory` cases in `schemas.test.ts`. **5 integration suites skipped (46 tests)**, with the clear SKIPPED warning (not reported as passed).
  - Frontend Karma: **42 of 42 passed**, up from 37. New: `istToday`/`defaultIstRange` across the IST day boundary, and `ChatStore.reset()`.
- `npm run lint`: ESLint plus backend `tsc --noEmit` (app and migrations) are clean, exit 0.

## Issues
- [integration-tests-not-run] backend/test/integration/*.test.ts — minor — still open, and deliberately so: Postgres.app is refusing connections from this app and the user is fixing that. 46 DB-backed tests (AC-12, AC-14, AC-15/16, the p95 perf test, and others) are still unverified. Before QA signs off, run `npm test` with a real `DATABASE_URL_TEST` (PG 18) and attach the output.
- [stream-survives-logout] frontend/src/app/features/chat/chat.store.ts:140 — minor — this is left over from the `chat-store-not-reset-on-logout` fix. `reset()` clears state, but a `send()` that is still streaming is not aborted. If the user clicks "Log out" (`chat.page.ts:37`) mid-stream, `onDone` later writes the previous user's `activeId`, messages and quota back into the reset store. If the next user logs in before that stream ends, they briefly see the old data. The server still enforces ownership, so a send with the stale `activeId` gets a 404. Fix: keep an `AbortController` (or a generation counter) in the store, abort it or bump the counter in `reset()`, and ignore callbacks from an older generation.

## Resolved since last review
- money-number-lint-gap: `eslint.config.mjs:27-35` adds `no-restricted-syntax` on `Number(...)` for `backend/src/services/**` and `backend/src/repositories/**`. The 4 allowed uses carry `-- count, not money` disable comments (`usage-repository.ts:112-117`, `rollup-repository.ts:35`), and all 4 are genuine counts.
- chat-message-not-trimmed: `chat-service.ts:14` uses `z.string().trim().min(1).max(20000)`, with unit tests for whitespace-only and trimming.
- empty-assistant-answer-persisted: the ledger row and the (empty) assistant message are still saved, because spend happened. `buildHistory` (`chat-service.ts:152-156`) now drops empty assistant turns, so the conversation stays usable. A unit test covers it. This matches the fix review-1 asked for.
- chat-init-unhandled-rejection: `loadConversations`/`refreshQuota`/`loadModels` each catch their own errors and set `error`/`modelsError` (`chat.store.ts:66-95`). `init()` can no longer reject, so the `paramMap` subscription is always set up.
- usage-range-default-local-tz: `defaultIstRange(new Date())` (`format.ts:33-36`) builds the range from `istToday`, which uses `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })`. It returns local-midnight `Date`s for the picker, so `toIsoDate` gives back the IST calendar date. The boundary is unit-tested.
- chat-store-not-reset-on-logout: `ChatStore.reset()` exists and is called from `AuthService.clear()` through a lazy `Injector` lookup, which avoids the ChatStore, ChatStreamService, AuthService cycle. That covers logout, an invalid token and a 401 or disabled account. The in-flight stream edge case is tracked separately as `stream-survives-logout`.
- routes-bypass-service-layer: the new `ConversationService` (`list`, `getOwned` returning DTOs, 404 for non-owners) is used by `conversation-routes.ts`, and no route touches `Repositories` any more. Unit-tested.

## LiteLLM compose change (assessed)
- `litellm/docker-compose.yml` is **accepted and better than review-1's version**. Dropping `env_file: ../.env` means the app's `DATABASE_URL`/`DATABASE_URL_TEST` never reach the container, and the old setup's blank values were enough to trigger prisma and crash the proxy. LiteLLM now gets only `ANTHROPIC_API_KEY` (`:-`, optional, so the proxy can start before a key exists), `LITELLM_MASTER_KEY` (`:?`, so compose fails fast with a clear message if it's missing) and `STORE_MODEL_IN_DB=False`. This is stateless, follows least privilege, and leaks no app secrets such as `JWT_SECRET` or the DB URL into the container. It matches the PRD ("LiteLLM database ... Out") and CLAUDE.md ("stateless, config file only").
- `--env-file .env` from the repo root is needed because compose otherwise looks for `.env` next to the compose file (`litellm/.env`). The README (`README.md:14`) and the compose header comment both show the new command.
- Minor caveat, not scored: compose interpolates `$` in values read through `--env-file`. A master key or API key containing `$` would need `$$` or quotes. Real Anthropic keys and the suggested master-key format don't contain `$`.
- **Spec updated (tech-lead-owned):** `docs/tech-spec.md` §2 layout line and T-2 now describe the no-`env_file` setup, the per-variable `${VAR}` interpolation, `STORE_MODEL_IN_DB=False` and the `--env-file .env` start command, with the reason (any `DATABASE_URL` triggers prisma).
- **For the user (not edited, CLAUDE.md is yours):** `CLAUDE.md:29` still says `docker compose -f litellm/docker-compose.yml up -d`. Run that way, it fails fast with "set LITELLM_MASTER_KEY in .env" unless the variable is exported in the shell. Please change it to `docker compose --env-file .env -f litellm/docker-compose.yml up -d`. `docs/prd.md:96` says only "`docker compose up` for LiteLLM", which is informal and can stay as it is (PM-owned).

## T-2 gate status (not scored, unchanged)
- Path A only, orchestrator-approved. The curl check against the pinned `main-v1.83.14-stable` image for `usage.cost` in the final stream chunk is still pending an Anthropic key. If cost is absent, stop and escalate per R-1.

## Open items carried from the spec (unchanged)
- Provisional Q3 to Q6 in spec §9 are still pending user confirmation.
