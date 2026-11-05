VERDICT: APPROVE
SCORE: 100/100 | Spec 25/25 · Correctness 25/25 · Tests 20/20 · Security 15/15 · CLAUDE.md 15/15
BLOCKERS: 0  MAJORS: 0  MINORS: 0

| Area | Max | Score | Deductions |
|---|---|---|---|
| Spec adherence | 25 | 25 | none |
| Correctness | 25 | 25 | none |
| Tests | 20 | 20 | none |
| Security | 15 | 15 | none |
| CLAUDE.md rules | 15 | 15 | none |
| **Total** | 100 | **100** | |

Review round 6, a short focused review of the three review-5 minors. Only five files are newer than review-5.md:
- `frontend/src/app/core/markdown.ts` and `markdown.spec.ts`
- `frontend/src/app/features/admin/user-dialog.component.ts` and `user-dialog.component.spec.ts`
- `frontend/src/app/features/admin/usage-tab.component.ts`

Nothing in `backend/`, `tests/` or the rest of `frontend/src` changed. I did not read `.env` or `test-results/ux/credentials.local.json`, and I did not run the acceptance suite.

## Test and lint run
- **`npm run lint` exits 0.** ESLint reports 0 errors, and backend `tsc --noEmit` (app and migrations) is clean. The same 3 "unused eslint-disable" warnings still come from the generated `backend/coverage/lcov-report/*.js` files. Not scored.
- **`npm test` exits 0 on the first run.**
  - Backend: 12 of 12 suites and 118 of 118 tests passed, with perf `quota.check p95 = 5.1 ms`. The test-DB contention from review 5 did not happen again, so I am not opening `test-db-concurrent-use`.
  - Frontend Karma: 90 of 90 passed. That is 2 more than before: the `background` case and the pending-save case.

## [md-remote-images]: fixed
- `FORBID_ATTR` (`markdown.ts:32`) is now `style, src, srcset, poster, background, ping, action, formaction, longdesc, manifest, lowsrc, dynsrc`. `FORBID_TAGS` and the `afterSanitizeAttributes` link hook have not changed.
- The new `markdown.spec.ts` test "strips background on table/td/th" checks three things: `<td` is still rendered, and the output contains no `background` and no `attacker.example`.
- **Headless Chrome check.** I used real Chrome (`channel: 'chrome'`) and DOMPurify 3.4.17 from `node_modules`, with the exact config from `markdown.ts`. I sanitised 37 vectors, put the result into the page with `innerHTML`, and routed every `https://attacker.example/**` request to a counter.
  - The vectors covered:
    - `background` on table, td, th, div and body
    - `ping`
    - img with `src`, `srcset`, `lowsrc` and `dynsrc`
    - `input type=image`, `video poster`, audio, track, `picture`/`source`
    - object `data` and `codebase`, embed, iframe, frame/frameset, applet, bgsound, portal
    - `link`, `style @import`, inline `style` url()
    - SVG `image` and `use`, MathML `xlink:href`
    - `base href`, `meta refresh`, html `manifest`
    - form `action` and `formaction`, script `src`, blockquote `cite`, `a download`, `a`/`area rel=prefetch`
  - **Result: 0 requests were fetched.** The only attacker URLs left in the output are in attributes that never load anything:
    - `href` on `a` and `area`, which needs a click;
    - `cite`, which browsers never fetch;
    - `rel=prefetch` on `a` or `area`, which Chrome does not act on outside `<link>`. In the app, the hook also overwrites `rel` on `a` with `noopener noreferrer`.
  - I found no other URL-loading attribute that the config still allows.

## [dialog-cancel-during-save]: fixed
- In `submit()` (`user-dialog.component.ts:115-134`), `this.ref.disableClose = true` is set together with `busy(true)` before the save callback is awaited. It is set back to `false` in `finally`, so the reset runs on success, on `false` and on error.
- Cancel is now `[disabled]="busy()"` (`:82`), and Save was already disabled while busy, so Esc, the backdrop and Cancel are all blocked while the request is in flight.
- Setting it back to `false` instead of the previous value is correct here. Both callers (`users-tab.component.ts:185,215`) open the dialog with the default `disableClose: false`.
- The new spec test "blocks Cancel, Esc and backdrop while a save is pending, then restores them" covers this:
  - it holds the save promise open;
  - while the save is pending, it asserts `ref.disableClose === true` and that the Cancel button is disabled;
  - after resolving the save, it asserts `disableClose === false`.
- The existing tests for close-on-success, 409 inline, other errors inline and `false` keeps the dialog open still pass.

## [usage-page-sizes]: fixed
- `USAGE_PAGE_SIZES = [25, 50, 100]` (`usage-tab.component.ts:31`), with the default `pageSize = signal(25)` (`:277`). This matches ui-design §7.1. The paging and sorting tests in `admin-logic.spec.ts` still pass.

## Regression check
- No backend files changed. The Path A gateway, the quota transaction and the money handling are as they were at review 5.
- No other frontend files changed. Lint, typecheck and both test suites are green.

## Issues
None.

## Resolved since last review
- `md-remote-images`
- `dialog-cancel-during-save`
- `usage-page-sizes`
- No older key has recurred.

## Open items carried from the spec (unchanged, not scored)
- Provisional Q3 to Q6 in spec §9 still need the user to confirm them.
- D-2 (whether Settings Save is enabled or disabled on invalid input) is still for the user to decide.
- The initial bundle is about 507 kB against the 500 kB warning budget. This is advisory only, as in earlier reviews.
