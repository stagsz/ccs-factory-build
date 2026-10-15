# Approval: Add a history command to the board CLI

- Job: j-20261015-008
- Branch: factory/j-20261015-008-add-a-history-command-to-the-board-cli
- Rework cycles: 0

## What changed
Adds a read-only `node scripts/board.mjs history <id>` command. It prints the job's id, title and branch, then an aligned `AT  STAGE  NOTE` table of its history, oldest first. The formatting is a new pure function, `formatJobHistory(job)`, in `scripts/lib/board.mjs`, placed next to `formatJobList`. The CLI gains a `USAGE` line and a guard that rejects a missing id. Unknown ids go through the existing `No job with id <id>.` error path and exit 1.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- Small scope: 4 files and 104 added lines, all in `scripts/` and `tests/`. The diff matches the spec and changes nothing else.
- No changes to auth, payments, migrations, CI, dependencies, `package.json`, `.claude/`, `claude-setup/` or `factory/config.json`. None of the `alwaysEscalatePaths` match.
- The command is read-only. It never calls `saveBoard`, and a CLI test checks that `board.json` is byte-identical afterwards. Existing commands, stages and transitions are unchanged.
- Tests cover the new behaviour: the exact output string, column padding, no trailing whitespace, stable sorting, no mutation of the input, empty or missing history, the read-only happy path, an unknown id and a missing id. I re-ran `npm test`: 54 pass, 0 fail, 0 skipped.
- A bad merge would be easy to spot and easy to revert. The change only adds code, so reverting the single commit 18a92a5 removes it cleanly.

RISK: low
DECISION: merge
