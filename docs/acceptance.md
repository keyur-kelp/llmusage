DECISION: ACCEPT

# PM acceptance — LLM Usage Control Demo (2026-11-05)

> Saved by the orchestrator from the pm-acceptance agent's returned report (its file write was refused). Decision and content are the PM agent's.

## Basis
- QA round 4 (`docs/qa/report.md`): RESULT PASS, 30/30 ACs, 224/224 unit, backend line coverage 98.04%, three clean 36/36 spec runs.
- Code review round 9 (`docs/reviews/review-9.md`): APPROVE 98/100.
- UX audit round 4 (`docs/ux/audit-4.md`): APPROVE 93/100.
- PM re-ran `npm test` (backend 118/118, quota-check p95 4.8 ms; frontend 106/106), made unauthenticated live checks (401s, `INVALID_CREDENTIALS`, zod `VALIDATION_ERROR`, LiteLLM liveliness), spot-checked migrations, quota-before-LLM ordering, transactional ledger writes, rollup locking/idempotency, cron `5 0 * * *` Asia/Kolkata, LiteLLM-only cost, `litellm_credential_name: anthropic`, and absence of forbidden tech (`sync()`, `parseFloat`, Prisma/Knex/TypeORM, provider SDK, Langfuse).
- Not done by PM: logged-in live checks (read-only admin script was denied by permissions) and re-running the specs (they mutate state). Relied on QA round 4 for logged-in behaviour.

## Per-AC status
All of AC-1 … AC-29 and AC-24a: **Met** (evidence per AC in the PM report; summarized from QA spec/MCP results, screenshots `test-results/mcp/r4-AC-23.png`, `r4-AC-25.png`, and code inspection).

## Gaps vs PRD goals
None blocking. All four success metrics demonstrated (user blocked by own quota while others continue; everyone blocked at system quota; cost = LiteLLM to 6 dp; new model by config only). Nothing out-of-scope was built. Extra scope (UX agent, v3 visual refresh, theme switch, Markdown rendering) was user-decided.

**Risk (not a gap):** the quota check runs outside the ledger transaction, so two simultaneous messages can both pass; AC-17 already permits overshoot.

## Follow-ups (not blockers)
1. Test-data cleanup: ~624 `qa-*`/`r4*` users in the app DB; QA should use the disposable DB or delete afterwards.
2. [ux-usage-stale] Usage tab shows old override/Used % until reload after an edit.
3. [ux-dialog-validation] user dialogs mark invalid fields by colour only (no error text).
4. Layout leftovers: [ui-quota-meter] chip placement / reset-line overflow at 768–1440; [ui-login] tablet band height; [ui-responsive-admin] Users table scrolls sideways at 768.
5. ~~[chat-route-reuse-untested]~~ — already addressed after review-9 (`frontend/src/app/features/chat/chat.page.spec.ts`; orchestrator note).
6. Optional: advisory lock around the quota check to prevent concurrent overspend.
7. Navigating while a reply streams: URL changes but the conversation doesn't open (pre-existing, noted in review-9).
8. Decide D-2 (Settings Save disabled vs enabled on invalid input) and record it in `docs/ux/ui-design.md`.
9. Restore demo quotas (currently test values $0.50 system / $0.10 user).
10. Install the pinned Playwright Chromium so `npx playwright test tests/acceptance` works without `tests/playwright.qa.config.ts`.
