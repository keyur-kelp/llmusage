RESULT: PASS
AC_PASS: 30/30 (100%)  COVERAGE: 98.04%  UNIT: 188/188

# QA report - round 2 (2026-11-05), regression after the frontend UI/UX rework

Round 1 is archived at `docs/qa/report-1.md`.

**Spec runs (full suite, 35 Playwright tests each, 3 runs in a row):** run 1 35/35 (1.7m), run 2 35/35 (1.5m), run 3 35/35 (1.5m). No flakes, no retries.
**Unit:** backend Jest 116/116 (12 suites), frontend Karma 72/72 = 188/188.
**Backend coverage (All files):** statements 96.9%, branches 82.92%, functions 97.14%, lines 98.04%.

**Commands**
- Spec: `BASE_URL=http://localhost:4300 npx playwright test -c tests/playwright.qa.config.ts --output=<dir outside test-results/>`. Port 4300 is a stable `ng build` served statically (proxy `/api` to :3000), used for the acceptance runs so dev-server live reload cannot interfere. The :4200 dev server was left running and was used for the MCP live checks.
- Unit: `npm test -w backend -- --coverage`, `npm test -w frontend`.

**Test changes (tests/acceptance/ui-flows.spec.ts only, no AC assertion weakened)**
- `uiLogin`: waits for network idle, fills with `toPass` retry, asserts `toHaveValue` on both fields and `toBeEnabled` on submit before clicking; a `beforeAll` warm-up navigation was added. Other clicks (send, settings save, user save) now assert enabled/value first.
- AC-27 UI duplicate step rewritten per review-4 `user-dialog-closes-on-server-error`: it no longer depends on the dialog staying open. It asserts the message "already exists" is shown, then (after a reload) exactly one row for that email in the UI and exactly one user for that email via `GET /admin/users`.

## Per-run results
| AC | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| AC-1..5 (ac-01-05 + UI AC-2/3/4) | pass | pass | pass |
| AC-6..12 (ac-06-12 + UI chat/isolation) | pass | pass | pass |
| AC-13/14/18/19/26 (disposable DB) | pass | pass | pass |
| AC-15/16/17/20/21 (+ UI AC-23) | pass | pass | pass |
| AC-24a/24/25/27/28 (+ UI admin) | pass | pass | pass |
| AC-29 | pass | pass | pass |

## AC table
| AC | test(s) | MCP live check | Result | Evidence |
|---|---|---|---|---|
| AC-1 | ac-01-05 "AC-1" | n.a. | PASS | Two backend starts on a fresh DB: 1 ADMIN, no duplicate. 3/3 runs. |
| AC-2 | ac-01-05 "AC-2"; ui-flows "AC-2 UI login" | PASS `test-results/mcp/AC-2.png` (+ `AC-2-invalid.png`) | PASS | Bad password: 401, UI "Invalid email or password", stays on /login, no token in storage. Valid login lands on /chat. 3/3 runs (the previously flaky first attempt is stable). |
| AC-3 | "AC-3"; ui-flows "AC-3 UI deactivated" | PASS `AC-3.png` | PASS | Deactivated login 403 and old token rejected on every endpoint; UI shows login error. MCP: deactivate via toggle shows the new confirm dialog, confirm, then that user's login returns 403. |
| AC-4 | "AC-4"; ui-flows "AC-4 UI admin guard" | PASS `AC-4.png` | PASS | USER 403 on all 10 admin endpoints; UI: no admin link, /admin redirects to /chat. Admin can open /admin. |
| AC-5 | "AC-5" | n.a. | PASS | bcrypt hashes, unique salts, no plaintext in DB or logs. |
| AC-6 | ac-06-12 "AC-6"; ui-flows | PASS `AC-6.png`, mobile `AC-6-mobile.png` (390x844) | PASS | Picker shows the 3 LiteLLM models in order on desktop and mobile; matches /api/models. |
| AC-7 | "AC-7"; ui-flows | PASS `AC-7.png`, mobile `AC-7-mobile.png` | PASS | Several delta events before done; ledger row carries the LiteLLM call id. UI renders Markdown reply (`<p>`, `<ol>`) with the model label; mobile has no horizontal scroll and the composer/send button are in the viewport. |
| AC-8 | "AC-8"; ui-flows | PASS `AC-8.png` | PASS | After reload the conversation is in the sidebar; user + assistant messages with model claude-sonnet-5-5. |
| AC-9 | "AC-9" | n.a. | PASS | Context recalled in message 2; 4 messages in one conversation. |
| AC-10 | "AC-10"; ui-flows | PASS `AC-10.png` | PASS | Other user and admin get 404; UI "Conversation not found", empty sidebar, no leaked text. |
| AC-11 | "AC-11" | n.a. | PASS | Ledger row has user, conversation, model, tokens, 6 dp cost, timestamp. |
| AC-12 | "AC-12" | n.a. | PASS | costUsd equals LiteLLM cost (6 dp) and /spend/logs. |
| AC-13 | ac-13-14-18-19-26 "AC-13" | n.a. | PASS | One rollup row per user/model/day; re-runs do not double count. |
| AC-14 | "AC-14" | n.a. | PASS | Rollup + today's ledger = plain ledger sum. |
| AC-15 | "AC-15 + AC-17"; ui-flows AC-23 | PASS (see AC-23) | PASS | 429 USER_QUOTA_EXCEEDED with IST reset; no ledger row written. |
| AC-16 | "AC-16" | n.a. | PASS | 429 SYSTEM_QUOTA_EXCEEDED for user and admin; no ledger writes. |
| AC-17 | "AC-15 + AC-17" | n.a. | PASS | First message over quota allowed, next blocked. |
| AC-18 | "AC-18" | n.a. | PASS | All 7 weekdays, IST boundaries 7 days apart. |
| AC-19 | "AC-19" | n.a. | PASS | Day-of-month 1/5/15/28 boundaries correct. |
| AC-20 | "AC-20" | n.a. | PASS | Setting changes apply on next message, no restart. |
| AC-21 | "AC-21" | PASS `AC-21.png` | PASS | Override cleared via the edit dialog (empty field) shows "default" in the Users table; API test confirms default quota applies. |
| AC-22 | "AC-22"; ui-flows | PASS `AC-22.png`, mobile `AC-22-mobile.png` | PASS | Desktop panel: "$0.099270 left", "of $0.100000", "99.27% left" for weekly and "$0.431924 left / 86.38% left" for system; updates after the message. Mobile: compact strip "You $0.099194 left - 99.19%", "Sys $0.431772 left - 86.35%", expands to full panel with reset times. |
| AC-23 | ui-flows "AC-23" | PASS `AC-23.png`, mobile `AC-23-mobile.png` | PASS | "Personal quota reached" + "Resets 07 Nov 2026, 00:00 IST" desktop and mobile (two-line banner, "Used up" chip); system block variant shows system reason + IST reset (spec). |
| AC-24a | ac-24-28 "AC-24a" (disposable DB) | n.a. | PASS | 100 / 10 / Saturday(6) / 1 after migrations. |
| AC-24 | "AC-24"; ui-flows | PASS `AC-24.png` | PASS | Valid values accepted; 16 invalid payloads 400 VALIDATION_ERROR; UI "-5" disables Save. |
| AC-25 | "AC-25"; ui-flows | PASS `AC-25.png` | PASS | "$0.068228 used of $0.500000"; per-user used/quota/remaining/% table; default sort used desc; Used header cycles desc, none, asc. |
| AC-26 | "AC-26" (disposable DB) | PASS `AC-26.png` | PASS | Daily rows (date, user, model, tokens, cost, requests); user filter returns the matching row with total $0.000806 equal to the row; totals = ledger SQL sums (spec). |
| AC-27 | "AC-27"; ui-flows "AC-24..28 UI admin" | PASS `AC-27.png` | PASS | Create OK; duplicate shows "A user with this email already exists" (409 EMAIL_TAKEN), still exactly one row; edit, override set/clear, reset password, deactivate all work. |
| AC-28 | "AC-28"; ui-flows | PASS `AC-28.png` | PASS | Self-deactivate / self-demote 409 SELF_LOCKOUT; UI own active toggle disabled. |
| AC-29 | ac-29 "AC-29" | PASS `AC-29.png` | PASS | `qa-r2-extra` alias added via LiteLLM appears as 4th picker option; chat reply labelled with that model; ledgered and counted (spec); alias deleted afterwards. |

**Console / network (MCP):** only error was the intentional 401 on bad login (and the 409 on duplicate create). All other /api calls 200. One warning, see below.

## Bugs outside ACs
- **Low (confirmed, from review-4 `user-dialog-closes-on-server-error`):** the create-user dialog closes before the server answers. On a duplicate email the typed data is lost and the error only appears as a snackbar ("A user with this email already exists"). AC-27 is met (rejected, clear message, no second row), but the UX is worse than the dialog staying open with an inline error. Observed live in MCP: dialog gone, snackbar shown, 1 row.
- **Low:** Angular dev warning `NG0953: Unexpected emit for destroyed OutputRef` on the chat page after the first message of a new conversation (also in round 1). No visible effect.
- **Low (security, from review-4 `md-remote-images`):** Markdown rendering allows remote `<img src>`, a zero-click exfiltration channel for prompt-injected replies. Not tested by an AC.
- **Info:** initial bundle 506.65 kB, 6.65 kB over the 500 kB warning budget (warning only).
- **Info:** /admin Usage user table renders all rows (295 here, leftover test users) with no pagination; fine for the demo.

## Blocked by environment
Nothing blocked the pass. Notes:
- The pinned Playwright chromium is not installed, so specs run via `tests/playwright.qa.config.ts` with installed Google Chrome.
- `playwright test` wipes `test-results/` unless `--output` points elsewhere; the runs used an output dir in the scratchpad so `test-results/mcp/` (and `test-results/ux/`) survived.

## Environment / cleanup
- Baseline confirmed after the run: system $0.50, default user $0.10, reset Saturday / day 1; all per-user overrides cleared (24 leftover overrides from QA test users cleared; ux-* accounts untouched). LiteLLM models back to sonnet, haiku, opus. The :4300 static server was stopped; :4200 dev server still running.
- MCP test accounts (`qa-mw3o1*@example.test`) remain in the app DB, one of them deactivated (the AC-3 check). Also `mcp-r2-dup@example.test`.
