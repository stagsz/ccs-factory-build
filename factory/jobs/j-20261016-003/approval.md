# Approval: Friendly preflight error outside a git repo

- Job: j-20261016-003
- Branch: factory/j-20261016-003-friendly-preflight-error-outside-a-git-r
- Rework cycles: 0

## What changed
`node scripts/board.mjs preflight` now prints `error: preflight needs a git repository at <root>` and exits 1 when the factory root is not in a git repository. Before, it printed git's raw "Command failed ... fatal: not a git repository" text. The new message appears only when `git status` exits 128 and a probe (`git rev-parse --git-dir`, run with `LC_ALL=C`) also reports "not a git repository". Every other git failure rethrows the original error unchanged. Two CLI tests were added: one for the not-a-repo message (via cwd and via FACTORY_ROOT) and one confirming that cwd inside `.git` still shows git's own error.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- All four reviewers passed in round 1. No reviewer raised anything above a note.
- The diff matches the spec's chosen detection method exactly. Only `scripts/board.mjs` and `tests/cli.test.mjs` changed (+66/-5). That is within the request's scope, and no file matches `alwaysEscalatePaths`. Nothing touches auth, payments, migrations, CI, dependencies or factory config.
- The change stays fail-closed. Every path through the new catch throws, so preflight still exits 1 in every failure case. Only the stderr text changes, and the orchestrator does not parse that text. The success path is unchanged and adds no extra spawn.
- Tests cover the new behaviour and the "other git failure" case. I re-ran `npm test` in the worktree: 124/124 pass.
- Residual caveat: the tests have only been run on Windows. The test relies on `GIT_CEILING_DIRECTORIES` and realpathed temp dirs, which should behave the same on Linux. If it does not, the result would be a failing test, not a production bug.
- A bad merge would be easy to spot (a single CLI error line) and easy to revert (one commit, two files).

RISK: low
DECISION: merge
