---
name: review-conventions
description: Reviewer judgments made in review-1..6 (2026-11-05) on engineer deviations and recurring issue keys to reuse in later rounds
metadata:
  type: project
---
Accepted deviations (review-1, 2026-11-05), do not re-flag:
- `.cjs` tool configs (jest.config.cjs, sequelize-cli-config.cjs) OK; migrations themselves are TS, so spec 1.1 fallback not triggered.
- No seeders: settings row in migration, admin bootstrapped at startup.
- Fonts/icons from Google CDN in index.html: accepted for local demo.
- LiteLLM compose (review-2, revised 2026-11-05): NO env_file; LITELLM_MASTER_KEY (:?), LITELLM_SALT_KEY (:?), DATABASE_URL: ${LITELLM_DATABASE_URL:?} + STORE_MODEL_IN_DB=True; no ANTHROPIC_API_KEY anywhere (blocker if present in compose/config/.env.example); start with `docker compose --env-file .env -f litellm/docker-compose.yml up -d` (CLAUDE.md now matches). LiteLLM's own Prisma migrations are NOT a no-Prisma violation. Flag: app DATABASE_URL leaking into container, backend touching LiteLLM DB, loosened pg_hba workaround.
- Quota block `details.resetsAt` is in spec, not a deviation.
- T-2 gate PASSED 2026-11-05 (live, all 3 models give usage.cost in final stream chunk; non-stream only via x-litellm-response-cost header). Path A is final; any leftover "gate unverified" TODO = minor (t2-gate-todo-stale).
- litellm_cost_raw = String(parsed number) per spec 5.4 (e.g. haiku 5.999999999999999e-6 -> "0.000005999999999999999" -> cost_usd 0.000006); not a deviation.

Issue keys opened in review-1 (all minor, verdict APPROVE 90/100): money-number-lint-gap, chat-message-not-trimmed, empty-assistant-answer-persisted, chat-init-unhandled-rejection, usage-range-default-local-tz, chat-store-not-reset-on-logout, integration-tests-not-run, routes-bypass-service-layer.

Review-2 (2026-11-05, APPROVE 97): 7 review-1 minors resolved. Still open: integration-tests-not-run (Postgres.app refuses connections, user fixing). New: stream-survives-logout (ChatStore.reset() doesn't abort in-flight send; onDone repopulates old user's state).

Review-3 (2026-11-05, APPROVE 98): full npm test ran with real DATABASE_URL_TEST: backend 12 suites/116 tests, frontend 44, lint clean. Resolved: integration-tests-not-run, stream-survives-logout. New minors: t2-gate-todo-stale (llm-gateway.ts:104), cost-float-artifact-untested (no unit test for 5.999999999999999e-6 / exponent-form cost).

Review-4 (2026-11-05, UX audit-1 fixes in frontend/): marked 18.1.3 + DOMPurify 3.4.17 pinned exactly and user-approved (CLAUDE.md). Accepted, do not re-flag: Settings Save disabled on invalid input (QA test asserts it; ui-design 4.9 says enabled — doc conflict for UX/user, not a code defect); initial bundle ~507 kB vs 500 kB warning budget (advisory, no deduction). First-attempt ui-flows failures (AC-2 login empty fields, AC-24..28 user-save) judged dev-server live-reload/cold-start timing, not app bugs (no SSR, no async validators, no conditional outlet). Backend rollup suite once timed out in full run (148 s) but passed alone in 5.6 s — treat as env flake unless it recurs. New keys: md-remote-images, user-dialog-closes-on-server-error, quota-pct-unasserted, confirm-dialog-untested.

Review-5 (2026-11-05, APPROVE 97, audit-2 fixes): resolved t2-gate-todo-stale, cost-float-artifact-untested, user-dialog-closes-on-server-error, quota-pct-unasserted, confirm-dialog-untested. Open minors: md-remote-images (partial: DOMPurify default allow-list keeps `background` attr on table/td, Angular keeps it too, Chrome fetches it zero-click; verified via headless Chrome `channel: 'chrome'` since playwright's bundled chromium isn't installed and no jsdom), dialog-cancel-during-save, usage-page-sizes (10/25/50 vs §7.1 25/50/100). First full run had 6 admin.test failures from concurrent writer on shared DATABASE_URL_TEST (EmailTaken right after TRUNCATE); reruns green (backend 118, Karma 88). If recurs, open test-db-concurrent-use. Bundle 506.64 kB unchanged. QA (not engineer) edits ui-flows.spec.ts.

**Why:** reuse keys so recurrence is detectable; avoid relitigating accepted deviations.
**How to apply:** in later reviews, check these keys first and list fixed ones under "Resolved since last review". Integration tests need a real DATABASE_URL_TEST; with it blank, 46 tests skip.
Related: [[project-design-decisions]]

Review-6 (2026-11-05, APPROVE 100): resolved md-remote-images, dialog-cancel-during-save, usage-page-sizes. Headless-Chrome probe of 37 URL-loading vectors against markdown.ts config: 0 fetches (remaining a/area href, cite, rel=prefetch on a/area are non-loading). npm test green first run (backend 118, Karma 90); no test-DB contention.

Review-7 (2026-11-05, APPROVE 96, v3 visual refresh, frontend only): root `npm test` is `backend && frontend`, so a backend failure hides Karma; always confirm both counts (now backend 118, Karma 96; engineer's "96/96" = frontend only). First run hit test-db-concurrent-use (settings reset mid-test by an external process; jest maxWorkers=1) - 2nd occurrence, advisory, not scored when backend unchanged. Bundle 519.46 kB: accepted, recommended initial maximumWarning 550kB (fonts are CDN, not in bundle). New minors: mobile-theme-item-not-in-menu-keymanager (mat-menu-item inside a child component view is invisible to MatMenu's content query), suggestion-fill-untested, settings-discard-untested. Advisory keys: bundle-budget-stale, test-db-concurrent-use.

Review-8 (2026-11-05, APPROVE 99): resolved review-7 minors + bundle-budget-stale (550kB warning now set). Mobile theme: `<app-theme-toggle menuOnly>` only in shell's mobile @else branch, so theme testids unique at all widths. npm test green first run (backend 118, Karma 100); no DB contention. New minor: shell-spec-private-api-overclaims (spec reads MatMenu._allItems, title claims submenu opens but doesn't).

Review-9 (2026-11-05, APPROVE 98, audit-3 fixes): /chat and /chat/:id merged into one `chatMatcher` route (component reused; paramMap drives open; no init re-run on first message) - accepted design, do not re-flag. Resolved shell-spec-private-api-overclaims + audit-3 keys. npm test green first run (backend 118, Karma 105). Bundle 519.45 kB. Open minors: ui-quota-meter (`.app-chip` lacks white-space: nowrap, styles.scss), chat-route-reuse-untested (no ChatPage RouterTestingHarness test for reuse/focus/no-double-open).
