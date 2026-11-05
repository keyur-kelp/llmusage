RESULT: PASS
AC_PASS: 30/30 (100%)  COVERAGE: 98.04%  UNIT: 218/218

# QA report - round 3 (2026-11-05), regression after the v3 visual refresh

Round 2 is archived at `docs/qa/report-2.md`, round 1 at `docs/qa/report-1.md`.

**Spec runs (full suite, 36 Playwright tests each = 35 AC/UI tests + 1 new theme test, 3 runs in a row, stable `ng build` on :4300 proxying /api to :3000):** run 1 36/36 (1.6m), run 2 36/36 (1.5m), run 3 36/36 (1.5m). No flakes, no retries, no failures.
**Unit:** backend Jest 118/118 (12 suites), frontend Karma 100/100 = 218/218.
**Backend coverage (All files):** statements 96.9%, branches 82.92%, functions 97.14%, lines 98.04%.
**Concurrent DB writer check:** no backend unit/integration failure occurred, so no `ps`/`lsof` capture was needed. The unit suites ran only after the spec runs finished and :4300 was stopped.

**Commands**
- Spec: `BASE_URL=http://localhost:4300 npx playwright test -c tests/playwright.qa.config.ts --output=<dir outside test-results/>`.
- Unit: `npm test -w backend -- --coverage`, `npm test -w frontend`.

**Test changes:** added `tests/acceptance/ui-theme.spec.ts` (outside the ACs). No existing test or AC assertion was changed; the v3 restyle needed no selector changes (testids kept; `quota-*-reset` now on the inner span, still matched).

## Per-run results
| Spec file | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| ac-01-05 (+UI AC-2/3/4) | pass | pass | pass |
| ac-06-12 (+UI chat/isolation) | pass | pass | pass |
| ac-13/14/18/19/26 | pass | pass | pass |
| ac-15/16/17/20/21 (+UI AC-23) | pass | pass | pass |
| ac-24a/24/25/27/28 (+UI admin) | pass | pass | pass |
| ac-29 | pass | pass | pass |
| ui-theme (outside ACs) | pass | pass | pass |

## AC table
| AC | test(s) | MCP live check (1440x900; 390x844 where listed) | Result | Evidence |
|---|---|---|---|---|
| AC-1 | ac-01-05 "AC-1" | n.a. | PASS | Two backend starts on a fresh DB: 1 ADMIN, no duplicate. 3/3 runs. (round 3: 3/3 runs green) |
| AC-2 | ac-01-05 "AC-2"; ui-flows "AC-2 UI login" | PASS `r3-AC-2.png`, `r3-AC-2-invalid.png` | PASS | Bad password: 401, UI "Invalid email or password", stays on /login, no token in storage. Valid login lands on /chat. 3/3 runs (the previously flaky first attempt is stable). (round 3: 3/3 runs green) |
| AC-3 | "AC-3"; ui-flows "AC-3 UI deactivated" | PASS `r3-AC-3.png` | PASS | Deactivated login 403 and old token rejected on every endpoint; UI shows login error. MCP: deactivate via toggle shows the new confirm dialog, confirm, then that user's login returns 403. (round 3: 3/3 runs green) |
| AC-4 | "AC-4"; ui-flows "AC-4 UI admin guard" | PASS (admin sees Admin link and opens /admin; USER guard by spec test; no screenshot this round) | PASS | USER 403 on all 10 admin endpoints; UI: no admin link, /admin redirects to /chat. Admin can open /admin. (round 3: 3/3 runs green) |
| AC-5 | "AC-5" | n.a. | PASS | bcrypt hashes, unique salts, no plaintext in DB or logs. (round 3: 3/3 runs green) |
| AC-6 | ac-06-12 "AC-6"; ui-flows | PASS `r3-AC-6.png`, `r3-AC-6-mobile.png` | PASS | Picker shows the 3 LiteLLM models in order on desktop and mobile; matches /api/models. (round 3: 3/3 runs green) |
| AC-7 | "AC-7"; ui-flows | PASS `r3-AC-7.png`, `r3-AC-7-mobile.png` | PASS | Several delta events before done; ledger row carries the LiteLLM call id. UI renders Markdown reply (`<p>`, `<ol>`) with the model label; mobile has no horizontal scroll and the composer/send button are in the viewport. (round 3: 3/3 runs green) |
| AC-8 | "AC-8"; ui-flows | PASS `r3-AC-8.png` | PASS | After reload the conversation is in the sidebar; user + assistant messages with model claude-sonnet-5-5. (round 3: 3/3 runs green) |
| AC-9 | "AC-9" | n.a. | PASS | Context recalled in message 2; 4 messages in one conversation. (round 3: 3/3 runs green) |
| AC-10 | "AC-10"; ui-flows | PASS `r3-AC-10.png` | PASS | Other user and admin get 404; UI "Conversation not found", empty sidebar, no leaked text. (round 3: 3/3 runs green) |
| AC-11 | "AC-11" | n.a. | PASS | Ledger row has user, conversation, model, tokens, 6 dp cost, timestamp. (round 3: 3/3 runs green) |
| AC-12 | "AC-12" | n.a. | PASS | costUsd equals LiteLLM cost (6 dp) and /spend/logs. (round 3: 3/3 runs green) |
| AC-13 | ac-13-14-18-19-26 "AC-13" | n.a. | PASS | One rollup row per user/model/day; re-runs do not double count. (round 3: 3/3 runs green) |
| AC-14 | "AC-14" | n.a. | PASS | Rollup + today's ledger = plain ledger sum. (round 3: 3/3 runs green) |
| AC-15 | "AC-15 + AC-17"; ui-flows AC-23 | n.a. | PASS | 429 USER_QUOTA_EXCEEDED with IST reset; no ledger row written. (round 3: 3/3 runs green) |
| AC-16 | "AC-16" | n.a. | PASS | 429 SYSTEM_QUOTA_EXCEEDED for user and admin; no ledger writes. (round 3: 3/3 runs green) |
| AC-17 | "AC-15 + AC-17" | n.a. | PASS | First message over quota allowed, next blocked. (round 3: 3/3 runs green) |
| AC-18 | "AC-18" | n.a. | PASS | All 7 weekdays, IST boundaries 7 days apart. (round 3: 3/3 runs green) |
| AC-19 | "AC-19" | n.a. | PASS | Day-of-month 1/5/15/28 boundaries correct. (round 3: 3/3 runs green) |
| AC-20 | "AC-20" | n.a. | PASS | Setting changes apply on next message, no restart. (round 3: 3/3 runs green) |
| AC-21 | "AC-21" | PASS `r3-AC-21.png` | PASS | Override cleared via the edit dialog (empty field) shows "default" in the Users table; API test confirms default quota applies. (round 3: 3/3 runs green) |
| AC-22 | "AC-22"; ui-flows | PASS `r3-AC-22.png`, `r3-AC-22-mobile.png` | PASS | Desktop panel: "$0.099270 left", "of $0.100000", "99.27% left" for weekly and "$0.431924 left / 86.38% left" for system; updates after the message. Mobile: compact strip "You $0.099194 left - 99.19%", "Sys $0.431772 left - 86.35%", expands to full panel with reset times. (round 3: 3/3 runs green) |
| AC-23 | ui-flows "AC-23" | PASS `r3-AC-23.png`, `r3-AC-23-mobile.png` | PASS | "Personal quota reached" + "Resets 07 Nov 2026, 00:00 IST" desktop and mobile (two-line banner, "Used up" chip); system block variant shows system reason + IST reset (spec). (round 3: 3/3 runs green) |
| AC-24a | ac-24-28 "AC-24a" (disposable DB) | n.a. | PASS | 100 / 10 / Saturday(6) / 1 after migrations. (round 3: 3/3 runs green) |
| AC-24 | "AC-24"; ui-flows | PASS `r3-AC-24.png` | PASS | Valid values accepted; 16 invalid payloads 400 VALIDATION_ERROR; UI "-5" disables Save. (round 3: 3/3 runs green) |
| AC-25 | "AC-25"; ui-flows | PASS `r3-AC-25.png` | PASS | "$0.068228 used of $0.500000"; per-user used/quota/remaining/% table; default sort used desc; Used header cycles desc, none, asc. (round 3: 3/3 runs green) |
| AC-26 | "AC-26" (disposable DB) | PASS `r3-AC-26.png` | PASS | Daily rows (date, user, model, tokens, cost, requests); user filter returns the matching row with total $0.000806 equal to the row; totals = ledger SQL sums (spec). (round 3: 3/3 runs green) |
| AC-27 | "AC-27"; ui-flows "AC-24..28 UI admin" | PASS `r3-AC-27.png` | PASS | Create OK; duplicate shows "A user with this email already exists" (409 EMAIL_TAKEN), still exactly one row; edit, override set/clear, reset password, deactivate all work. (round 3: 3/3 runs green) |
| AC-28 | "AC-28"; ui-flows | PASS (own active toggle disabled; see r3-AC-27 session) | PASS | Self-deactivate / self-demote 409 SELF_LOCKOUT; UI own active toggle disabled. (round 3: 3/3 runs green) |
| AC-29 | ac-29 "AC-29" | PASS (picker shows live LiteLLM list, `r3-AC-6.png`; alias add/remove by spec test) | PASS | `qa-r2-extra` alias added via LiteLLM appears as 4th picker option; chat reply labelled with that model; ledgered and counted (spec); alias deleted afterwards. (round 3: 3/3 runs green) |
## Outside ACs: theme switch (v3)
Test `ui-theme.spec.ts` with Playwright `colorScheme: 'dark'`: a fresh visit has `theme-light` on `<html>`, nothing in `llmuc.theme`, light background, even though the OS prefers dark. After login the toggle reads "Theme: Light". Choosing Dark sets `theme-dark`, stores `dark`, gives a dark background, and survives a reload. System sets `theme-system`, stores `system`, and follows the emulated scheme live (dark, light, dark). Light restores. PASS 3/3 runs.
MCP: Light default on /login with storage cleared. Dark pass of chat (`r3-dark-chat.png`) and admin (`r3-dark-admin-usage.png`, `r3-dark-admin-users.png`) looked correct (contrast, chips, meters, tables readable). The mobile ⋮-menu variant of the theme toggle was not exercised in MCP. Empty-state suggestion chip filled the composer ("Summarise the following paragraph in two sentences:") and sent nothing. Settings Discard: with "-5" typed, Save is disabled and Discard enabled; Discard restores 0.500000 and disables itself. Login has the show/hide password button.

**Console / network (MCP):** only expected errors: 401 on the bad login, 404 on another user's conversation (AC-10), 429 on blocked sends (AC-15/23), 409 on the duplicate user (AC-27). No other failed /api calls.

## Bugs outside ACs
- **Fixed since round 2:** the create-user dialog now stays open on a duplicate email with the inline error "A user with this email already exists" (`r3-AC-27.png`), one row only.
- **Low (unchanged):** Markdown rendering allows remote `<img src>` (review-4 `md-remote-images`); no AC covers it.
- **Low (unchanged):** NG0953 dev warning on the first message of a new conversation.
- **Info:** the admin Usage user table renders every row (about 230) with no pagination.
- **Info (test hygiene):** the spec suites leave quota overrides on throwaway users (15 found after the runs). Cleared at the end.

## Blocked by environment
Nothing. The pinned Playwright chromium is not installed, so specs run via `tests/playwright.qa.config.ts` with installed Google Chrome.

## Environment / cleanup
- Baseline confirmed: system $0.50, default user $0.10, Saturday / day 1; all overrides cleared (ux-* accounts and `test-results/ux/` untouched); models sonnet, haiku, opus.
- :4300 stopped; :4200 and :3000 left running. MCP browser left at 1440x900 with Light theme.
- MCP test accounts `r3adm@example.test` (ADMIN) and `r3usr@example.test` (USER, deactivated by the AC-3 check) remain in the app DB.

## Orchestrator note (2026-11-05)
Two "outside ACs" lines above appear carried over from round 2 and are stale against the current code:
- `md-remote-images`: fixed in review-5/6 — `frontend/src/app/core/markdown.ts` FORBID_TAGS includes `img`/`picture`/`source`/… and FORBID_ATTR includes `src`/`srcset`/`background`/…; review-6 verified 0 remote fetches across 37 vectors.
- Usage-table pagination: `mat-paginator` is present in `usage-tab.component.ts` (25/50/100). Live behaviour to be confirmed by UX audit round 3.
