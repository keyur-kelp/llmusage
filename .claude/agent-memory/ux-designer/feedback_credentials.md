---
name: feedback-credentials
description: How to log in for audits - use .local/ux-credentials.json (ux-admin/ux-user), never .env admin creds; save screenshots in docs/ux/screens/
metadata:
  type: feedback
---
Never read ADMIN_EMAIL/ADMIN_PASSWORD from `.env`; the environment refuses it. Test logins live in `.local/ux-credentials.json` (git-ignored; shape `admin.email/password`, `user.email/password` for ux-admin@example.test and ux-user@example.test). Use them only to type into the login form, and never print the passwords in reports or screenshot names. Save audit screenshots to `docs/ux/screens/r<n>-*.png`, not test-results/.

**Why:** in audit-1 the .env read was refused twice. In round 4 (2026-11-05), the old location `test-results/ux/credentials.local.json` and all the r1–r3 screenshots were wiped. A Playwright run with the default outputDir cleans `test-results/`. The coordinator moved the credentials to `.local/` and asked for screenshots in docs/ux/screens/.
**How to apply:** at the start of AUDIT mode, check that `.local/ux-credentials.json` exists. If it's missing, hand back asking for it rather than looking for other credentials (QA accounts, test code). Revert any state changes before finishing (overrides, deactivation).

**Login mechanics:** the classifier refuses printing the passwords (Credential Materialization). Use a Node Playwright script (`require('<repo>/node_modules/playwright')`, `channel: 'chrome'`) that reads the file and fills `login-email` / `login-password` itself. The script lives in the scratchpad and outputs metrics plus screenshots only.
