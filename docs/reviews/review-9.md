VERDICT: APPROVE
SCORE: 98/100 | Spec 24/25 · Correctness 25/25 · Tests 19/20 · Security 15/15 · CLAUDE.md 15/15
BLOCKERS: 0  MAJORS: 0  MINORS: 2

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 24 | −1 ui-quota-meter (residual: `.app-chip` has no `white-space: nowrap`) |
| Correctness | 25 | 25 | none |
| Tests | 20 | 19 | −1 chat-route-reuse-untested |
| Security | 15 | 15 | none |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **98** | |

Round 9 covers the fixes for the 10 audit-3 issues plus [shell-spec-private-api-overclaims], all in `frontend/`.

## Scope check
Source files modified after `review-8.md` (all under `frontend/src/app`): `app.routes.ts`, `app.routes.spec.ts` (new), `core/format.ts`, `core/format.spec.ts`, `shared/app-shell.component.ts`, `shared/app-shell.component.spec.ts`, `features/admin/{usage-tab,users-tab,users-tab.spec,admin.page,user-dialog}.component.ts`, `features/login/login.page.ts`, `features/chat/{chat.page,composer.component,quota-panel.component}.ts`. Nothing in `backend/`, `tests/`, `litellm/`, or package manifests. I did not read `.env` or `test-results/ux/credentials.local.json`, and did not run the acceptance suite.

## Test, lint and build run
- **`npm run lint`**: exit 0, 0 errors. The same 3 "unused eslint-disable" warnings come from generated `backend/coverage/lcov-report`; not scored. Backend `tsc --noEmit` (app and migrations) is clean.
- **`npm test`**: exit 0 on the first run, and both workspaces ran.
  - Backend: 12/12 suites, **118/118** tests (perf `quota.check` p95 3.6 ms).
  - Frontend Karma: **105/105** (100 before, plus 3 `chatMatcher`, 1 `formatPctCapped`, 1 switch-name).
  - Total **223**. No `NG0xxx` lines in the log. `test-db-concurrent-use` did not recur.
- **`ng build`**: exit 0, no budget warning. Initial total is 519.45 kB raw / 130.24 kB transfer, under the 550 kB warning budget.

## Focus-area verification

### 1. Single chat route (`chatMatcher`)
- **Matcher**: `/chat` gives `consumed: [chat]` with no params. `/chat/<id>` gives `posParams.id`. Any other first segment, or more than 2 segments, returns `null`, which falls through to `**` → `/chat` (same as before). Unit-tested in `app.routes.spec.ts`.
- **Guards**: `canActivate: [authGuard]` is on the one route, so it applies to both URLs. The default `runGuardsAndResolvers: 'paramsChange'` re-runs it on `/chat` → `/chat/<id>`. Deactivated users are rejected server-side (401/403 → interceptor logout), and that path is unchanged. `adminGuard` on `/admin` is unaffected.
- **Deep link `/chat/<id>`**: `ngOnInit` awaits `store.init()`, then subscribes to `paramMap`, which replays its current value. `id !== activeId()` (null) → `store.open(id)`. The conversation loads.
- **AC-10, another user's id**: `open()` catches the 404 → `newChat()` + `error.set(apiErr.message)`, so the "Conversation not found" banner (`chat-error`) shows with an empty thread. Unchanged from the reviewed behavior.
- **First message of a new chat, no double-load**: `send()` sets `activeId` in `onDone` and awaits `loadConversations()` before it returns. `sendFn` then navigates with `replaceUrl`. The reused page's `paramMap` emits `id === activeId()`, so `open()` is **not** called. Because the component is no longer destroyed, `init()` does not re-run either. Before, the route swap re-ran `init()` (3 extra GETs). The sidebar still gets the new conversation from `send()`'s own `loadConversations()`.
- **Conversation switching and back/forward**: the sidebar uses `routerLink ['/chat', c.id]`. With the component reused, `paramMap` emits on every id change → `open(id)`. Back/forward to `/chat` (no id) → `newChat()` when not streaming. `replaceUrl` on the first message means Back skips the empty `/chat` entry, which is correct. The `paramMap` subscription has no explicit teardown, but `ActivatedRoute` observables complete when the route is destroyed, so it doesn't leak.
- **`composer()?.focus()` after navigate is safe**: `composer` is a `viewChild(ComposerComponent)` signal and the composer is rendered unconditionally. If navigation is redirected (for example, the token expires and the guard sends you to `/login`), the optional chains (`composer()?.` / `input()?.`) make it a no-op. It only runs when `ok && wasNew && id`, so a quota block keeps the banner-focus effect. Since the page now survives, this call is a belt-and-braces measure; the NG0953 "destroyed OutputRef" warning from audit-3 no longer has a cause.
- Not scored (pre-existing, and unchanged by this patch): navigating to another conversation *while* a reply streams leaves the URL on the new id while `open()` returns early.

### 2. Users-tab switch name
`users-tab.component.ts:98` now uses the `[aria-label]` input (not `attr.`), so MatSlideToggle forwards "Active: <name>" to the inner `button[role=switch]`. `[aria-describedby]` is kept for the self row (`:97`). The new spec asserts the inner buttons' `aria-label` values are `['Active: Bob', 'Active: Ann']`. **Resolved [ux-switch-name].**

### 3. Daily table
- `.daily-scroll { max-height: 70vh; overflow: auto; }` wraps the table.
- The header row is `sticky: true`, the footer row is `sticky: true`, and the `date` column is `sticky`.
- The footer cells bind `d.totals.*` from the server response, which the backend aggregates over the whole requested range (AC-26). No client-side summing, and no paging that could shrink the total.
- **Resolved [ui-usage-pagination]** (residual).

### 4. `formatPctCapped`
`compareDecimal(value, '999') > 0 ? '>999%' : formatPct(value)`. `compareDecimal` is the existing string/digit comparator, so there is no `Number`/`parseFloat` on the value. The raw value stays in `[attr.title]`. Tested at `87.65`, `999.00` (not capped) and `449400.00` (capped). **Resolved [ux-pct-overflow].** CLAUDE.md money rule satisfied.

### 5. Quota meter chip
The `.head` row now wraps (`flex-wrap: wrap`), the title has `flex: 1 1 0; min-width: 120px`, and `.reset span` is `nowrap`. But `.app-chip` (`styles.scss:208-212`) still has no `white-space: nowrap`. Because the chip has a fixed `height: 24px`, two-line text ("On / track", "Used / up") would overflow the pill whenever the chip slot gets narrow. Kept open as a minor.

### Other audit-3 items (spot-checked)
- [ux-focus-loss]: resolved by keeping the route instance (see 1).
- [ui-login]: under 600 px the band is 96 px and the card is pulled up `-24px`.
- [ui-forms]: the override field uses `floatLabel="always"`, so the `$` prefix no longer collides with the resting label.
- [ui-shell]: under 600 px the breadcrumb is hidden, and the admin tabs use `[mat-stretch-tabs]="layout.mobile()"`.
- [ux-date-format]: `.range-field { width: 300px }`.
- [ui-responsive-admin]: tighter cell padding and `overflow-wrap: anywhere` on email at 600–1023 px.

UX (not me) should confirm the visual results live.

## Issues
- [ui-quota-meter] frontend/src/styles.scss:208 — minor — fix: add `white-space: nowrap` to `.app-chip`, the residual part of audit-3's fix list. The pill has a fixed 24 px height, so wrapped text spills out of it.
- [chat-route-reuse-untested] frontend/src/app/features/chat/chat.page.ts:171-189 — minor — fix: only the pure `chatMatcher` is tested. Add a `ChatPage` test (`RouterTestingHarness` with the real `routes`, stub `ChatStore`/`ChatStreamService`):
  - navigate to `/chat`, then run `sendFn` with a store that sets `activeId`;
  - assert the same component instance is still mounted at `/chat/<id>`;
  - assert `store.open` was not called and `init` ran once;
  - assert `document.activeElement` is the `composer-input`;
  - then navigate to `/chat/other` and assert `open('other')` is called.

  This locks in the audit-3 regression fix and the no-double-load property.

## Resolved since last review
- shell-spec-private-api-overclaims: the spec now opens the More menu through the public `MatMenuTrigger.openMenu()` and reads the item from `OverlayContainer`. Its title ("shows a Theme item (with a submenu popup)") matches what it asserts.
- Audit-3 keys verified in code: ux-switch-name, ux-focus-loss, ui-usage-pagination, ux-pct-overflow, ui-login, ui-forms, ux-date-format, ui-shell, ui-responsive-admin. ui-quota-meter is partially fixed and still open (above).
