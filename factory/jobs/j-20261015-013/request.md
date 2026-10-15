# Decide merge failures by MERGE_HEAD, not git's message

- Job: j-20261015-013
- Branch: factory/j-20261015-013-decide-merge-failures-by-merge-head-not
- Source: backlog
- Created: 2026-10-15T21:25:48.678Z

## Request

SKILL.md step 5 (`local` merge) tells a conflict from a refused merge by reading git's output. A merge a git hook rejects can fail after it started, leave MERGE_HEAD set, and then step 7's record commit would finish an untested merge. Change claude-setup/skills/factory/SKILL.md so that whenever `git merge` exits non-zero, the orchestrator runs `git rev-parse -q --verify MERGE_HEAD`: if it succeeds, run `git merge --abort` and park needs-human (conflict or rejected merge); if it fails, nothing started, so park needs-human as "merge refused". Never go on to tests or `merged` in either case. Apply the same rule to `/factory approve` (leave the stage as is) and to `/factory rework` (`git -C "<worktree>" rev-parse -q --verify MERGE_HEAD`, then `git -C "<worktree>" merge --abort`). Also: the `--note` must carry only git's first `error:`/`CONFLICT` line with double quotes, `$` and backticks removed. Pin the new wording in tests/skill.test.mjs. Do not edit .claude/.
