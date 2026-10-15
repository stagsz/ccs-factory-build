# Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Branch: factory/j-20261015-012-run-several-jobs-in-parallel-with-git-wo
- Source: cli
- Created: 2026-10-15T20:37:22.792Z

## Request

Let the factory run several jobs at once (README roadmap item 'Git worktrees so several jobs run in parallel, one worktree per job'). Today SKILL.md says 'One job at a time in this version' and the loop does git switch in the single checkout, so a second job would trample the first. Design and implement one git worktree per job.

Things the design must settle (spec-writer: decide each, say why, and keep it as small as works):
1. Where worktrees live: a configurable dir (new config key, e.g. parallel.worktreeDir), default outside or gitignored inside the repo; mind Windows path-length limits and node:path. The main checkout stays on the main branch at all times; no more git switch in it.
2. Single source of truth: factory/board.json and factory/jobs/<id>/ stay in the main checkout; the orchestrator is still the only board writer and runs every board.mjs command against the main checkout (FACTORY_ROOT or cwd). Agents in a worktree must be given absolute paths to the job folder in the main checkout and to their worktree; builders commit in their worktree on the job branch.
3. Lifecycle: create the worktree at the build stage (git worktree add -b <branch> <path> <mainBranch>), run the test command inside the worktree, remove it (git worktree remove, no --force) when the job ends merged or failed; keep it while needs-human so approve/rework still work. Rework and approve must work for a parked job without switching the main checkout.
4. Concurrency: a cap (e.g. parallel.maxJobs, default 1 so behaviour is unchanged until the user raises it). How the user starts several jobs (e.g. '/factory next <n>' and/or several features), and how the orchestrator interleaves agent spawns for different jobs.
5. Merging stays serialized: one merge into main at a time, tests on main after each merge, the existing reset --keep ORIG_HEAD rollback. A branch that no longer merges cleanly because another job merged first: merge --abort and park needs-human (or merge main into the branch and re-test; pick one and justify).
6. Records: step 7 must still commit a finished job's records on main while other jobs are in flight (their uncommitted factory/jobs/<other-id>/ folders and board.json changes are present). Decide what gets committed and make the pre-flight clean-tree check tolerate in-flight factory records only.
7. board.mjs: any new state (e.g. worktree path per job) goes through scripts/lib/board.mjs pure functions with unit tests; CLI commands for worktree bookkeeping if useful (e.g. a command that prints a job's worktree path, or lists active jobs vs the cap). validate must accept the new fields. Keep existing stage names/transitions unless there is a strong reason (if changed, update dashboard and tests together per CLAUDE.md).
8. Docs: update SKILL.md (claude-setup/ source only, not .claude/), the 'one job at a time' rule, README roadmap/usage, and agent prompts in claude-setup/agents/ only if they need to know about worktrees.

Constraints: Node 22+, ES modules, zero runtime dependencies, Windows and Linux paths, npm test must pass, never force-push or git worktree remove --force.
