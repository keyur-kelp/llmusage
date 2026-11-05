UX_VERDICT: CHANGES
UX_SCORE: 81/100
BLOCKERS: 0  MAJORS: 1  MINORS: 9

| Area | Max | Score | Main deductions |
|---|---|---|---|
| Task clarity & flows | 20 | 16 | The admin Usage user table shows all 295 rows with no paging or filter, so Daily breakdown starts about 15,000 px down on desktop [ui-usage-pagination] (−4) |
| States & feedback | 15 | 13 | The create-user dialog closes before the duplicate-email error comes back. The error shows only in a snackbar and the typed data is lost [ui-dialog-server-error] (−2) |
| Accessibility | 20 | 15 | The focusable self-row lock icon is `aria-hidden`, and Chrome logs a warning [ux-lock-aria] (−2); focus falls to `<body>` after the edit and deactivate dialogs close [ux-dialog-focus-return] (−2); 295 identical "Edit" and "Reset password" button names [ux-action-names] (−1) |
| Visual design & polish | 20 | 16 | Field hints touch or overlap the next field in Settings and in the edit dialog [ui-forms] (−2); the block-banner icon is squeezed to 10–13 px under 1024 [ui-block-banner] (−1); the mobile top bar truncates "LLM Usage Co…" and "UX AD…" [ui-shell] (−1) |
| Consistency | 10 | 9 | The daily date-range picker shows `11/1/2026 – 11/5/2026` above a table that uses `05 Nov 2026` [ux-date-format] (−1) |
| Responsiveness | 15 | 12 | On mobile the 295 per-user cards push the daily table about 76,000 px down [ui-usage-pagination] (−2); the daily Date column wraps to 3 lines at 390 and the User cell splits name and email awkwardly [ui-responsive-admin] (−1) |

Round 2, 2026-11-05. The visual source of truth is docs/ux/ui-design.md, which now has a §7.1 addendum (v2) for the gaps below. The rework is a large step up from round 1 (23 to 81). Every audit-1 blocker and major is fixed and verified live. Paging the admin Usage table, plus two or three of the minors, would take this past 85.

## Coverage of this audit

- **USER (ux-user), driven live:**
  - Screens and viewports: login (empty, error), chat (empty, streaming, Markdown reply, sidebar, quota panel, quota strip, sidenav, overflow menu, blocked) at 1440×900, 390×844 and 768×1024, in light and dark.
  - Messages: **2 chat messages sent** to claude-sonnet-5-5. The 3rd attempt was blocked by the 0.000001 override, so no LLM call was made.
- **ADMIN (ux-admin), driven live:**
  - Usage, Settings and Users at 1440×900 and 390×844, in light and dark.
  - Dialogs and flows: create-user with a duplicate email, edit user, self-row edit, deactivate confirm (Esc/cancel, then confirm), reactivate, self-row lock tooltip by keyboard.
- **State changes, all reverted:**
  - Override 0.000001 set on ux-user, blocked state shown, then cleared. The row reads "default" again.
  - ux-user deactivated, then reactivated. It is **Active**.
  - In Settings I typed an invalid value to check validation, but did not save it, and I reloaded the page afterwards.
  - System and default settings unchanged. ux-admin untouched.
  - The duplicate create was rejected (409), so no account was created.
- Not seen live: the "Low" (under 20%) warn state, which is present in code (`quota-panel.component.ts:26,100`), and the system-quota block variant (QA covered it).

## Issues

### Majors
- **[ui-usage-pagination]** Admin Usage @ 1440 and 390 — `frontend/src/app/features/admin/usage-tab.component.ts` — major. Review-4 and QA flagged this as known.
  - "Users (week-to-date)" renders all 295 rows with no paginator, search or collapse.
  - On desktop the Daily breakdown filters start about 15,000 px down the page.
  - On mobile the cards push `daily-table` to y≈76,300 px.
  - An admin who wants daily usage (AC-26) has to scroll past every user, and finding one user's week-to-date row means scanning by eye.
  - **Fix:** ui-design §7.1 `[ui-usage-pagination]`. Use `mat-paginator` at 25 per page with a name/email filter, or put Users and Daily in sub-tabs or expansion panels.
  - Screenshots: `test-results/ux/r2-admin-usage-desktop.png`, `test-results/ux/r2-admin-daily-filters-desktop.png`, `test-results/ux/r2-admin-usage-mobile-dark.png`.

### Minors
- **[ui-dialog-server-error]** Admin Users create dialog @ 1440 — `user-dialog.component.ts:90`, `users-tab.component.ts:164-174` — minor. Review-4 flagged this as known.
  - When I submitted an existing email, the dialog closed straight away. "A user with this email already exists" then appeared only as a snackbar.
  - The name, email and password I typed were gone, so the admin has to start again.
  - **Fix:** §7.1. Save inside the dialog, show a busy spinner, put a 409 inline as a `mat-error` on Email, and close only on success.
  - Screenshot: `test-results/ux/r2-admin-create-duplicate-desktop.png`.
- **[ux-lock-aria]** Admin Users self row @ all — `users-tab.component.ts:99` — minor.
  - The lock `mat-icon` has `tabindex="0"` and `aria-label`, but Material also sets `aria-hidden="true"` on it.
  - Keyboard focus lands on it and the tooltip shows. Screen readers, though, get nothing, and Chrome logs "Blocked aria-hidden on an element because its descendant retained focus".
  - **Fix:** `[attr.aria-hidden]="false"` (or an icon button), plus `aria-describedby` on the disabled toggle.
  - Screenshot: `test-results/ux/r2-admin-users-self-row-desktop.png`.
- **[ux-dialog-focus-return]** Admin Users @ all — `users-tab.component.ts` — minor.
  - After saving the edit dialog, and after confirming deactivate, `document.activeElement` is `<body>`.
  - The table re-renders, so the trigger that should get focus back no longer exists. Cancel or Esc does return focus to the toggle correctly.
  - **Fix:** §7.1. Re-focus the row's control by user id.
- **[ux-action-names]** Admin Users @ all — `users-tab.component.ts:107` — minor.
  - Every row's actions are named just "Edit" and "Reset password", 295 times over, so a screen-reader list of buttons can't tell them apart.
  - **Fix:** `aria-label="Edit <name>"` and `"Reset password for <name>"`.
- **[ui-forms]** Admin Settings @ 1440, user edit dialog @ 1440 — `settings-tab.component.ts`, `user-dialog.component.ts` — minor.
  - In Settings, "Non-negative, up to 6 decimal places" sits flush against the next field's label.
  - In the self-edit dialog, the two-line role hint overlaps the top border of the override field. The override hint is cut off at "Up to 6".
  - **Fix:** `subscriptSizing="dynamic"`, an 8 px field gap and a shorter hint (§7.1).
  - Screenshots: `test-results/ux/r2-admin-settings-desktop.png`, `test-results/ux/r2-admin-edit-self-desktop.png`.
- **[ui-block-banner]** Chat blocked @ 390 and 768 — `chat.page.ts` (banner styles) — minor. The copy, `role="alert"` and focus-on-block all now match §4.2.
  - The `block` icon is a flex child without `flex: none`, so it shrinks to 10 px at 390 and 13 px at 768 and renders as a clipped arc.
  - The "Blocked until …" tooltip on Send from §4.2 is also missing.
  - Screenshots: `test-results/ux/r2-chat-blocked-mobile-dark.png`, `test-results/ux/r2-chat-blocked-tablet-dark.png`.
- **[ui-shell]** All @ 390 — `shared/app-shell.component.ts` — minor.
  - On admin the bar reads "LLM Usage Co… › Admin UX AD… [ADMIN] ⋮", so both the product name and the user name are truncated.
  - **Fix:** §7.1. Move the name into the ⋮ menu on mobile.
  - Screenshot: `test-results/ux/r2-admin-users-mobile.png`.
- **[ux-date-format]** Admin Usage daily filters @ all — `usage-tab.component.ts` — minor.
  - The table now uses `05 Nov 2026`, which is fixed from audit-1. The date-range input still shows the US-locale `11/1/2026 – 11/5/2026`.
  - **Fix:** `MAT_DATE_FORMATS` set to `dd MMM yyyy`.
  - Screenshot: `test-results/ux/r2-admin-daily-filters-desktop.png`.
- **[ui-responsive-admin]** Admin Usage @ 390 — `usage-tab.component.ts` — minor.
  - The Users and Usage card lists and the scroll wrapper on the daily table all work, and there is no horizontal page scroll anywhere.
  - Two problems remain. The daily Date column wraps to "05 / Nov / 2026" on three lines. In the per-user card, the User value splits "QA n-" and "mw3nztxo57" in one column and the email in another.
  - **Fix:** §7.1.
  - Screenshots: `test-results/ux/r2-admin-daily-mobile-dark.png`, `test-results/ux/r2-admin-usage-mobile-dark.png`.

### Noted, not scored
- **D-2, Settings Save disabled on invalid input.** The build disables Save, while ui-design §4.9 says to keep it enabled. A QA test asserts disabled, and the decision is pending with the user. Validation itself works well: `mat-error` "Enter a non-negative amount, e.g. 10 or 0.000001" appears on blur, with `aria-invalid` and `aria-describedby`. I logged it as D-2 in ui-design §7.1 (`test-results/ux/r2-admin-settings-invalid-desktop.png`).
- **md-remote-images.** This is a security item, not UX. It's already in review-4.
- **Console warning.** `NG0953 Unexpected emit for destroyed OutputRef` still appears after the first message of a new chat. The QA report has it as Low.
- **Mobile sidenav focus.** With `[autoFocus]="false"`, focus stays on the menu button when the sidenav opens. The next Tab enters the list and Esc returns focus to the button, which is acceptable.

## Verified good (evidence for the score)
- **Chat streaming.** The message list is `role="log" aria-live="polite" aria-relevant="additions"`. The typing dots plus the visually hidden "Assistant is replying" appear about 1 s after send, then a 2 px indeterminate bar and a spinner in Send. **Focus stays on `composer-input`** for the whole stream. Tab order is skip link, Log out, New chat, conversation (`aria-current`), model, composer.
- **Markdown.** Replies render a real `<ul>` with `<strong>`, with no raw asterisks. The model chip contrast is 7.99:1, and colour-scheme is `light dark`.
- **Mobile chat (390).** `scrollWidth` is 390. The quota strip reads "You $0.098234 left · 98.23% / Sys $0.430002 left · 86.00%" and expands with `aria-expanded` to show both IST reset times. The composer is pinned and Send is icon-only with `aria-label="Send"`. When used up, the strip shows "$0.000000 left · 0.00% [Used up]" in error colour.
- **Blocked state.**
  - The quota card shows the "Used up" chip with a `block` icon, a 2 px danger border, a red bar and "of $0.000001 (personal limit)".
  - The banner reads "Personal quota reached / You've used your weekly limit of $0.000001. Resets 07 Nov 2026, 00:00 IST. Ask an admin if you need more." and takes focus.
  - The textarea stays enabled and keeps "Hi".
- **Admin.**
  - Shell: breadcrumb "› Admin", an ADMIN role chip and per-tab `<title>`s.
  - Usage table: numeric columns right-aligned with `tabular-nums`, and headers aligned to match.
  - Daily totals row is bold (600) and sticky. The override row reads "$0.000001 [override]".
  - Deactivate confirm: Cancel gets initial focus, Esc restores the toggle, a destructive red action, the snackbar "UX USER deactivated", and reactivate with no confirm plus "UX USER reactivated".
  - Self row: the toggle is disabled, the lock tooltip is reachable by keyboard, the role select is disabled with the hint "You can't deactivate yourself or remove your own admin role. Ask another admin."
  - Dark mode is intentional on every admin screen.

## Screenshots (this audit)
- Login: `test-results/ux/r2-login-desktop.png`, `test-results/ux/r2-login-error-mobile-dark.png`
- Chat: `test-results/ux/r2-chat-empty-desktop.png`, `r2-chat-reply-desktop.png`, `r2-chat-reply-desktop-dark.png`, `r2-chat-streaming-desktop.png`, `r2-chat-reply-mobile.png`, `r2-chat-quota-expanded-mobile.png`, `r2-chat-sidenav-mobile.png`, `r2-chat-menu-mobile-dark.png`, `r2-chat-usedup-desktop.png`, `r2-chat-blocked-desktop.png`, `r2-chat-blocked-mobile-dark.png`, `r2-chat-blocked-tablet-dark.png`
- Admin: `test-results/ux/r2-admin-usage-desktop.png`, `r2-admin-daily-desktop.png`, `r2-admin-daily-filters-desktop.png`, `r2-admin-usage-mobile-dark.png`, `r2-admin-daily-mobile-dark.png`, `r2-admin-settings-desktop.png`, `r2-admin-settings-invalid-desktop.png`, `r2-admin-settings-mobile-dark.png`, `r2-admin-users-desktop.png`, `r2-admin-users-desktop-dark.png`, `r2-admin-users-self-row-desktop.png`, `r2-admin-users-override-desktop.png`, `r2-admin-users-mobile.png`, `r2-admin-edit-user-desktop.png`, `r2-admin-edit-self-desktop.png`, `r2-admin-create-user-desktop.png`, `r2-admin-create-duplicate-desktop.png`, `r2-admin-deactivate-confirm-desktop.png`, `r2-admin-deactivate-confirm-mobile-dark.png`, `r2-admin-deactivated-desktop.png`

## Resolved since last audit
- [ui-responsive-chat] (blocker): `scrollWidth` 390 at 390. The over-mode sidenav, quota strip and pinned composer are all in view.
- [ui-sidebar] (blocker): conversation items are real `routerLink`s with `aria-current="page"`, reachable by Tab, with "Today" groups and IST times.
- [ux-focus-loss]: focus stays in `composer-input` through a send. A skip link is the first Tab stop.
- [ux-aria-live]: `role="log"`, `aria-live="polite"`, and `aria-busy` on the streaming bubble.
- [ui-streaming]: typing dots, then a progress line, plus a spinner in Send.
- [ui-confirm-dialog]: deactivate and ADMIN→USER confirms, and the self-row lock explanation, are in place. Only the lock icon's ARIA remains, now tracked as [ux-lock-aria].
- [ui-theme]: dark mode follows `prefers-color-scheme` and looks intentional.
- [ui-shell]: shared bar with surface-container and border, breadcrumb, role chip and ⋮ menu. A mobile truncation minor remains under the same key.
- [ui-message]: D-1 resolved with marked + DOMPurify (user-approved). Bubbles and the model chip match §4.3.
- [ui-tables]: right-aligned tabular figures, bold sticky totals row, and loading/empty/error states (in code).
- [ui-responsive-admin]: card lists under 600 and a scroll wrapper on the daily table. A minor remains under the same key.
- [ui-quota-meter]: "Used up" chip, icon and danger border. "Low" is in code.
- [ux-progress-name]: `aria-label` plus `aria-valuetext` on both bars.
- [ux-contrast-meta]: meta text is 7.2–8.9:1 and opacity dimming is gone.
- [ux-headings]: h1/h2 on every screen and per-route `<title>`.
- [ux-loading-states]: skeleton rows in the sidebar, a quota loading card, and a usage progress bar.
- [ux-toggle-feedback]: deactivated and reactivated snackbars.
- [ux-date-format]: the daily table uses `dd Mon yyyy`. The picker format remains under the same key.
- [ux-pct-framing]: admin says "used" and chat says "left", consistent per screen.
- [ux-shell-title]: the same product title appears on chat and admin, and the user name shows on admin.
- [ui-block-banner]: two-line copy with the limit, the IST reset and the next step, and focus moves to the banner. The icon sizing remains under the same key.
