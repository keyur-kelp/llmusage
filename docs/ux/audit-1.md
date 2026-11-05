UX_VERDICT: CHANGES
UX_SCORE: 23/100
BLOCKERS: 2  MAJORS: 9  MINORS: 10

| Area | Max | Score | Main deductions |
|---|---|---|---|
| Task clarity & flows | 20 | 12 | No confirm on deactivate or admin-role removal, and lock-out prevention unexplained (−6); block banner gives reason and reset but no limit or next step (−2) |
| States & feedback | 15 | 5 | Nothing between send and first token, no streaming indicator (−6); no loading/empty states for quota, sidebar or tables (−2); no feedback after activate/deactivate (−2) |
| Accessibility | 20 | 0 | Conversation items not keyboard-operable (−10); no `aria-live` for replies (−5); focus dropped to `<body>` after send, so the next Tab+Enter logs out (−4); unnamed progress bars, 3.8:1 model label, no headings or page titles (−3). Floored at 0 |
| Visual design & polish | 20 | 3 | Dark mode ignored (−6); default Material with a flat top bar and weak hierarchy (−5); raw Markdown `**Red:**` in replies (−4); no threshold colour or state on the quota meter (−2) |
| Consistency | 10 | 3 | Money/number columns left-aligned without tabular figures (−4); ISO dates in the daily table vs "07 Nov 2026, 00:00 IST" elsewhere (−1); mixed "left / remaining / used %" framing (−1); different top-bar titles for Chat and Admin (−1) |
| Responsiveness | 15 | 0 | Chat at 390 px is 916 px wide: quota panel and Send off-screen (−15). Admin tables have no responsive handling (code-evident). Floored at 0 |

Round 1, 2026-11-05. The visual spec for the fixes is docs/ux/ui-design.md, and its `[ui-key]` must items are raised below.

## Coverage and limits of this audit

- **USER side: driven live** with Playwright MCP, using the QA test session already open in the browser ("MCP Blocked", role USER, an @example.test account). I covered login (empty, error), chat (empty, model picker, streaming, reply, sidebar, keyboard) at 1440×900 and 390×844, and light and dark. **1 chat message sent** (claude-sonnet-5-5, 148-character reply, cost about $0.000836).
- **ADMIN side: not driven live.** The environment refused both attempts to read `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env` (credential-materialisation rule), and I did not try to work around that. As a result, I did **not** create the `ux-user@example.test` account, set or clear an override, or reproduce the blocked state live, so there is nothing to deactivate or clean up. No settings or quotas were changed.
- I judged the admin screens and the blocked banner from QA's MCP screenshots (`test-results/mcp/AC-23.png`, `AC-24.png`, `AC-25.png`, `AC-26.png`, `AC-28.png`, desktop light only) plus the component source. Admin issues are marked *(code + QA screenshot)*. Admin at 390 px and in dark mode is **unverified live**; the dark-mode verdict carries over because the theme is global (`color-scheme: light` in `styles.scss`).
- **Round 2 needs** admin credentials typed by the operator (or a pre-authenticated admin session in the MCP browser) to finish the admin pass, the test-user create/override/deactivate flow and the live blocked state.

## Issues

### Blockers
- **[ui-responsive-chat]** Chat @ 390×844 — `frontend/src/app/features/chat/chat.page.ts` (`.layout { grid-template-columns: 280px 1fr 300px }`) — blocker. Measured `document.scrollWidth` is 916 px at a 390 px viewport. The quota panel starts at x=633 and Send at x=520, both off-screen, and the sidebar takes 280 px of the 390. A mobile user can't see their remaining quota or reset time (AC-22) without horizontal scrolling, and the composer is cut off. **Fix:** the breakpoint layout in ui-design.md §3 (over-mode `mat-sidenav` under 1024, a quota strip under 600, a pinned full-width composer). Screenshot: `test-results/ux/chat-empty-mobile.png`.
- **[ui-sidebar]** Chat sidebar @ all — `frontend/src/app/features/chat/conversation-sidebar.component.ts` — blocker. `<a mat-list-item (click)>` has no `href`/`routerLink`, so `.focus()` on an item fails and Tab skips it. Keyboard and switch users can't reopen a past conversation (PRD flow 3, AC-8), and middle-click or open-in-new-tab don't work either. **Fix:** `[routerLink]="['/chat', c.id]"` plus `aria-current="page"` on the active item (§4.5). Screenshot: `test-results/ux/chat-reply-desktop.png`.

### Majors
- **[ux-focus-loss]** Chat @ all — `composer.component.ts` (`[disabled]` on the textarea while streaming) — major. After send, the focused textarea is disabled and `document.activeElement` becomes `<body>`. In this audit, the next Tab went to the first focusable element and Enter **logged the user out** mid-session (`test-results/ux/chat-focus-desktop.png`, then the /login redirect). **Fix:** keep the textarea enabled and block only submit while streaming; keep focus in the composer; add a skip link and make sure Log out isn't the first Tab stop (§4.4, §4.7).
- **[ux-aria-live]** Chat message list @ all — `message-list.component.ts` — major. There is no `role="log"`/`aria-live` on the message list, so streamed replies are never announced to screen readers. The only live regions are Material's form-field subscripts and the CDK announcer. **Fix:** `role="log" aria-live="polite"` on the list and `aria-busy="true"` on the streaming bubble until `done` (§4.3).
- **[ui-streaming]** Chat @ all — `message-list.component.ts`, `composer.component.ts` — major. About 1.6 s passed between send and the first delta with no visual change except a greyed composer. There is no "replying" indicator, no progress while streaming, and the Send label never changes. **Fix:** a typing-dots bubble before the first token, then a 2 px indeterminate bar until `done` (§4.4).
- **[ui-confirm-dialog]** Admin Users @ desktop *(code + QA screenshot AC-28.png)* — `users-tab.component.ts` (`setActive` fires on toggle change), `user-dialog.component.ts` — major. Deactivating a user is instant with no confirmation and no success message. On the self row the toggle and role select are just disabled, with no hint or tooltip explaining lock-out prevention (AC-28 is enforced but not explained). **Fix:** `ConfirmDialogComponent` for deactivate and for ADMIN→USER, a snackbar on activate/deactivate, and a lock icon plus hint/tooltip on self controls (§4.10).
- **[ui-theme]** All screens @ dark — `frontend/src/styles.scss` (`color-scheme: light`) — major. With `prefers-color-scheme: dark`, the app renders identically to light. **Fix:** `color-scheme: light dark`, `theme-type: color-scheme`, tertiary palette for warnings, `--app-*` tokens (§2.1). Screenshots: `test-results/ux/chat-empty-desktop-dark.png`, `test-results/ux/login-error-mobile-dark.png`.
- **[ui-shell]** All screens @ desktop — `chat.page.ts`, `admin.page.ts` — major. `mat-toolbar color="primary"` does nothing in M3, so the top bar blends into the page with no separation. There is no hierarchy between product name, user and actions, and the look is stock Material. **Fix:** a shared shell with a surface-container bar and bottom border, a role chip, and a mobile overflow menu (§2.4, §4.7). Screenshot: `test-results/ux/chat-reply-desktop.png`.
- **[ui-message]** Chat reply @ all — `message-list.component.ts` — major. Assistant Markdown shows as raw `**Red:** …`, which looks broken in a demo. **Fix:** decision D-1 in ui-design.md §6 (a Markdown library is a new dependency and needs user approval). Until then, strip emphasis markers. Screenshot: `test-results/ux/chat-reply-desktop.png`.
- **[ui-tables]** Admin Usage @ desktop *(code + QA screenshots AC-25.png, AC-26.png)* — `usage-tab.component.ts` — major. Used, Quota, Remaining, Cost and token columns are left-aligned with proportional figures, so 6 dp amounts don't line up and are easy to misread. **Fix:** an `app-num-cell` class (right-aligned, `tabular-nums`) on every numeric column and header, and a bold totals row (§4.8).
- **[ui-responsive-admin]** Admin Usage/Users @ 390 *(code, not seen live)* — `usage-tab.component.ts`, `users-tab.component.ts` — major. Six- and seven-column `mat-table`s at `width: 100%`, with no scroll wrapper or card layout, will overflow the page on mobile. **Fix:** `.app-table-scroll` on tablet and a card list under 600 (§3). Needs verification in round 2.

### Minors
- **[ui-block-banner]** Chat blocked @ desktop *(QA screenshot AC-23.png)* — `chat.page.ts` — minor. "Personal quota reached · Resets 07 Nov 2026, 00:00 IST" meets AC-23 but doesn't say what the limit was or what to do. Focus doesn't move to the banner. **Fix:** two-line copy (§4.2) and focus on the banner after a block.
- **[ui-quota-meter]** Chat quota panel @ all — `quota-panel.component.ts` — minor. The bar fill has no threshold state. At 0% left (AC-23.png) it's just an empty grey track, with nothing like "Used up" or "Low". **Fix:** warn under 20% and danger at 0%, each with text and an icon (§4.1).
- **[ux-progress-name]** Chat quota panel — `quota-panel.component.ts` — minor. The `progressbar` elements have `aria-valuenow` but no accessible name. **Fix:** `aria-label` plus `aria-valuetext` (§4.1).
- **[ux-contrast-meta]** Chat messages — `message-list.component.ts` (`.model { opacity: .7 }` inside `.who { opacity: .8 }`) — minor. The model label is 3.82:1 at 12 px, which fails AA 4.5:1. The empty-state text is 4.44:1, also below 4.5:1. **Fix:** `color: var(--mat-sys-on-surface-variant)` (8.0:1), with no opacity (§2.2).
- **[ux-headings]** Login, Chat — `login.page.ts`, `chat.page.ts`, `quota-panel.component.ts` — minor. There is no `h1`/`h2` on login or chat (`mat-card-title` and the quota titles are divs), and every route has the same `<title>`. **Fix:** headings and per-route titles (§4.7).
- **[ux-loading-states]** Chat quota panel, sidebar, Admin tables — minor. Components render nothing until data arrives (`@if (quota())`, `@if (summary())`), and there is no loading or empty copy. **Fix:** §4.1, §4.5, §4.8.
- **[ux-toggle-feedback]** Admin Users *(code)* — `users-tab.component.ts` `setActive` — minor. There is no success message after activate/deactivate, unlike create and password reset. **Fix:** snackbar (§4.11).
- **[ux-date-format]** Admin daily table *(QA screenshot AC-26.png)* — `usage-tab.component.ts` — minor. Dates are ISO `2026-11-05`, while every other date reads `07 Nov 2026, 00:00 IST`. **Fix:** `dd Mon yyyy` (§4.8).
- **[ux-pct-framing]** Admin Usage vs Chat — minor. The system card says "97.23% remaining", the table column says "Used %" and chat says "left". **Fix:** one framing per screen, as in §4.8.
- **[ux-shell-title]** Chat vs Admin top bar — minor. The title reads "LLM Usage Control" on chat but only "Admin" on admin, and the user's name is missing on admin (AC-25.png). **Fix:** shared shell (§4.7).

### Noted, not scored
- Console warning `NG0953: Unexpected emit for destroyed OutputRef` after the first message of a new chat (already in the QA report as Low).
- Login works well: `role="alert"` error, labelled fields, fits at 390 px with no horizontal scroll (`test-results/ux/login-error-mobile.png`). The quota panel already shows USD at 6 dp and IST reset times consistently, and AC-22 updates after each message (99.93% to 99.09% observed).

## Screenshots (this audit)
- `test-results/ux/chat-empty-desktop.png`, `test-results/ux/chat-empty-desktop-dark.png`, `test-results/ux/chat-empty-mobile.png`
- `test-results/ux/chat-reply-desktop.png`, `test-results/ux/chat-focus-desktop.png`
- `test-results/ux/login-desktop.png`, `test-results/ux/login-error-desktop.png`, `test-results/ux/login-error-mobile.png`, `test-results/ux/login-error-mobile-dark.png`
- Referenced from QA: `test-results/mcp/AC-23.png`, `AC-24.png`, `AC-25.png`, `AC-26.png`, `AC-28.png`

## Resolved since last audit
- n/a (first audit).
