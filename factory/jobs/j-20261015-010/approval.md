# Approval: Guard dashboard stages against drift

- Job: j-20261015-010
- Branch: factory/j-20261015-010-guard-dashboard-stages-against-drift
- Rework cycles: 0

## What changed
Adds `tests/dashboard.test.mjs`, which reads the `STAGES` array from `dashboard/index.html` with a strict regex extractor and asserts it equals the `STAGES` export of `scripts/lib/board.mjs`, in the same order. The two arrays had already drifted (`merged` and `needs-human` were swapped), so `board.mjs` swaps those two entries to match the dashboard's column order. The test never runs page code, and the dashboard itself is not touched.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- The diff is exactly what the spec asks for: 2 files (`scripts/lib/board.mjs`, 1 line moved, comments kept; `tests/dashboard.test.mjs`, new), and nothing else.
- No path matches `alwaysEscalatePaths`. No auth, payments, migrations, CI, dependencies or factory config change.
- The `board.mjs` edit touches the core, but only changes order. `STAGES` order affects nothing except the name order in the `Unknown stage` error text (line 140). Line 305 checks membership only, and `TRANSITIONS`/`TERMINAL` are keyed by name. No other code under `scripts/`, `dashboard/` or `claude-setup/` reads `STAGES`.
- Tests: 72/72 pass (7 new). They cover the real-file equality plus negative cases (reorder, removal, missing, duplicate, non-literal contents) and CRLF, multi-line and single-quote input. The builder confirmed that the equality test fails without the swap.
- Easy to revert: one commit (43a3ca3) with a test file and a one-line reorder.

RISK: low
DECISION: merge
