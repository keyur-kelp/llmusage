RESULT: PASS
AC_PASS: 30/30 (100%)  COVERAGE: 98.04%  UNIT: 160/160

# QA report — round 1 (2026-11-05)

> Written by the orchestrator from the QA agent's returned report (the QA agent's Write tool was refused). Content is the QA agent's findings; the orchestrator re-ran the acceptance suite to confirm (see "Orchestrator verification" at the end).

**Spec tests:** 35 Playwright tests in `tests/acceptance/`, all pass.
**Unit:** backend Jest 116/116 (12 suites, incl. integration on `DATABASE_URL_TEST`) + frontend Karma 44/44.
**Backend coverage (All files):** statements 96.9%, branches 82.92%, functions 97.14%, lines 98.04%.

**Commands**
- Spec: `npx playwright test -c tests/playwright.qa.config.ts` (root config + `channel: 'chrome'`, see Blocked by environment)
- Unit: `npm test -w backend -- --coverage` and `npm test -w frontend`

**Environment / baseline:** test quotas $0.50 system / $0.10 default user (per user instruction), restored afterwards; reset Saturday / day-of-month 1; all per-user overrides cleared; extra LiteLLM test model deleted (models back to sonnet, haiku, opus). AC-24a fresh-DB defaults ($100/$10/Saturday/1) checked on disposable `DATABASE_URL_TEST`. Chat tests use `claude-sonnet-5-5`.

| AC | Test(s) | MCP live check | Result | Evidence |
|---|---|---|---|---|
| AC-1 | ac-01-05 "AC-1" | n.a. | PASS | Backend spawned twice on a freshly migrated disposable DB (port 3101): 1 ADMIN after first start, still exactly 1 after second; admin can log in. |
| AC-2 | ac-01-05 "AC-2"; ui-flows | PASS `test-results/mcp/AC-2.png` | PASS | Bad password → 401 INVALID_CREDENTIALS, no token; unknown email same message. UI shows "Invalid email or password", stays on /login. Valid login lands on /chat. |
| AC-3 | "AC-3"; ui-flows | PASS AC-3.png | PASS | Deactivated: login 403; existing token rejected on /auth/me, /models, /quota/me, /conversations, chat. Reactivation restores. UI "This account has been disabled", no token stored. |
| AC-4 | "AC-4"; ui-flows | PASS AC-4.png | PASS | USER → 403 on all 10 admin endpoints; ADMIN → 200; role change applies immediately. UI: no admin link for USER, /admin redirects to /chat. |
| AC-5 | "AC-5" | n.a. | PASS | password_hash bcrypt pattern; same password → different hashes; no plaintext column; spawned backend logs contain none of the passwords/tokens used. |
| AC-6 | ac-06-12 "AC-6"; ui-flows | PASS AC-6.png | PASS | /api/models = LiteLLM /v1/models (3, same order); picker shows same 3; unknown model → 400 MODEL_NOT_AVAILABLE. |
| AC-7 | "AC-7"; ui-flows | PASS AC-7.png | PASS | Real Sonnet reply arrives as several delta events before done; ledger row has LiteLLM call id; UI shows streamed answer with model label. |
| AC-8 | "AC-8"; ui-flows | PASS AC-8.png | PASS | After reload conversation is in sidebar; both messages shown with model claude-sonnet-5-5. |
| AC-9 | "AC-9" | n.a. | PASS | Code word from message 1 recalled in message 2; conversation holds 4 messages; unknown conversation id → 404. |
| AC-10 | "AC-10"; ui-flows | PASS AC-10.png | PASS | Other user and admin both get 404, cannot post; UI "Conversation not found", no leaked content. |
| AC-11 | "AC-11" | n.a. | PASS | Ledger row: user, conversation, model, tokens > 0, cost 6 dp, createdAt; one row per response. |
| AC-12 | "AC-12" | n.a. | PASS | costUsd = round6(litellmCostRaw) on every row and = done.usage.costUsd; matches LiteLLM /spend/logs (same tokens, same 6 dp). |
| AC-13 | ac-13-14-18-19-26 "AC-13" (disposable DB) | n.a. | PASS | One rollup row per user/model with correct sums (e.g. 0.300003 over 2 requests); re-run via API ×2 and CLI leaves rows identical; today/future → 400 ROLLUP_DATE_NOT_PAST; cron `5 0 * * *` Asia/Kolkata. |
| AC-14 | "AC-14" (disposable DB) | n.a. | PASS | Mixed rolled-up/unrolled usage 1.000010 = plain SQL ledger sum (older row excluded); unchanged after more rollups; admin summary agrees. |
| AC-15 | ac-15-17-20-21 "AC-15 + AC-17"; ui-flows | PASS (see AC-23) | PASS | Override 0.000001 exhausted → 429 USER_QUOTA_EXCEEDED, limit USER, IST reset; ledger/conversation counts unchanged; follow-up blocked; other users unaffected. |
| AC-16 | "AC-16" | n.a. | PASS | System quota 0.000001: user and admin both 429 SYSTEM_QUOTA_EXCEEDED, IST reset, no ledger writes; both exceeded → system wins. |
| AC-17 | "AC-15 + AC-17" | n.a. | PASS | First message allowed though cost exceeded quota; remaining 0.000000 / 0.00%; next blocked. |
| AC-18 | "AC-18" (disposable DB) | n.a. | PASS | All 7 weekdays: periodStart/resetsAt match IST 00:00 instants 7 days apart; used = ledger sum in window; default Saturday. |
| AC-19 | "AC-19" (disposable DB) | n.a. | PASS | Day-of-month 1, 5, 15, 28: period start/end match IST month boundaries; usage before start excluded. |
| AC-20 | "AC-20" | n.a. | PASS | Default user quota, reset weekday and system quota changes visible on next /quota/me and chat, no restart. |
| AC-21 | "AC-21"; admin UI | PASS AC-21.png | PASS | Override 0.000001 blocks; `quotaOverrideUsd: null` restores default, chat works; UI Users table shows "default". |
| AC-22 | "AC-22"; ui-flows | PASS AC-22.png | PASS | done.quota = /quota/me; UI panel shows "$ left (pct%)" for weekly and system, updates after each message. |
| AC-23 | ui-flows "AC-23" | PASS AC-23.png | PASS | UI "Personal quota reached", "Resets 07 Nov 2026, 00:00 IST"; system block shows system reason + IST reset. |
| AC-24a | ac-24-28 "AC-24a" (DATABASE_URL_TEST, migrations undone + re-applied) | n.a. | PASS | Settings: system 100, user 10, user_reset_dow 6, system_reset_dom 1; same via API from backend on that DB. |
| AC-24 | "AC-24"; ui-flows; admin UI | PASS AC-24.png | PASS | 7 weekdays, dom 1/14/28, quota 0 accepted; 16 invalid payloads → 400 VALIDATION_ERROR, settings unchanged; UI "-5" disables Save. |
| AC-25 | "AC-25"; ui-flows | PASS AC-25.png | PASS | System MTD "$x of $0.50"; per-user table used/quota/remaining/%, override shown, sorted by used desc; "Used" header toggles sort. |
| AC-26 | "AC-26" (disposable DB); admin UI | PASS AC-26.png | PASS | Rows date/user/model/tokens/cost/requests, filter by date range and user; totals = SQL ledger sums; UI user filter shows matching row and total. |
| AC-27 | "AC-27"; ui-flows; admin UI | PASS AC-27.png | PASS | Create 201 without hash; duplicate email (incl. upper-case) → 409 EMAIL_TAKEN; edit, override set/clear, password reset (old password and token rejected), deactivate/reactivate work; UI duplicate message, no second row. |
| AC-28 | "AC-28"; admin UI | PASS AC-28.png | PASS | Self-deactivate / self-demote / both → 409 SELF_LOCKOUT for seeded and second admin; other admin can demote a different admin; UI own active toggle disabled. |
| AC-29 | ac-29 "AC-29"; admin UI chat | PASS AC-29.png | PASS | Alias (anthropic/claude-haiku-5-5, credential `anthropic`) added via LiteLLM /model/new appears in /api/models and picker (4 options); chat works, ledger model = alias, cost > 0, counts toward quota; deleted afterwards. |

**Console / network (MCP):** only errors were the intentional 401 (bad login) and 409 (duplicate create).

## Bugs outside ACs
- **Low:** Angular dev warning `NG0953: Unexpected emit for destroyed OutputRef` on the chat page right after the first message of a new conversation (route change). No visible effect.

## Blocked by environment
Nothing blocked the pass. Notes:
- Playwright's pinned chromium (`chromium_headless_shell-1248`) is not installed (only 1208), so `ui-flows.spec.ts` runs via `tests/playwright.qa.config.ts` with installed Google Chrome. Under root `playwright.config.ts` the UI spec needs `npx playwright install` first.
- `playwright test` wipes `test-results/`, deleting the MCP screenshots in `test-results/mcp/` unless the output dir is changed.

## Leftover test data (app DB)
Users `QA n-*`, `mcp-*`, `ui-*`, `mgmt-*`, `h1/h2-*` (@example.test) with conversations and ledger rows, ~$0.014 of system usage against the $0.50 test quota.

## Orchestrator verification
Re-ran `npx playwright test -c tests/playwright.qa.config.ts` (output dir moved outside `test-results/` so MCP screenshots survive): **35 passed (1.5m)**, exit 0, 2026-11-05.
