# Guard dashboard stages against drift

- Job: j-20261015-010
- Branch: factory/j-20261015-010-guard-dashboard-stages-against-drift
- Source: backlog
- Created: 2026-10-15T19:54:44.205Z

## Request

dashboard/index.html hard-codes its own `STAGES` array, which must match `STAGES` in scripts/lib/board.mjs (CLAUDE.md requires changing both together). Add a test in tests/ that reads dashboard/index.html, extracts the `STAGES` array literal and asserts it equals the exported `STAGES` in the same order. Do not restructure the dashboard; the test is the deliverable.
