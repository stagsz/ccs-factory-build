# Approval: Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Branch: factory/j-20261015-012-run-several-jobs-in-parallel-with-git-wo
- Rework cycles: 1

## What changed
Every job now runs in its own git worktree (`.worktrees/<id>`, gitignored), so the main checkout stays on main and `git switch` is gone from SKILL.md. New `parallel.maxJobs` (default 1) and `parallel.worktreeDir` config keys. Three new CLI commands (`worktree`, `slots`, `preflight`) backed by pure, tested functions in `scripts/lib/board.mjs`. Merges stay serial; a conflicting merge is aborted and parked. The builder, four reviewers and approver prompts now take an absolute job folder and worktree path. README updated. Stages, transitions, board shape, dashboard and `.claude/` are untouched.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass (round 1 changes, fixed in rework 1)
- ui-design-reviewer: pass
- code-reviewer: pass

`npm test`: 121/121 pass on the branch (orchestrator run). The diff matches the spec. The build added a few small extras, and build.md lists them all (for example `parseGitStatusZ`).

## Why this risk rating
The work looks sound, but the risk is high by rule and by impact:
- The diff touches `claude-setup/**` (SKILL.md and six agent files) and `factory/config.json`. Both are in `risk.alwaysEscalatePaths`. It changes 15 files, which is exactly the limit.
- It rewrites the orchestrator's git flow for every future job, even at `maxJobs: 1`. The new flow has not run end to end yet: this job used the old single-checkout flow. The CLI tests use temp repos, but nothing tests the SKILL.md loop itself. A mistake here could strand branches or worktrees, or leave records uncommitted. That is easy to revert, but you might not spot it until the next job runs.

Before merging, check these:
- In SKILL.md, read step 3 (create the worktree), step 5 (merge, abort on conflict, `reset --keep` rollback), step 7 (commit records, then `git worktree remove` without `--force`) and the `approve`/`rework` commands.
- Confirm that `preflight`, which tolerates only in-flight `factory/` records, is strict enough for you.
- After merging, run `npm run setup -- --force` so `.claude/` picks up the new skill and agents. Then run one small job at `maxJobs: 1` before you raise the cap.

Follow-ups the reviewers raised (none blocking):
- security: step 5 picks "conflict" vs "refused" by git's message. A merge that a `pre-merge-commit` or `commit-msg` hook rejects leaves `MERGE_HEAD` set, and step 7's commit could then finish an untested merge. Suggested fix: check `git rev-parse -q --verify MERGE_HEAD` and abort if it is set.
- security: `--note "merge refused: <git message>"` puts raw git output inside a double-quoted shell argument. Suggested fix: use only git's first `error:` line, with quotes, `$` and backticks stripped.
- security (from round 1): validate the id format in `worktreePath`, list `factory/jobs/<id>/` before `git add` in step 7, and scrub the env in the `runAt` test helper.
- code: the skill test does not pin the refused-merge sentence in `/factory approve`, or the quoting rule in the six agent files.
- ux: `preflight` outside a git repo prints raw git output. The nested alternatives in the "Started k of n" template, and the long conflict line 3, could be clearer.
- Spec follow-ups, flagged and not built: (a) `parallel.setupCommand` for worktree deps, (b) dashboard worktree/slots badge, (c) non-lockstep scheduling, (d) deleting merged branches, (e) builder-resolved rework conflicts. Resuming jobs left active by an earlier session is also not supported yet.

RISK: high
DECISION: escalate
