UX_VERDICT: CHANGES
UX_SCORE: 84/100
BLOCKERS: 0  MAJORS: 1  MINORS: 9

| Area | Max | Score | Main deductions |
|---|---|---|---|
| Task clarity & flows | 20 | 17 | The daily breakdown renders all 203 rows (about 10,600 px) with no paging, and its Total row is no longer sticky [ui-usage-pagination] (−2); Used % shows "449400.00%" for a user whose override is below their usage [ux-pct-overflow] (−1) |
| States & feedback | 15 | 15 | None. Loading, empty ("No users match this filter"), streaming, used-up, blocked, inline dialog error and snackbar states are all present |
| Accessibility | 20 | 14 | The Users-tab Active switch has no accessible name, ×432 rows [ux-switch-name] (major, −4); focus drops to `<body>` after the first message of a new chat [ux-focus-loss] (−2) |
| Visual design & polish | 20 | 16 | Quota-card headers squeeze: the title wraps to 2–3 lines and the "On track"/"Used up" pill wraps to 2 lines at 1440 and 768 [ui-quota-meter] (−2); the mobile login band is about 300 px tall, not the 96 px band with an overlapping card, and the theme toggle floats alone [ui-login] (−1); the `$` prefix touches the resting label "$Weekly quota override (USD)" [ui-forms] (−1) |
| Consistency | 10 | 9 | The daily date-range input now uses `01 Nov 2026`, but both halves are clipped ("01 Nov 202(– 05 Nov 202(") [ux-date-format] (−1) |
| Responsiveness | 15 | 13 | At 390 the bar still truncates "LLM Usage Co…" and the admin tab strip cuts "Users" behind scroll arrows [ui-shell] (−1); at 768 the per-user usage table scrolls 44 px sideways inside its card and clips Used % [ui-responsive-admin] (−1) |

Round 3, 2026-11-05. Audited against docs/ux/ui-design.md v3 (§2 tokens, §4 components, §8 refresh). Every audit-2 item is fixed or reduced to a smaller residue, and the v3 refresh is implemented faithfully. The score sits one point under the bar because of one unnamed control, a new-chat focus regression, and some layout squeeze in the quota card. All of these are small, contained fixes.

## Verdict on the user's feedback ("too black", "doesn't look so design friendly")
**Resolved.**
- **Light default.** First load is Light even with `prefers-color-scheme: dark` emulated, and it looks designed rather than default Material:
  - an indigo-to-violet gradient bar with the gauge logo tile;
  - Plus Jakarta Sans headings over Inter body text;
  - a white raised card on a tinted `#f5f6fb` page;
  - gradient user bubbles with white assistant cards and a model chip;
  - 10 px pill meters with state chips;
  - a split-panel login.
- **Dark.** Dark is soft navy, not black. Measured layers are page `#0f1729`, sidebar and quota column `#151f35`, cards, bubbles and composer `#1b2640`, with menus and dialogs on L3. Every layer is visibly distinct.
- **What still holds it back.** The remaining polish gaps are small: the quota-card header squeeze and the mobile login band.

## Coverage of this audit
- **USER (ux-user):**
  - Screens: login (empty, error), chat (empty with suggestions, streaming, Markdown reply, sidebar, quota panel, mobile strip expanded, ⋮ menu, theme submenu, used-up, blocked).
  - Viewports and themes: 1440×900, 768×1024 and 390×844, in Light and Dark.
  - **2 chat messages sent** to claude-sonnet-5-5. The 3rd attempt was blocked by the override, so no LLM call was made.
- **ADMIN (ux-admin):**
  - Screens: Usage (hero card, per-user table, paginator at 25/50/100, next page, filter, empty filter, daily table and total), Settings, Users (filter, edit dialog, self row, deactivate confirm then Esc).
  - Viewports and themes: 1440, 768 and 390, in Light and Dark.
- **Theme:**
  - Default Light under OS-dark emulation, with storage cleared.
  - Desktop menu by keyboard: ArrowDown and Enter select Dark, and focus returns to the trigger.
  - Dark survives a reload. The inline pre-boot script is present.
  - System follows the OS live (dark → light).
  - The mobile ⋮ menu works by keyboard: ArrowRight opens the Theme submenu, ArrowDown and Enter select, and focus returns to "More actions".
  - Tablet uses the icon button. The login page has its own toggle.
  - Exactly one `theme-toggle` at every width. `menuitemradio` items with `aria-checked`, plus the "Match your device" line.
  - Reduced motion sets the `--app-motion-*` tokens to 0 ms.
- **State changes, all reverted:**
  - Override 0.000001 set on ux-user, the blocked state shown, then cleared. The row reads "default" and **Active**.
  - The deactivate dialog was opened and dismissed with Esc, so nothing changed.
  - System and default settings unchanged.
  - The MCP browser is left at 1440×900, Light (`llmuc.theme=light`), logged out, with the emulated scheme reset to light.
- **D-2** (Settings Save disabled on invalid input) is pending with the user and not scored. **D-3** (Material Symbols) is not implemented by design.

## Pagination: verified live (closes [ui-usage-pagination] for the per-user table)
- QA's "renders every row" note is stale.
- The admin Usage per-user table has `mat-paginator` (`data-testid="user-usage-paginator"`):
  - It shows "1 – 25 of 432" on load, with options 25/50/100. 50 rows at 50 and 100 rows at 100.
  - Next page gives "101 – 200 of 432".
  - The name/email filter "ux-" gives "1 – 2 of 2" and resets to page 1.
  - A no-match filter shows the empty state "No users match this filter".
  - The paginator fits at 390 (366 px, no overflow).
- The remaining length problem is the **daily** table (below).

## Issues

### Major
- **[ux-switch-name]** Admin Users @ all viewports — `frontend/src/app/features/admin/users-tab.component.ts:94-101` — major.
  - The problem: the snapshot shows `switch [checked]` with **no name** on every row.
    - `[attr.aria-label]="'Active: ' + u.name"` lands on the `<mat-slide-toggle>` host.
    - The focusable inner `button[role=switch]` is `aria-labelledby` an empty `<label>`.
  - The impact: a screen-reader user tabbing through 432 rows hears "switch, on" with no person, on a destructive, lock-out-relevant control. That fails WCAG 4.1.2.
  - **Fix:** use the input `[aria-label]="'Active: ' + u.name"`, not `attr.`, because MatSlideToggle forwards `aria-label` to the inner button. Keep `aria-describedby` for the self row. Check that the snapshot reads `switch "Active: UX USER"`.
  - Screenshot: `test-results/ux/r3-admin-users-desktop-dark.png`.

### Minors
- **[ux-focus-loss]** Chat, first message of a new chat @ 1440 — `frontend/src/app/features/chat/chat.page.ts` / `composer.component.ts` — minor.
  - After sending from `/chat`, the route changes to `/chat/<id>` and `document.activeElement` becomes `<body>`.
  - Within an existing conversation, focus correctly stays in `composer-input` through the stream (checked at 300, 900 and 1800 ms and after done).
  - **Fix:** after the navigation to the new conversation, re-focus `composer-input`. Either focus it on composer init when the previous route was `/chat` with a pending send, or keep the same component instance across `/chat` → `/chat/:id`.
  - Screenshot: `test-results/ux/r3-chat-reply-desktop.png`.
- **[ui-usage-pagination]** (residual: daily table) Admin Usage, Daily breakdown @ 1440 and 390 — `usage-tab.component.ts:191-228` — minor.
  - The per-user table is fixed. The daily table, though, now renders all 203 rows (about 10,650 px, starting at y≈2,060 on desktop and 7,300 on mobile).
  - The `mat-footer-row` Total is static at the very bottom. In audit-2 it was sticky.
  - The "Daily breakdown" jump link and the filters at the top keep it usable, so this is minor.
  - **Fix:** do one of these:
    - add a paginator (50 per page) to the daily card, with the Total computed over the whole range, not the page;
    - or make the footer row sticky (`*matFooterRowDef="…; sticky: true"`) and cap the scroll area at `max-height: 70vh`.
  - Screenshot: `test-results/ux/r3-admin-daily-total-desktop.png`.
- **[ux-pct-overflow]** Admin Usage per-user table @ all — `usage-tab.component.ts` — minor.
  - While ux-user had the 0.000001 override, the row read Used `$0.004494`, Quota `$0.000001`, Remaining `$0.000000`, Used % **`449400.00%`**.
  - That number is mathematically true but unreadable, and it overflows the 768 column.
  - **Fix:** cap the display at `>999%`, or show "Over limit" as an error chip next to 100.00%. Keep the raw value in a `title` or `aria-label` if needed.
  - Screenshot: `test-results/ux/r3-admin-usage-tablet.png`.
- **[ui-quota-meter]** Chat quota column @ 1440 and 768 — `frontend/src/app/features/chat/quota-panel.component.ts` — minor.
  - The 300 px column cannot fit the icon tile, the title and the state chip on one line:
    - "Your weekly quota" wraps to 2 lines and "System monthly quota" to 3.
    - The chip text wraps inside the pill ("On / track", "Used / up").
    - The reset line also wraps "00:00 / IST".
  - **Fix:**
    - Put `white-space: nowrap` on `.app-chip`.
    - Let the header wrap the chip *below* the title (`flex-wrap: wrap`, chip `margin-inline-start: 0` on wrap), or shorten the titles to "Weekly quota" and "System quota". The `h2` text is not asserted by tests.
    - Use `white-space: nowrap` on the "00:00 IST" part of the reset line.
  - Screenshots: `test-results/ux/r3-chat-reply-desktop.png`, `test-results/ux/r3-chat-reply-tablet-dark.png`.
- **[ui-login]** Login @ 390 — `frontend/src/app/features/auth/login.page.ts` (styles) — minor.
  - The brand band is about 300 px tall and still shows the headline. §3.1 and §5 call for a 96 px band with the logo and wordmark only, and the card overlapping it by 24 px.
  - The theme toggle sits alone in a strip between band and card.
  - It is still usable, because the submit button is in view at 844.
  - **Fix:** follow §5. Hide the headline under 600, set the band to 96 px, pull the card up by `-24px`, and put the toggle inside the band, top-right, white.
  - Screenshot: `test-results/ux/r3-login-error-mobile.png`.
- **[ui-forms]** Edit-user dialog @ 1440 — `user-dialog.component.ts` — minor.
  - The hint overlaps from audit-2 are fixed, in Settings and the dialog.
  - New: the empty override field shows "$Weekly quota override (USD)", because the `matTextPrefix` `$` sits flush against the resting label.
  - **Fix:** show the prefix only when the field has a value or focus (`@if (form.value.override || focused)`), or use `floatLabel="always"`.
  - Screenshot: `test-results/ux/r3-admin-edit-user-desktop-dark.png`.
- **[ux-date-format]** Admin Usage daily filters @ all — `usage-tab.component.ts` — minor.
  - The format is fixed (`01 Nov 2026 – 05 Nov 2026`).
  - The two range inputs are 90/93 px wide with a scrollWidth of 95/98, so the last digit is clipped at every width.
  - **Fix:** widen the field (`min-width: 260px`), or reduce the input font in the range field.
  - Screenshot: `test-results/ux/r3-admin-usage-filter-empty-desktop.png`.
- **[ui-shell]** All @ 390 — `shared/app-shell.component.ts` — minor.
  - The user name has moved into the ⋮ menu (fixed from audit-2).
  - On admin, "LLM Usage Co…" is still truncated (143 px of text in a 128 px box) next to "› Admin [ADMIN]".
  - The admin tab strip shows scroll chevrons and cuts the "Users" tab.
  - **Fix:** under 600, drop the wordmark to the logo tile alone on admin, or drop the breadcrumb (the `h1` already says Admin). Give the tabs `mat-stretch-tabs` with labels that fit (3 × 120 px fits in 366).
  - Screenshot: `test-results/ux/r3-admin-users-mobile.png`.
- **[ui-responsive-admin]** Admin Usage per-user table @ 768 — `usage-tab.component.ts` — minor.
  - The table is 762 px in a 718 px scroll box, so Used % is cut ("4.9…") and a horizontal scrollbar appears inside the card. The emails also wrap mid-token ("qa- / mw3…").
  - The page itself has no horizontal scroll (`scrollWidth` 768), and 390 uses cards correctly.
  - **Fix:** below 1024, drop the Role column, or move the email under the name with `word-break: break-all`, or switch to `.app-cards` below 840.
  - Screenshot: `test-results/ux/r3-admin-usage-tablet.png`.

### Noted, not scored
- **D-2:** Settings Save is disabled on invalid input. Pending with the user.
- **D-3:** Material Symbols. Not implemented by design.
- **Console:** the dev warning `NG0953 Unexpected emit for destroyed OutputRef` still appears on the first message of a new chat. It is probably the same root cause as [ux-focus-loss]: the composer is destroyed on navigation. The expected 401 and 429 appeared on the bad login and the blocked send.
- **Daily table:** token counts are shown without thousands separators ("6737"). This is fine at this scale, but use `number:'1.0-0'` if the counts grow.
- **Storage:** I did not re-test the `localStorage`-throws path live. QA and unit tests cover it.

## Verified good (evidence for the score)
- **Theme:**
  - `html.theme-light` on first visit with the OS dark. Body `#f5f6fb`, `color-scheme: light`, nothing stored.
  - Dark: body `rgb(15,23,41)`, sidebar and aside `rgb(21,31,53)`, cards and composer `rgb(27,38,64)`.
  - The trigger label updates ("Theme: Dark"), the tooltip reads "Change theme", and the check mark plus `aria-checked` sit on the current item.
  - Screenshots: `r3-theme-menu-desktop.png`, `r3-theme-submenu-mobile.png`, `r3-chat-reply-desktop-dark.png`, `r3-chat-reply-mobile-dark.png`, `r3-login-desktop-dark.png`.
- **Brand and type:**
  - The wordmark and headings are Plus Jakarta Sans 700/600, the body is Inter.
  - The bar is `linear-gradient(100deg, #312e81, #4338ca 55%, #6d28d9)`.
  - The bar meta text is `#e0e7ff` at opacity 1.
- **Chat:**
  - The empty state has the 72 px gradient tile, "Start a conversation", the explainer and 3 suggestion chips.
  - Markdown renders a real `<ul>` plus inline `code`. `message-model` text equals "claude-sonnet-5-5".
  - Streaming: `aria-busy`, typing dots and "Assistant is replying".
  - Quota updated after each reply ($0.098234 → $0.097418 → $0.095506).
- **Blocked:**
  - The "Used up" chip and danger accent show on the card.
  - The banner has a 40 px tile with a 24 px icon at every width, which fixes the audit-2 shrink.
  - Banner copy: "Personal quota reached / You've used your weekly limit of $0.000001. **Resets 07 Nov 2026, 00:00 IST**. Ask an admin if you need more." The banner takes focus.
  - Send has the tooltip "Blocked until 07 Nov 2026, 00:00 IST", and the textarea keeps "Hi".
  - Screenshots: `r3-chat-blocked-desktop.png`, `r3-chat-blocked-mobile.png`, `r3-chat-blocked-tablet-dark.png`.
- **Mobile chat:** `scrollWidth` 390. The strip reads "You $0.095506 left · 95.51% [On track]" and expands with both IST resets. The composer is pinned.
- **Admin:**
  - The hero system card, the tab icons with exact names, and the Settings cards with the action bar ("Changes apply to the next message.", Discard, Save changes).
  - Numbers are right-aligned, and the sort header labels line up with the column edges.
  - Row actions are named "Edit QA n-…" and "Reset password for QA n-…".
  - The self-row lock is an `img` with a name, plus a described-by hint.
  - Edit save returns focus to `edit-user` with the "User updated" snackbar.
  - The deactivate dialog has the danger tile, "Deactivate UX USER?", initial focus on Cancel, and a red Deactivate button. Esc returns focus to the switch.

## Screenshots (this audit)
- Login: `test-results/ux/r3-login-desktop.png`, `r3-login-desktop-dark.png`, `r3-login-error-mobile.png`
- Chat: `test-results/ux/r3-chat-empty-desktop.png`, `r3-chat-streaming-desktop.png`, `r3-chat-reply-desktop.png`, `r3-chat-reply-desktop-dark.png`, `r3-theme-menu-desktop.png`, `r3-chat-reply-mobile.png`, `r3-chat-menu-mobile.png`, `r3-theme-submenu-mobile.png`, `r3-chat-reply-mobile-dark.png`, `r3-chat-quota-expanded-mobile-dark.png`, `r3-chat-reply-tablet-dark.png`, `r3-chat-usedup-desktop.png`, `r3-chat-blocked-desktop.png`, `r3-chat-blocked-mobile.png`, `r3-chat-blocked-tablet-dark.png`
- Admin: `test-results/ux/r3-admin-usage-desktop.png`, `r3-admin-usage-header-desktop.png`, `r3-admin-usage-filter-empty-desktop.png`, `r3-admin-daily-total-desktop.png`, `r3-admin-usage-mobile-dark.png`, `r3-admin-usage-paginator-mobile-dark.png`, `r3-admin-usage-tablet.png`, `r3-admin-users-desktop-dark.png`, `r3-admin-edit-user-desktop-dark.png`, `r3-admin-settings-desktop.png`, `r3-admin-users-tablet.png`, `r3-admin-deactivate-confirm-tablet.png`, `r3-admin-users-mobile.png`

## Resolved since last audit
- [ui-usage-pagination] (major): the per-user table is paginated (25/50/100) with a name/email filter and an empty state, verified live. Only the daily-table residue remains, as a minor under the same key.
- [ui-dialog-server-error]: the duplicate email stays in the dialog with an inline error (QA r3, AC-27).
- [ux-lock-aria]: the lock is exposed as a named `img` with a hint, and the console warning is gone.
- [ux-dialog-focus-return]: Edit save returns focus to `edit-user`, and deactivate Esc returns it to the switch.
- [ux-action-names]: "Edit <name>" and "Reset password for <name>".
- [ui-forms] (hint overlap): fixed in Settings and the dialog. A new prefix/label collision is tracked under the same key.
- [ui-block-banner]: the icon tile is 40 px with a 24 px icon at 390, 768 and 1440, and the Send tooltip "Blocked until …" is present.
- [ui-shell] (user name truncation): the name has moved into the ⋮ menu. Wordmark truncation on admin remains under the same key.
- [ux-date-format] (US picker format): the picker now uses `dd MMM yyyy`. Input clipping remains under the same key.
- [ui-responsive-admin] (390 date wrap and user cell split): the daily Date stays on one line and the user cell stacks name above email. A 768 issue remains under the same key.
- v3 refresh: [ui3-tokens], [ui3-theme-switch] (all widths, keyboard, no flash, System live), [ui3-fonts], [ui3-topbar], [ui3-logo], [ui3-dark-surfaces], [ui3-meter], [ui3-banner], [ui3-bubbles], [ui3-composer], [ui3-empty-chat], [ui3-login] (desktop; the mobile band is tracked as [ui-login]), [ui3-tables], [ui3-admin], [ui3-motion] (reduced-motion tokens at 0 ms), [ui3-icons], [ui3-sidebar], [ui3-dialogs], [ui3-suggestions], [ui3-strip].

**Path to ≥ 85:** fixing [ux-switch-name] (a one-attribute change, +4) alone clears the bar. Adding [ux-focus-loss] and [ui-quota-meter] would put it around 92.
