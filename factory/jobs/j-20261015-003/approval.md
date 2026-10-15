# Approval: Add a list command to the board CLI

- Job: j-20261015-003
- Branch: factory/j-20261015-003-add-a-list-command-to-the-board-cli
- Rework cycles: 0

## What changed
This adds a read-only `node scripts/board.mjs list` command. It prints every job as one aligned row (id, stage, rework, title), oldest first, and prints `No jobs.` when the board is empty. The formatting is a new pure function, `formatJobList(board)`, in `scripts/lib/board.mjs`. The CLI command is a 3-line wrapper over `loadBoard`, and there is one new USAGE line. Four files changed (+79/-1), and the only removed line is the `allCommands` test array, which was extended.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- All four reviewers passed in round 1. There was no rework.
- The diff matches the spec and nothing else. It touches only the 4 files the spec names. It does not change the board shape, `STAGES`/`TRANSITIONS`, the dashboard, SKILL.md, `factory/config.json`, `package.json` or any other `alwaysEscalatePaths` entry. It is 4 files, well under `maxFilesForLowRisk` (15).
- `npm test` passes 34/34. Unit tests check the exact aligned output, stable sorting by `createdAt` and that the input is not mutated. CLI tests check that `list` creates no `board.json` when it is missing and leaves the bytes of an existing `board.json` unchanged.
- The change only adds code. It does not alter any existing command or output contract, and nothing calls `list` yet. If it were wrong, the only effect would be bad `list` output, which is easy to spot and easy to revert.
- Follow-up, not blocking: titles are printed as stored, as the spec chose. A title containing a newline or terminal control characters could distort the table. Exposure is low because titles come from the operator or backlog. A future job could strip control characters in `formatJobList` or reject them in `createJob`.

RISK: low
DECISION: merge
