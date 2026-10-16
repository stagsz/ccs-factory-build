# Approval: Show the slot count on the dashboard

- Job: j-20261016-002
- Branch: factory/j-20261016-002-show-the-slot-count-on-the-dashboard
- Rework cycles: 0

## What changed
The dashboard header now ends with an "Active n/max" count. n is the number of jobs in the stages that hold a slot (`ACTIVE_STAGES`). max is `config.parallel.maxJobs`, or 1 if that value is missing or invalid. A new test fails if the dashboard's list of active stages stops matching the `ACTIVE_STAGES` export in `scripts/lib/board.mjs`. The old `extractStages` test helper became `extractArray(html, name)` and the existing STAGES tests still pass unchanged. Only `dashboard/index.html` (+5/-1) and `tests/dashboard.test.mjs` changed.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- All four reviewers passed in round 1. The only findings are optional notes, and the spec already accepts them:
  - On phones about 360px wide the header may overflow by a few pixels.
  - If config.json fails to load, the count reads as "n/1".
  - Some existing, unrelated `innerHTML` values are not escaped.
- The diff matches the spec exactly:
  - The markup is the one the spec gives, with no new CSS.
  - max uses the `maxJobs()` rule but falls back to 1 instead of throwing.
  - The stage list is the same as board.mjs line 324.
  - Nothing outside the two allowed files changed.
- The values written into the page are always numbers, so nothing from the data files reaches the HTML (security review confirmed this).
- I ran `npm test` in the worktree: 127 pass, 0 fail. The new tests include the drift guard, a test that removes a stage and checks the guard catches it, and a check that the page uses `ACTIVE_STAGES.includes(`.
- No file matches the always-escalate paths. Auth, payments, migrations, CI, dependencies and factory config are untouched. 2 files changed, well under the 15-file limit.
- It is a read-only display change in a local viewer. A bad merge would be obvious in the header and easy to revert with one commit.

RISK: low
DECISION: merge
