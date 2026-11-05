---
name: project-audit-findings
description: UX audit history and recurring issue keys for the LLM Usage Control Angular app (audit-1 23, audit-2 81, audit-3 84, audit-4 93 APPROVE)
metadata:
  type: project
---
History: audit-1 23, audit-2 81 and audit-3 84 were CHANGES. Audit-4 (2026-11-05) scored 93, APPROVE, with 0 blockers, 0 majors and 5 minors. All 10 audit-3 keys are verified fixed live. D-2 is still open (Settings Save disabled on invalid input). D-3 (Material Symbols) is not done by design.

Open minors after round 4:
- [ux-usage-stale] (new): after a user save, the Usage tab doesn't refetch, so it shows the old quota and % until a reload.
- [ux-dialog-validation] (new): the create/edit dialogs have no mat-error text for name, email or password, so errors are colour only.
- [ui-quota-meter] residue: the chip wraps and sits alone at the right; the nowrap reset line overflows its box at 768–1440.
- [ui-login] residue: the tablet 600–959 band is 457 px, not 120 px, and the toggle floats alone.
- [ui-responsive-admin] residue: at 768 the Users table is 864 px in a 718 px box.

**Why:** later audits must reuse keys and list "Resolved since last audit".
**How to apply:**
- QA and review notes can be stale (review-9 said `.app-chip` lacked nowrap, but it was already added), so verify live.
- Filter admin tables by "ux-" (the DB has 620+ QA users).
- The Usage tab must be reloaded to see override changes.
- MCP can't type the passwords without printing them, so drive the app with a local Playwright script that reads the creds file (see [[feedback-credentials]]). Use the MCP browser only for the final state.
