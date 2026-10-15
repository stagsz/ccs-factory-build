# Approval: Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Branch: factory/j-20261015-002-use-object-hasown-for-unknown-command-ch
- Rework cycles: 0

## What changed
In `scripts/board.mjs`, line 163 of the board CLI dispatch changed from `if (!commands[cmd])` to `if (!Object.hasOwn(commands, cmd))`. Names inherited from `Object.prototype` (`toString`, `constructor`, `hasOwnProperty`, `__proto__`, `valueOf`) now print the "Unknown command" message and usage and exit 2, like any other unknown name. Before, they exited 0 silently, or exited 1 for `__proto__`. One new test in `tests/cli.test.mjs` covers all five names and checks that nothing is written to disk.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- All four reviewers passed in round 1, with no findings.
- The diff matches the spec exactly: 2 files, +19/-1. That is one changed line in `scripts/board.mjs` and one added test, and no existing test was modified.
- `npm test` passes 29/29, as checked by the orchestrator and the code reviewer. The builder confirmed the new test fails against the old check.
- No path in `alwaysEscalatePaths` was touched. There are no dependency, CI, auth, migration or factory config changes. The file count of 2 is well under the limit of 15.
- Behaviour for real commands is unchanged, because every real command is an own property of `commands`. Only inherited names change, and only from "run or crash" to "rejected". If something went wrong, `npm test` and any orchestrator board call would show it at once, and reverting one commit undoes it.

RISK: low
DECISION: merge
