UX_VERDICT: APPROVE
UX_SCORE: 93/100
BLOCKERS: 0  MAJORS: 0  MINORS: 5

| Area | Max | Score | Main deductions |
|---|---|---|---|
| Task clarity & flows | 20 | 18 | After an admin saves a quota override in Users, the Usage tab still shows the old quota and Used % until the page is reloaded [ux-usage-stale] (−2) |
| States & feedback | 15 | 15 | None. Loading, empty, streaming (typing dots, `aria-busy`, "Sending" button), reply, used-up, blocked, login error, confirm and snackbar states are all present |
| Accessibility | 20 | 18 | Create-user dialog: an invalid email or an empty name turns the field red with no error text, so the error is shown by colour alone (WCAG 1.4.1 / 3.3.1) [ux-dialog-validation] (−2) |
| Visual design & polish | 20 | 18 | The quota-card state chip now drops onto its own row and sits alone at the right, and the reset line runs 3–23 px past its box at 768–1440 [ui-quota-meter] (−1); the tablet login (600–959) has a 457 px gradient block and a lone theme toggle, not the 120 px band in §3.1 [ui-login] (−1) |
| Consistency | 10 | 10 | None. USD at 6 dp everywhere, numbers right-aligned with matching headers, `dd MMM yyyy, HH:mm IST` on every screen |
| Responsiveness | 15 | 14 | At 768 the Users table is 864 px in a 718 px box: it scrolls 146 px sideways, names break ("UX / ADMIN") and "Reset password" touches the card edge [ui-responsive-admin] (−1) |

Round 4, 2026-11-05. Audited live against docs/ux/ui-design.md v3, as ux-user and ux-admin, at 1440×900, 768×1024 and 390×844 (plus 1024 spot checks), in Light and Dark. I re-scored every area from what I saw in this round, without carrying audit-3 scores forward. All 10 audit-3 keys are verified fixed. Small residues remain under 3 of them, and I found 2 new minors. The app now clears the bar comfortably.

## Method and coverage
- **Driving the app.** The MCP browser could not type the passwords without printing them into the transcript, and the environment refused that. So I drove the app with a local Playwright script (installed Chrome, separate contexts per role, viewport and theme). The script reads `.local/ux-credentials.json` and types the values into the login form, and they never appear in output. The MCP browser was only used for the final state check.
- **Screenshots.** All are in `docs/ux/screens/r4-*.png` (48 files).
- **USER (ux-user):**
  - Screens: login (empty, error), chat (empty with suggestions, streaming, reply with model chip, sidebar, quota panel, mobile strip collapsed and expanded, ⋮ menu, used-up and blocked).
  - Viewports and themes: 1440, 768 and 390 in Light and Dark.
  - **2 chat messages sent**, both to claude-sonnet-5-5: one at 1440 Light (a new chat, to check focus) and one at 390 Dark (a new chat, streaming). The three blocked attempts got a 429 before any LLM call.
- **ADMIN (ux-admin):**
  - Screens: Usage (hero card, per-user table with the paginator, the "ux-" filter, daily table with sticky header and Total), Settings, Users (filter, switch names, edit dialog, create dialog with invalid input, deactivate confirm then Esc).
  - Viewports and themes: 1440, 768 and 390 in Light and Dark, plus Users at 1024.
- **Theme:**
  - First load with OS dark emulated and nothing stored gives `theme-light`.
  - By keyboard: Enter on `theme-toggle`, then ArrowDown and Enter select Dark (`llmuc.theme=dark`, body `rgb(15,23,41)`), and focus returns to `theme-toggle`.
  - A reload paints `theme-dark` at once.
  - Menu items are `menuitemradio` with `aria-checked`, plus "Match your device".
- **Contrast scan.** I computed the contrast of every visible text node against its solid background on chat, Usage, Users and Settings in Light and Dark. There were **0 failures** below 4.5:1 (or 3:1 for large text). Text on the gradient was checked visually.
- **State changes, all reverted:**
  - I set the override 0.000001 on ux-user twice: once for the blocked state, once for the Used % cap after a reload. Both times I cleared it through the Edit dialog with an empty field. The row now reads "default" and **Active**.
  - The deactivate dialog was dismissed with Esc, so the switch is still checked. The create dialog was dismissed with Esc, so the user count is unchanged.
  - System and default settings were not touched.
- **Browser left at** 1440×900, Light (`llmuc.theme=light`, emulated scheme light), logged out on `/login`.
- **D-2** (Settings Save disabled on invalid input) is pending with the user and not scored. **D-3** (Material Symbols) is not implemented by design.

## Audit-3 keys, re-verified live
| Key | Result | Evidence |
|---|---|---|
| [ux-switch-name] | **Fixed** | The Users snapshot reads `switch "Active: UX USER" [checked]` and `switch "Active: UX ADMIN" [checked] [disabled]` at 1440, 768 and 390. Tab order goes `create-user` → filter → "Active: Administrator" → "Edit Administrator" → "Reset password for Administrator". `r4-admin-users-desktop-dark.png` |
| [ux-focus-loss] | **Fixed** | First message from `/chat`: the URL becomes `/chat/<id>`, the marked `<app-chat-page>` element survives (no remount), and `document.activeElement` is `composer-input` during the stream and after it ends, at 1440 Light and 390 Dark. No NG0953 or other console warnings. `r4-chat-reply-desktop.png`, `r4-chat-reply-mobile-dark.png` |
| [ui-usage-pagination] (daily) | **Fixed** | 296 rows in a 630 px scroller (70vh). After scrolling 600 px, the header is exactly at the scroller top and the Total row at its bottom (delta 0 px at all three widths). Total `$0.148704` equals the hero card's month-to-date. `r4-admin-daily-desktop-light.png` |
| [ux-pct-overflow] | **Fixed** | With the 0.000001 override, after a reload, the row reads `$0.004854 · $0.000001 [override] · $0.000000 · >999%`, and it fits at 768 (103/103 px). `r4-admin-usage-over-tablet.png` |
| [ui-quota-meter] | **Mostly fixed** (residue below) | `.app-chip` has `white-space: nowrap` (`styles.scss:210`). Both chips are 24 px high, with no internal overflow at any width. Both titles are one line (22 px). |
| [ui-login] (mobile) | **Fixed** (tablet residue below) | At 390 the band is 96 px with the logo, wordmark and white theme toggle inside it, and the card overlaps it by 24 px. Submit bottom is at y=385. `r4-login-error-mobile-light.png` |
| [ui-forms] | **Fixed** | The override field uses `floatLabel="always"`: the label sits above the outline and `$` sits inside, at 1440 and 390. `r4-admin-edit-user-desktop-dark.png` |
| [ux-date-format] | **Fixed** | Range inputs are 101/101 and 116/116 px (scroll/client), so nothing is clipped: "01 Nov 2026 – 05 Nov 2026". `r4-admin-daily-desktop-light.png` |
| [ui-shell] | **Fixed** | At 390 the breadcrumb is hidden, the wordmark fits (143/143 px), and the three tabs are stretched (119/132/115 px) with no pagination arrows. `r4-admin-usage-mobile-dark.png`, `r4-admin-users-mobile-light.png` |
| [ui-responsive-admin] (Usage @ 768) | **Fixed** (new Users residue below) | The per-user Usage table is 718 px in a 718 px box, with no inner scroll, and Used % is fully visible. `r4-admin-usage-tablet-light.png` |

## Issues

### Minors
- **[ux-usage-stale]** (new) Admin → Usage after editing a user @ all viewports — `frontend/src/app/features/admin/usage-tab.component.ts` (`ngOnInit` → `reload()` only), `admin.page.ts` (`onTab`) — minor.
  - The problem, step by step:
    1. Open `/admin`, go to Users, and set ux-user's override to $0.000001. The row shows "$0.000001 override".
    2. Switch back to the Usage tab. The row still reads Quota `$0.100000`, Remaining `$0.095146`, Used % `4.85%`.
    3. Only a full page reload shows `$0.000001 · $0.000000 · >999%`.
  - The impact: an admin checking their own change sees the old limit and can conclude the save didn't work.
  - **Fix:** call `reload()` on the usage tab when it becomes active (for example, `onTab` index 0 → `usageTab.reload()`), or after any successful user or settings save. Optionally add a small "Updated HH:mm IST · Refresh" line under the "Users (week-to-date)" heading.
  - Screenshots: `r4-admin-usage-filter-desktop-light.png` (before the reload), `r4-admin-usage-over-desktop.png` (after the reload).
- **[ux-dialog-validation]** (new) Create/Edit user dialog @ all viewports — `frontend/src/app/features/admin/user-dialog.component.ts:41-56` — minor.
  - The problem: type "bad" in Email and leave Name empty. Both outlines turn red, but **no** `mat-error` text appears. The Email field only renders `mat-error` for the server error, and Name and Password have none. Save is disabled with no reason given.
  - **Fix:** add these errors:

    | Field | Error text |
    |---|---|
    | Name | "Enter a name" |
    | Email | "Enter a valid email address" (`hasError('email')`) and "Enter an email" (`required`) |
    | Password | "At least 8 characters" |

    Keep the server error message as it is.
  - Screenshot: `r4-admin-create-user-invalid-tablet.png`.
- **[ui-quota-meter]** (residue) Chat quota column @ 1440, 1024, 768 — `frontend/src/app/features/chat/quota-panel.component.ts` — minor.
  - The chip problem: with `.head { flex-wrap: wrap }`, the chip always wraps and then sits alone at the far right of a second row ("On track" or "Used up" floating under the title). It reads as orphaned, not as a status of the amount.
  - The reset-line problem: the reset line is `nowrap` and 226–228 px wide in a box of 205 px at 768 and 225 px at 1024 and 1440. At 768 "00:00 IST" runs into the card's right padding and touches the border.
  - **Fix:**
    - When the chip wraps, give it `margin-inline-start: 0`, or move it to the end of the amount row ("$0.095146 left [On track]").
    - Make the reset line `white-space: normal`, so only the "00:00 IST" span stays together, or drop "Resets" to "↻ 07 Nov 2026, 00:00 IST" under 1024.
  - Screenshots: `r4-chat-desktop-light.png`, `r4-chat-tablet-dark.png`.
- **[ui-login]** (residue: tablet) Login @ 768 — `frontend/src/app/features/login/login.page.ts` (styles) — minor.
  - The problem: at 600–959 the brand panel is a 457 px gradient block with the full headline and checklist. The theme toggle floats alone on the tint under it, and the card sits far below at y≈565–917. §3.1 calls for a 120 px header band above the centred card.
  - The page is still usable, because the submit button is in view.
  - **Fix:**
    - At 600–959, set the band to 120 px with the logo, wordmark and the toggle inside it, top-right and white.
    - Hide the checklist, or show only the headline at 26/34.
    - Pull the card up toward the band, using the same treatment as under 600.
  - Screenshot: `r4-login-tablet-light.png`.
- **[ui-responsive-admin]** (residue: Users @ 768) Admin Users table @ 768 — `frontend/src/app/features/admin/users-tab.component.ts` — minor.
  - The problem: the table is 864 px in a 718 px scroll box, so it scrolls 146 px sideways inside the card.
    - Names wrap per word ("UX / ADMIN").
    - Emails break at the hyphen.
    - The actions column stacks "Edit" over "Reset password", which touches the card's right edge.
    - In the unfiltered list the scroll position can hide the Name column (`r4-admin-create-user-invalid-tablet.png` shows Email as the first visible column).
  - 1024 and 1440 fit (974/974 and 1198/1198 px), and 390 uses cards correctly.
  - **Fix:** at 600–1023, put the email under the name (as the Usage table already does) and drop the Role column into a chip under the name. Or switch `.app-cards` to apply under 840 px. Either way, keep the action buttons on one line.
  - Screenshot: `r4-admin-users-tablet-light.png`.

### Noted, not scored
- **D-2:** Settings Save is disabled on invalid input. Pending with the user.
- **D-3:** Material Symbols. Not implemented by design.
- **Mobile composer hint:** at 390 the hint wraps to two lines ("…for a new / line"). Shortening it to "Enter to send · Shift+Enter for new line" or hiding it under 400 px would tidy this.
- **Daily table totals:** the totals show raw token counts ("9804", "13082"). Use `number:'1.0-0'` for thousands separators if the volume grows.
- **Daily table at 390:** the table scrolls sideways inside its sticky box (727/364 px) with Date pinned. This is acceptable for a seven-column data table.
- **Used % title:** review-9 says the raw Used % is kept in a `title`. I found no `title` on the Used % cell itself; it may be on an inner element. This does not affect sighted users.
- **Console:** only the expected 401 (bad login) and 429 (blocked send). No warnings.

## Verified good (evidence for the score)
- **Quota clarity:**
  - Desktop cards: "$0.095146 left", "95.15% left", "of $0.100000" and "Resets 07 Nov 2026, 00:00 IST", with a state chip that has both an icon and a word.
  - The amount updated right after the reply ($0.095506 → $0.095146).
  - The mobile strip is one named button: "You $0.093716 left · 93.72% On track, Sys $0.349866 left · 69.97% On track". It expands to both bars with both IST resets.
- **Blocked state** (1440 Light, 390 Light, 768 Dark):
  - The banner is `role="alert"` and takes focus: "Personal quota reached / You've used your weekly limit of $0.000001. **Resets 07 Nov 2026, 00:00 IST**. Ask an admin if you need more."
  - The card has a red accent and the "Used up" chip, and reads "of $0.000001 (personal limit)".
  - The textarea keeps "Hi". Send carries a described-by tooltip.
  - There is no horizontal scroll at any width.
- **Streaming:** typing dots, `aria-busy="true"` on the list, a polite live region, the model picker disabled, and a "Sending" spinner on the button. The model chip text is exactly `claude-sonnet-5-5`.
- **Admin safety:**
  - The self row has a disabled switch plus a named lock `img`: "You can't deactivate yourself or remove your own admin role. Ask another admin."
  - Deactivate shows "Deactivate UX USER?" with initial focus on Cancel. Esc returns focus to "Active: UX USER" and leaves it checked.
  - Closing the Edit dialog with Esc returns focus to "Edit UX USER".
- **Tables:** money and percentage headers are `text-align: end`, matching their cells, and the default sort is Used, descending. The paginator reads "1 – 25 of 624". The filters "ux-" and "ux-user" narrow to 2 rows and 1 row.
- **Dark:** body `#0f1729`, side columns `#151f35`, cards, bubbles and composer `#1b2640`, and a dimmed gradient bar. Every layer is distinct, and the used-up chip and banner keep their meaning in dark.
- **Mobile (390):** document `scrollWidth` is 390 on chat, login and all admin tabs. The composer is pinned, with Send at y≈729–773. The tabs fit without arrows.

## Screenshots (this audit, `docs/ux/screens/`)
- **Login:** `r4-login-desktop-default-osdark.png`, `r4-login-desktop-dark.png`, `r4-login-error-desktop-dark.png`, `r4-login-tablet-light.png`, `r4-login-mobile-light.png`, `r4-login-mobile-dark.png`, `r4-login-error-mobile-light.png`
- **Chat:** `r4-chat-desktop.png`, `r4-chat-desktop-light.png`, `r4-chat-desktop-dark.png`, `r4-chat-1024.png`, `r4-chat-tablet-light.png`, `r4-chat-tablet-dark.png`, `r4-chat-mobile-light.png`, `r4-chat-mobile-dark.png`, `r4-chat-streaming-desktop.png`, `r4-chat-reply-desktop.png`, `r4-chat-streaming-mobile-dark.png`, `r4-chat-reply-mobile-dark.png`, `r4-chat-quota-expanded-mobile.png`, `r4-chat-menu-mobile.png`, `r4-chat-blocked-desktop-light.png`, `r4-chat-blocked-mobile-light.png`, `r4-chat-blocked-tablet-dark.png`
- **Admin:**
  - Usage: `r4-admin-usage-{desktop,tablet,mobile}-{light,dark}.png`, `r4-admin-usage-filter-{desktop,tablet,mobile}-light.png`, `r4-admin-usage-over-desktop.png`, `r4-admin-usage-over-tablet.png`
  - Daily: `r4-admin-daily-{desktop,tablet,mobile}-light.png`
  - Users: `r4-admin-users-{desktop-light,desktop-dark,tablet-light,mobile-light}.png`, `r4-admin-users-1024.png`
  - Dialogs: `r4-admin-edit-user-desktop-dark.png`, `r4-admin-edit-user-mobile-light.png`, `r4-admin-deactivate-confirm-tablet-light.png`, `r4-admin-create-user-invalid-tablet.png`
  - Settings: `r4-admin-settings-desktop-light.png`

## Resolved since last audit
- [ux-switch-name] (major): the inner `button[role=switch]` is named "Active: <name>".
- [ux-focus-loss]: there is one chat route for `/chat` and `/chat/:id`, the page doesn't remount, focus stays in the composer, and NG0953 is gone.
- [ui-usage-pagination] (daily residue): the daily table scrolls within 70vh, with a sticky header and a sticky Total computed from server totals.
- [ux-pct-overflow]: `>999%` cap.
- [ui-forms] (prefix and label collision): `floatLabel="always"`.
- [ux-date-format] (clipped range inputs): the field is 300 px and the inputs no longer clip.
- [ui-shell] (390 wordmark and tab strip): the crumb is hidden and the tabs are stretched.
- [ui-login] (390 band): 96 px band, toggle in the band, card overlap. A tablet residue stays open under the same key.
- [ui-quota-meter] (chip text wrap, title wrap): the chip is `nowrap` and the titles fit on one line. A placement and reset-line residue stays open under the same key.
- [ui-responsive-admin] (Usage table @ 768): it fits with no inner scroll. A Users table residue stays open under the same key.
