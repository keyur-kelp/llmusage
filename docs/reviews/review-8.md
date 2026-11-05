VERDICT: APPROVE
SCORE: 99/100 | Spec 25/25 · Correctness 25/25 · Tests 19/20 · Security 15/15 · CLAUDE.md 15/15
BLOCKERS: 0  MAJORS: 0  MINORS: 1

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 25 | none |
| Correctness | 25 | 25 | none |
| Tests | 20 | 19 | −1 shell-spec-private-api-overclaims |
| Security | 15 | 15 | none |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **99** | |

Round 8 covers the fixes for the three minors from review 7 plus the `bundle-budget-stale` advisory.

## Scope check
I listed every file modified after `review-7.md` was written, excluding `node_modules`, `.git`, `.angular` and `test-results`. The source changes are only:
- `frontend/src/app/shared/theme-toggle.component.ts`
- `frontend/src/app/shared/app-shell.component.ts`
- `frontend/src/app/shared/app-shell.component.spec.ts` (new)
- `frontend/src/app/features/chat/chat-components.spec.ts`
- `frontend/src/app/features/admin/settings-tab.component.spec.ts` (new)
- `frontend/angular.json`
- `README.md`

Everything else in that list is regenerated build output (`frontend/dist`, `backend/dist-migrations`). Nothing changed in `backend/src`, `tests/` or `litellm/`, and there are no `package.json` or lockfile changes. I did not read `.env` or `test-results/ux/credentials.local.json`, and I did not run the acceptance suite.

## Test, lint and build run
- **`npm run lint`** exits 0 with 0 errors. Backend `tsc --noEmit` (app and migrations) is clean. The only output is the same 3 "unused eslint-disable" warnings from the generated `backend/coverage/lcov-report`. Not scored.
- **`npm test`** passed on the first run (exit 0), so both workspaces ran:
  - Backend: 12/12 suites, **118/118** tests. Perf `quota.check` p95 was 5.2 ms.
  - Frontend Karma: **100/100**. That is 96 plus 4 new tests: 1 shell, 1 suggestion, 2 settings.
  - Total: **218**.
  - The log contains no `NG0xxx` runtime errors and no `ERROR` lines.
  - `test-db-concurrent-use` did not come back, so there was nothing to trace with `ps`/`lsof`.
- **`ng build`** exits 0 with no budget warning. Initial total is **519.46 kB** raw and 130.18 kB transfer, the same as review 7, and now under the 550 kB warning budget.

## Fix verification
- **[mobile-theme-item-not-in-menu-keymanager]: resolved.**
  - On mobile, the Theme item is a real `mat-menu-item` written directly in the shell's `#more` menu template (`app-shell.component.ts:47`). That means MatMenu's content query registers it.
  - It opens the theme submenu through `[matMenuTriggerFor]="themeToggle.menu()"`. The `menu` property is `viewChild.required<MatMenu>('themeMenu')` (`theme-toggle.component.ts:66`).
  - The `<mat-menu>` in the toggle is not inside any control-flow block, so the required query resolves while the view is being created. The parent's binding is evaluated after that, and the test log has no NG0951.
  - The label "Theme: {{ modeLabel() }}" comes from a `computed` over `ThemeService.mode()`.
- **Theme testids are unique and identical at every width: confirmed.**
  - On desktop the `menuOnly` instance is not rendered at all. It sits in the `@else` (mobile) branch at `app-shell.component.ts:59`, so the shell has exactly one `<app-theme-toggle>`.
  - On mobile there is exactly one instance: the `menuOnly` one. Its icon button is removed by `@if (!menuOnly())`, so the only `theme-toggle` testid is the overflow-menu item.
  - The `theme-light`, `theme-dark` and `theme-system` items come from the same `@for` in the same component at every width.
  - Those items only exist in the DOM while the menu overlay is open, because `mat-menu` content is lazy, so they can never appear twice.
  - The login page has its own toggle, but it does not use the shell, so the two never appear together.
- **[suggestion-fill-untested]: resolved.** The new host test wires `MessageListComponent (suggest)` to `ComposerComponent.fill`. It clicks a `.suggestions` chip, then asserts that the textarea is non-empty, has focus, and that `send` was not called.
- **[settings-discard-untested]: resolved.** Two tests cover it:
  - Discard restores the loaded values, leaves the form pristine and makes no PUT.
  - After a save, discard restores the last saved values (200 / DOM 4) rather than the originally loaded ones.
- **[bundle-budget-stale] (advisory): resolved.** The initial `maximumWarning` is now `550kB`, the error budget is still `1MB`, and the README explains why.

## Issues
- [shell-spec-private-api-overclaims] frontend/src/app/shared/app-shell.component.spec.ts:10,26 — minor — fix: two problems with this test.
  - Its name says it "opens the theme submenu", but it never opens anything. It only checks `aria-haspopup="menu"`.
  - It reads the private `MatMenu._allItems` through an `unknown` cast, so it can break silently on a Material upgrade.
  - Fix: open the More menu with `trigger.openMenu()`, then open the Theme item's own `MatMenuTrigger`, and assert that a `[data-testid="theme-dark"]` item appears in the overlay container (for example by using `OverlayContainer.getContainerElement()`). Alternatively, rename the test to match what it actually checks.

## Resolved since last review
- mobile-theme-item-not-in-menu-keymanager
- suggestion-fill-untested
- settings-discard-untested
- bundle-budget-stale (advisory)
- test-db-concurrent-use (advisory; did not recur this round)
