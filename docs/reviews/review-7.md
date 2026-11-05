VERDICT: APPROVE
SCORE: 96/100 | Spec 25/25 · Correctness 23/25 · Tests 18/20 · Security 15/15 · CLAUDE.md 15/15
BLOCKERS: 0  MAJORS: 0  MINORS: 3

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 25 | none |
| Correctness | 25 | 23 | −2 mobile-theme-item-not-in-menu-keymanager |
| Tests | 20 | 18 | −1 suggestion-fill-untested, −1 settings-discard-untested |
| Security | 15 | 15 | none |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **96** | |

This is review round 7: the v3 visual refresh (ui-design §8, 17 `[ui3-*]` musts plus some shoulds). Only `frontend/src` changed since review 6:
- 19 files, including the new `core/theme.service.ts` and its spec, `shared/theme-toggle.component.ts`, `shared/app-logo.component.ts`, `index.html` and `styles.scss`.
- No `package.json` or lockfile changes. Nothing changed in `backend/` (apart from regenerated `dist-migrations` build output), `tests/` or `litellm/`.

I did not read `.env` or `test-results/ux/credentials.local.json`, and I did not run the acceptance suite.

## Test, lint and build run
- **`npm run lint` exits 0.** ESLint reports 0 errors, and backend `tsc --noEmit` (app and migrations) is clean. The same 3 "unused eslint-disable" warnings come from the generated `backend/coverage/lcov-report/*.js`. Not scored.
- **`npm test` from the repo root.** The root script is `npm test --workspace backend && npm test --workspace frontend`, so the frontend only runs if the backend passes.
  - **Run 1 exited 1 in the backend, so the frontend did not run.** One test failed: `admin.test.ts` "AC-19: system period honours reset day-of-month". It expected `periodStart` `2026-11-03T18:30:00.000Z` (DOM 4) and got `2026-10-31T18:30:00.000Z` (DOM 1). The settings row had been put back to its default between the PUT and the GET.
    - Jest runs with `maxWorkers: 1`, so no other suite could have done this. The likely cause is another process writing to the shared `DATABASE_URL_TEST`. This is the same kind of contention seen in review 5.
    - Backend code and tests are unchanged since review 6, so I am not scoring this against this change set.
  - **Run 2: backend alone passed, 12/12 suites and 118/118 tests.**
  - **Run 3: full `npm test` exited 0 and both workspaces ran.**
    - Backend: 12/12 suites, **118/118** tests, perf `quota.check p95` 3.7 ms.
    - Frontend Karma: **96/96**. That is 90 plus 6 new `ThemeService` tests.
    - The engineer's "96/96" is the frontend count only. The full suite is **118 + 96 = 214**.
- **`ng build`** exits 0. Initial total is **519.46 kB** raw and 130.18 kB transfer, which triggers the 500 kB warning budget (the error budget is 1 MB). Main contributors: `chunk-A5E6SKFQ` 424.31 kB, polyfills 34.59 kB, styles 23.94 kB. Lazy chunks: admin-page 303.48 kB, chat-page 167.02 kB, login-page 6.53 kB.

## 2. ThemeService and the pre-paint script
- **localStorage is guarded everywhere.** `read()` (`theme.service.ts:48-55`) and the write in `set()` (`:39-45`) are each in their own try/catch. The `matchMedia` calls (`:26-35`, `reducedMotion()` `:67-73`) are guarded as well.
- **Key and default.** The key is `THEME_KEY = 'llmuc.theme'`. The default is `light` on a missing value, an invalid value or a throw.
- **Only allowed values are applied.**
  - The stored value is matched against the constant `MODES` with `MODES.find((m) => m === v)`, so the result is always one of the three literals.
  - `apply()` only toggles `'theme-' + m` for `m` in `MODES`, so a tampered value can't add a class.
  - Nothing reaches `innerHTML` or attributes. The theme-color meta value comes from two hard-coded colours.
- **The `index.html` inline script matches §8.2 word for word.**
  - It starts from `var m = 'light'` and only replaces it on `s === 'dark' || s === 'system'`, inside try/catch, then adds one class.
  - It has no `eval`, no DOM write and no network access, and it runs before the stylesheets.
  - A tampered value falls back to `theme-light`.
- **Behaviour.** `system` is resolved live through `color-scheme: light dark` in CSS. The `resolved` computed exists only for the icon. The cross-fade class is removed after 200 ms and skipped under reduced motion.
- **Tests** (`theme.service.spec.ts`) cover:
  - default light, with only `theme-light` set;
  - an invalid stored value;
  - persisting the choice and swapping the class;
  - restoring a stored mode on start;
  - `system` following a live `matchMedia` change;
  - get/set throwing, after which the switch still works for the session.

  That is all three tests required by §8.4 #3.
- **Testids.** `theme-toggle`, `theme-light`, `theme-dark` and `theme-system` are present, with `role="menuitemradio"`, `aria-checked`, `aria-label="Theme: <Mode>"` and the "Change theme" tooltip. Desktop and mobile triggers are on mutually exclusive `@if` branches (`app-shell.component.ts:32/41`), so only one `theme-toggle` is rendered at a time.

## 3. Regressions
- **`quota-*-reset` moved to an inner span: OK.**
  - In the desktop card (`quota-panel.component.ts:55`), the `schedule` icon sits outside the testid span. This matters because the ligature text "schedule" would otherwise leak into the testid's text.
  - In the compact strip (`:80`), the testid stays on the `div`, which has no icon.
  - The unit test asserts exact text: `quota-user-reset` = `Resets 07 Nov 2026, 00:00 IST` and `quota-system-reset` = `Resets 01 Dec 2026, 00:00 IST`. It passes.
  - **AC-22 holds.** `quota-*-remaining` still reads `$8.765433 left`, with the `unit` span inside the testid, and `87.65% left` / `98.77% left` are rendered.
  - **AC-23 holds.** `quota-block-reason` and `quota-reset-time` ("Resets … IST") in `chat.page.ts:89,92` are unchanged, and focus still moves to the banner (`:169`).
- **Settings Discard: OK, Save behaviour unchanged.**
  - Save is still `[disabled]="form.invalid || busy()"` (`settings-tab.component.ts:82`), which is the review-4 accepted behaviour. D-2 stays open.
  - Discard (`:81`) is `type="button"`, so it does not submit. It is disabled while busy or pristine.
  - `discard()` (`:128-131`) does `form.reset(this.loaded)` and clears the error. After a successful save, `loaded` is updated and the form is marked pristine, so Discard returns to the last saved values.
  - No test yet (see `settings-discard-untested`).
- **Suggestion chips never send: OK.**
  - `message-list` emits `suggest` (`:55`). `chat.page.ts:80` calls `composer()?.fill($event)`.
  - `fill()` (`composer.component.ts:69-74`) only sets `text`, focuses the box and moves the caret. It never calls `submit()` or `send()`.
  - The chips are `type="button"` and are not inside a form. No test yet (see `suggestion-fill-untested`).
- **v2 fixes are intact.**
  - Usage paginator: `USAGE_PAGE_SIZES = [25, 50, 100]`, `user-usage-paginator` and `user-usage-filter` with the "No users match this filter" empty state.
  - The user dialog `save` callbacks (create/edit) still return `true`/`false`. The remove-admin confirm returns `false` to keep the dialog open. The `disableClose` handling in `user-dialog.component.ts` and its spec are unchanged and passing.
  - The lock icon keeps `tabindex="0" role="img" aria-label` plus the tooltip (`users-tab.component.ts:108`).
  - `restoreFocus()` (`:176-186`) is unchanged.
  - `ConfirmDialogComponent` keeps `cdkFocusInitial` on Cancel, and its testids are unchanged. The new icon tile is decorative and `aria-hidden`.
- **Markdown/DOMPurify is unchanged.** `core/markdown.ts` and `markdown.pipe.ts` are not in the changed set. `message-list` still binds `[innerHTML]="… | markdown"`, with no `bypassSecurityTrust*` anywhere.

## 4. Bundle (519.46 kB vs 500 kB warning)
**Acceptable. Raise the warning budget, no trim needed.**
- The fonts come from the Google CDN (an accepted deviation since review 1), so font weights add nothing to the bundle. All the loaded Inter weights (400/500/600/700) and Jakarta weights (600/700) are used by the §2.7 type map anyway.
- The roughly +13 kB of JS comes from the theme toggle (`MatMenu` and `MatTooltip` now reach the login page and shell) plus the token-heavy global `styles.scss`, which is 24 kB raw and 4.25 kB transfer.
- I see no duplicate theme emission. There is one `mat.theme` and one `theme-overrides`, and dark mode uses `light-dark()` rather than a second theme include.
- Transfer size is 130 kB, which is fine for a local demo.
- **Recommendation (not scored):** the engineer sets the `initial` `maximumWarning` in `frontend/angular.json` to `550kB`, with the justification: "v3 theme tokens + theme switch; fonts external; transfer ≈130 kB". The `maximumError` stays at 1 MB.

## 5. CLAUDE.md compliance
- There are no new dependencies (the package.json files and the lockfile are untouched).
- There is no `any` in `frontend/src`. The one `as unknown as MediaQueryList` is in a spec test double, which is acceptable.
- New files are kebab-case (`theme.service.ts`, `theme-toggle.component.ts`, `app-logo.component.ts`).
- There are no secrets and no logging.

## Issues
- [mobile-theme-item-not-in-menu-keymanager] frontend/src/app/shared/app-shell.component.ts:47, theme-toggle.component.ts:20 — minor — The mobile "Theme: <Mode>" `mat-menu-item` is rendered inside the `app-theme-toggle` component's own view, not as projected content of the ⋮ `mat-menu`.
  - **Why this breaks.** `MatMenu` collects its items with a content query (`_allItems`, `descendants: true`), and content queries do not cross a child component's view boundary. In Material 20.2.14, this item is therefore not in `_directDescendantItems`.
  - **Effect.** On mobile, arrow keys skip it, so keyboard and switch users can't reach it. Hover does not open it as a submenu. §8.2 requires "Keyboard: arrows, Enter/Space and Esc (Material)". Clicking it still works.
  - **Fix.**
    - Put the trigger `button mat-menu-item data-testid="theme-toggle" [matMenuTriggerFor]="…"` directly in the shell's ⋮ menu template.
    - Have `ThemeToggleComponent` (or a small `app-theme-menu`) expose its `MatMenu`, for example `readonly menu = viewChild.required(MatMenu)`, and reference it through a template ref.
    - Add a unit test that the ⋮ menu's key manager includes the item.
- [suggestion-fill-untested] frontend/src/app/features/chat/composer.component.ts:69, message-list.component.ts:55 — minor — There is no test that clicking a suggestion chip puts its prompt in `composer-input` and does **not** call `send`. This is a spend-safety behaviour. Fix: a spec that clicks a chip, asserts the composer `text()` equals the prompt, and asserts the `send` spy was not called.
- [settings-discard-untested] frontend/src/app/features/admin/settings-tab.component.ts:128 — minor — There is no test for Discard. Fix: a spec that loads the settings, edits a field, clicks `settings-discard`, and asserts the loaded values come back, the form is pristine, the error is cleared, and `putSettings` was not called.

## Advisory (not scored)
- [bundle-budget-stale] frontend/angular.json:41 — Raise the initial `maximumWarning` to 550 kB with the justification above.
- [test-db-concurrent-use] The first `npm test` run failed one backend test because something outside Jest reset `settings` on the shared test DB. This is the second time (review 5 was the first). Fix: make sure nothing else (the dev server, QA or UX tooling) points at `DATABASE_URL_TEST` while `npm test` runs, or give the test DB a name used only by Jest.

## Resolved since last review
- none (review 6 had no open issues)
