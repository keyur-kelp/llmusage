RESULT: PASS
AC_PASS: 30/30 (100%)  COVERAGE: 98.04%  UNIT: 224/224

# QA report - round 4 (2026-11-05), regression after the audit-3 fixes (route merge, Users switch name, daily table, percent cap, responsive tweaks)

Round 3 is archived at `docs/qa/report-3.md`, round 2 at `report-2.md`, round 1 at `report-1.md`.

## Spec runs (36 Playwright tests each, stable `ng build` served on :4300 with /api proxied to :3000)
- **First batch (3 runs): run 1 FAILED 1/36, runs 2 and 3 36/36.** Run 1 failure: `ui-flows.spec.ts` "AC-24/25/26/27/28 UI admin", second Create-user dialog (the duplicate-email step). `user-save` stayed disabled because the Email text landed in the Name field (screenshot in the trace: Name "Dupui-...@example.test", Email empty). Cause: a test race. The dialog's own autofocus (applied after its open animation) moved focus back to Name between Playwright's focus and insert for the Email fill. No app defect: a real user typing is not affected, and the AC-27 duplicate rejection itself worked in the other 5 runs and in MCP.
- **Test fix (no assertion weakened):** both Create-user dialog opens now first `await expect(user-name).toBeFocused()` before typing.
- **Second batch (3 runs in a row, after the fix): 36/36 (1.9m), 36/36 (1.6m), 36/36 (1.6m).** No flakes, no retries.
- Because the first batch had a flake it is reported honestly here; the PASS rests on the three consecutive clean runs of the second batch, with the same specs and assertions as the first batch plus the focus wait.
- Spec command: `BASE_URL=http://localhost:4300 npx playwright test -c tests/playwright.qa.config.ts --output=<dir outside test-results/>`. :4300 stopped afterwards; :4200 and :3000 left running.

## Test hygiene fix (quota overrides left on throwaway users)
- `tests/acceptance/helpers.ts`: new `clearQaOverrides()` (clears `quotaOverrideUsd` on all `qa-*@example.test` users) is called from `restoreDefaults()`.
- Every spec that sets overrides already ends with `afterAll(restoreDefaults)`; `ac-29-multi-model.spec.ts` gained one (it had none).
- Verified: after all 6 spec runs, 0 users with an override (API check), settings at baseline (system $0.50, default user $0.10, Saturday, day 1). Last round found 15 left behind.

## Unit and coverage (run after the specs, :4300 stopped)
- Backend Jest 118/118 (12 suites), frontend Karma 106/106 = **224/224**.
- Backend coverage (All files): statements 96.9%, branches 82.92%, functions 97.14%, **lines 98.04%**.

## AC table (MCP at 1440x900; 390x844 for AC-6/7/22/23)
Header: AC | test(s) | MCP live check | Result | Evidence

| AC | test(s) | MCP live check | Result | Evidence |
|---|---|---|---|---|
| AC-1 | ac-01-05 "AC-1" | n.a. | PASS | Two backend starts on a fresh DB: 1 ADMIN, no duplicate. 3/3 runs. (round 4: green in all 3 clean runs) |
| AC-2 | ac-01-05 "AC-2"; ui-flows "AC-2 UI login" | PASS `r4-AC-2.png` | PASS | Bad password: 401, UI "Invalid email or password", stays on /login, no token in storage. Valid login lands on /chat. 3/3 runs (the previously flaky first attempt is stable). (round 4: green in all 3 clean runs) |
| AC-3 | "AC-3"; ui-flows "AC-3 UI deactivated" | PASS `r4-AC-3.png` | PASS | Deactivated login 403 and old token rejected on every endpoint; UI shows login error. MCP: deactivate via toggle shows the new confirm dialog, confirm, then that user's login returns 403. (round 4: green in all 3 clean runs) |
| AC-4 | "AC-4"; ui-flows "AC-4 UI admin guard" | PASS (admin opens /admin as r4adm; USER guard by spec) | PASS | USER 403 on all 10 admin endpoints; UI: no admin link, /admin redirects to /chat. Admin can open /admin. (round 4: green in all 3 clean runs) |
| AC-5 | "AC-5" | n.a. | PASS | bcrypt hashes, unique salts, no plaintext in DB or logs. (round 4: green in all 3 clean runs) |
| AC-6 | ac-06-12 "AC-6"; ui-flows | PASS `r4-AC-6.png`, `r4-AC-6-mobile.png` | PASS | Picker shows the 3 LiteLLM models in order on desktop and mobile; matches /api/models. (round 4: green in all 3 clean runs) |
| AC-7 | "AC-7"; ui-flows | PASS `r4-AC-7.png`, `r4-AC-7-mobile.png` | PASS | Several delta events before done; ledger row carries the LiteLLM call id. UI renders Markdown reply (`<p>`, `<ol>`) with the model label; mobile has no horizontal scroll and the composer/send button are in the viewport. (round 4: green in all 3 clean runs) |
| AC-8 | "AC-8"; ui-flows | PASS `r4-AC-8.png` | PASS | After reload the conversation is in the sidebar; user + assistant messages with model claude-sonnet-5-5. (round 4: green in all 3 clean runs) |
| AC-9 | "AC-9" | n.a. | PASS | Context recalled in message 2; 4 messages in one conversation. (round 4: green in all 3 clean runs) |
| AC-10 | "AC-10"; ui-flows | PASS `r4-AC-10.png` | PASS | Other user and admin get 404; UI "Conversation not found", empty sidebar, no leaked text. (round 4: green in all 3 clean runs) |
| AC-11 | "AC-11" | n.a. | PASS | Ledger row has user, conversation, model, tokens, 6 dp cost, timestamp. (round 4: green in all 3 clean runs) |
| AC-12 | "AC-12" | n.a. | PASS | costUsd equals LiteLLM cost (6 dp) and /spend/logs. (round 4: green in all 3 clean runs) |
| AC-13 | ac-13-14-18-19-26 "AC-13" | n.a. | PASS | One rollup row per user/model/day; re-runs do not double count. (round 4: green in all 3 clean runs) |
| AC-14 | "AC-14" | n.a. | PASS | Rollup + today's ledger = plain ledger sum. (round 4: green in all 3 clean runs) |
| AC-15 | "AC-15 + AC-17"; ui-flows AC-23 | n.a. | PASS | 429 USER_QUOTA_EXCEEDED with IST reset; no ledger row written. (round 4: green in all 3 clean runs) |
| AC-16 | "AC-16" | n.a. | PASS | 429 SYSTEM_QUOTA_EXCEEDED for user and admin; no ledger writes. (round 4: green in all 3 clean runs) |
| AC-17 | "AC-15 + AC-17" | n.a. | PASS | First message over quota allowed, next blocked. (round 4: green in all 3 clean runs) |
| AC-18 | "AC-18" | n.a. | PASS | All 7 weekdays, IST boundaries 7 days apart. (round 4: green in all 3 clean runs) |
| AC-19 | "AC-19" | n.a. | PASS | Day-of-month 1/5/15/28 boundaries correct. (round 4: green in all 3 clean runs) |
| AC-20 | "AC-20" | n.a. | PASS | Setting changes apply on next message, no restart. (round 4: green in all 3 clean runs) |
| AC-21 | "AC-21" | PASS `r4-AC-21.png` | PASS | Override cleared via the edit dialog (empty field) shows "default" in the Users table; API test confirms default quota applies. (round 4: green in all 3 clean runs) |
| AC-22 | "AC-22"; ui-flows | PASS `r4-AC-22.png`, `r4-AC-22-mobile.png` | PASS | Desktop panel: "$0.099270 left", "of $0.100000", "99.27% left" for weekly and "$0.431924 left / 86.38% left" for system; updates after the message. Mobile: compact strip "You $0.099194 left - 99.19%", "Sys $0.431772 left - 86.35%", expands to full panel with reset times. (round 4: green in all 3 clean runs) |
| AC-23 | ui-flows "AC-23" | PASS `r4-AC-23.png`, `r4-AC-23-mobile.png` | PASS | "Personal quota reached" + "Resets 07 Nov 2026, 00:00 IST" desktop and mobile (two-line banner, "Used up" chip); system block variant shows system reason + IST reset (spec). (round 4: green in all 3 clean runs) |
| AC-24a | ac-24-28 "AC-24a" (disposable DB) | n.a. | PASS | 100 / 10 / Saturday(6) / 1 after migrations. (round 4: green in all 3 clean runs) |
| AC-24 | "AC-24"; ui-flows | PASS `r4-AC-24.png` | PASS | Valid values accepted; 16 invalid payloads 400 VALIDATION_ERROR; UI "-5" disables Save. (round 4: green in all 3 clean runs) |
| AC-25 | "AC-25"; ui-flows | PASS `r4-AC-25.png` | PASS | "$0.068228 used of $0.500000"; per-user used/quota/remaining/% table; default sort used desc; Used header cycles desc, none, asc. (round 4: green in all 3 clean runs) |
| AC-26 | "AC-26" (disposable DB) | PASS `r4-AC-26.png` | PASS | Daily rows (date, user, model, tokens, cost, requests); user filter returns the matching row with total $0.000806 equal to the row; totals = ledger SQL sums (spec). (round 4: green in all 3 clean runs) |
| AC-27 | "AC-27"; ui-flows "AC-24..28 UI admin" | PASS `r4-AC-27.png` | PASS | Create OK; duplicate shows "A user with this email already exists" (409 EMAIL_TAKEN), still exactly one row; edit, override set/clear, reset password, deactivate all work. (round 4: green in all 3 clean runs) |
| AC-28 | "AC-28"; ui-flows | PASS (own toggle disabled, own row; spec) | PASS | Self-deactivate / self-demote 409 SELF_LOCKOUT; UI own active toggle disabled. (round 4: green in all 3 clean runs) |
| AC-29 | ac-29 "AC-29" | PASS (picker shows live LiteLLM list, `r4-AC-6.png`; alias add/remove by spec) | PASS | `qa-r2-extra` alias added via LiteLLM appears as 4th picker option; chat reply labelled with that model; ledgered and counted (spec); alias deleted afterwards. (round 4: green in all 3 clean runs) |

Round 4 live evidence for the changed areas:
- **AC-8 (route merge):** first message from `/chat` moved the URL to `/chat/<id>`, and the same `<app-chat-page>` element survived (marked before sending, still present after both messages: no remount). Second message went into the same conversation (2 user + 2 assistant, 1 sidebar item). Reload and a direct deep link show both pairs with model claude-sonnet-5-5 and the conversation highlighted. New chat gives `/chat` with the empty state; browser Back returns to `/chat/<id>` with 2+2 messages; Forward returns to `/chat` empty.
- **AC-9:** follow-up ("Now name a third colour") went to the same conversation id; spec test confirms context recall.
- **AC-10:** r4usr2 opening r4usr's `/chat/<id>`: "Conversation not found", 0 messages, 0 sidebar items, no text from the conversation (404 in console, expected).
- **Focus:** after the first message of a new chat `document.activeElement` is `composer-input` (audit-3 `ux-focus-loss` is fixed).
- **AC-27 / Users tab:** the Active switch's inner button is named "Active: <name>" (`aria-label`, checked on Administrator and several rows); deactivate shows the confirm dialog, then the user's login returns 403 (AC-3). Duplicate email keeps the dialog open with "A user with this email already exists". Override set via the edit dialog (0.000001) blocks the user (AC-23), emptying the field shows "default" (AC-21).
- **AC-26 daily table:** 296 rows in `app-table-scroll.daily-scroll` (630 px high, 15,488 px content); `th` and the Total row are `position: sticky`; after scrolling 500 px the header is at the scroller top and the Total row at its bottom; Total cost $0.148344 equals the system month-to-date used in the hero card (all usage this month is in range).
- **AC-25:** per-user table shows the paginator ("1 - 25 of 624"). No row on page 1 reaches the cap, so the ">999%" display is not live-verified here; it is covered by frontend unit tests only (not re-asserted by QA).
- **AC-22 / AC-23 mobile:** compact strip "You $0.097650 left - 97.65%" and "Sys $0.351656 left - 70.33%" expands to the panel with both IST reset times; blocked state "Personal quota reached" and "Resets 07 Nov 2026, 00:00 IST" on mobile and desktop; no horizontal scroll at 390 on chat, login or admin.
- **AC-6 / AC-7 mobile:** picker lists claude-sonnet-5-5, claude-haiku-5-5, claude-opus-5-5; reply renders as `<ol>` with the model label; Send button inside the viewport.
- **Responsive:** login at 390 (`r4-login-mobile.png`) and admin at 390 (`r4-admin-mobile.png`): all three tabs (Usage, Settings, Users) visible with no scroll arrows, no horizontal scroll.

## Outside ACs
- **Theme toggle inside the mobile menu (previously skipped): PASS.** At 390 the more-actions menu has "Theme: Light"; it opens a submenu with Light (checked), Dark, System ("Match your device"); choosing Dark sets `theme-dark`, `llmuc.theme=dark`, body background rgb(15,23,41); choosing Light restores `theme-light`. Screenshots `r4-mobile-theme-menu.png`, `r4-mobile-dark.png`. The theme spec (`ui-theme.spec.ts`) passed 6/6 runs.
- **NG0953: FIXED.** Zero NG0953 warnings and zero console warnings or errors after the first message of a new chat, the follow-up, reload and back/forward on the :4200 dev server (the stale entries in the cumulative console log predate the route merge). Round 1-3 "low" item closed.
- **Console / network (MCP):** only expected errors: 401 bad login, 404 on another user's conversation, 403 on the deactivated login, 409 on the duplicate email. All other /api calls 200.

## Bugs / open items outside ACs (each re-checked against current code)
- Verified closed, no longer carried: remote `<img>` in Markdown (`frontend/src/app/core/markdown.ts` forbids `img`, `src`, `srcset`); per-user table pagination (`mat-paginator` present and working, 25/50/100); NG0953 (above); Users switch name (above); daily table now scrolls with sticky header/footer (above); the first-message focus loss (above).
- **Info:** the daily table has no pagination but now scrolls inside a fixed-height region with a sticky header and Total, so page length is no longer a problem. No issue open.
- **Info (test infra):** Create-user dialog autofocus lands after the open animation. Harmless for users; QA tests now wait for it.
- No open bugs.

## Blocked by environment
Nothing. The pinned Playwright chromium is not installed, so specs run via `tests/playwright.qa.config.ts` with installed Google Chrome.

## Environment / cleanup
- Baseline confirmed via API: system $0.50, default user $0.10, Saturday / day 1; 0 overrides. Models: sonnet, haiku, opus. Prompts were tiny, claude-sonnet-5-5 only.
- ux-admin / ux-user and `test-results/ux/` untouched.
- MCP accounts created through the admin API (admin creds from `.env` in test code only): `r4adm@example.test` (ADMIN), `r4usr@example.test` (USER, no override), `r4usr2@example.test` (USER, deactivated by the AC-3 check). They remain in the app DB.
- MCP browser left at 1440x900, Light, logged out on /login. Screenshots in `test-results/mcp/r4-*.png` (21 files).
