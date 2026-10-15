# Spec: Commit factory records after each job

- Job: j-20261015-005
- Branch: factory/j-20261015-005-commit-factory-records-after-each-job

## Goal
When a job reaches an end state (merged, needs-human or failed), the orchestrator commits that job's factory records on main as "factory: record <id>". The tree is then clean and the next `/factory` run passes the clean-tree check.

## Context
- `claude-setup/skills/factory/SKILL.md` is the orchestrator skill source. Its end states are:
  - step 3: build `failed`, while on the job branch
  - step 4: `needs-human`, on the job branch
  - step 5 `local` mode: merged, on main
  - step 5 `pr` mode: PR opened, still on the job branch
  - step 5: `needs-human` from `decide-merge`, on the job branch
  - step 5 rollback: `needs-human` after `git reset --hard ORIG_HEAD`, on main
  - `/factory approve <id>`: merged
- "Before the first job" step 4 aborts on a dirty tree. Nothing commits `factory/board.json`, `factory/backlog.md` or `factory/jobs/<id>/` today. Job 004's records were committed by hand.
- `board.mjs new`/`next` changes board.json and backlog.md on main and creates `jobs/<id>/` before the job branch is cut. Those changes are carried uncommitted onto the branch.
- Bug on the rollback path: `git reset --hard ORIG_HEAD` throws away the uncommitted board.json and backlog.md edits. Then `stage <id> needs-human` runs against a stale board.
- `claude-setup/agents/builder.md` line 16 forbids touching `factory/board.json`. It does not cover `factory/backlog.md`, other jobs' folders, or committing files under `factory/`. The other agents may each write only one output file, and their Bash is read-only, so they need no change.
- No test reads SKILL.md content. `tests/setup.test.mjs` only checks that SKILL.md gets copied.

## Acceptance criteria
- [ ] SKILL.md has a new step, "### 7. Record the job", that runs in this order:
  1. `node scripts/board.mjs validate`
  2. `git switch <mainBranch>` (skipped if already on main)
  3. `git add factory/board.json factory/backlog.md factory/jobs/<id>`
  4. `git commit -m "factory: record <id>"`, skipped when nothing is staged
- [ ] Step 7 says the record commit is not pushed.
- [ ] Every end-state path explicitly says to run step 7: step 3 `failed`; step 4 `needs-human`; step 5 `merged` in both `local` and `pr` mode; step 5 `needs-human`; the rollback path; and `/factory approve`. Step 6 (park) runs only after step 7.
- [ ] The rollback line uses `git reset --keep ORIG_HEAD` instead of `git reset --hard ORIG_HEAD`, so uncommitted factory records survive. The Rules line about the ORIG_HEAD rollback still matches.
- [ ] The Rules section says only the orchestrator commits `factory/board.json`, `factory/backlog.md` and `factory/jobs/`, and agents never stage or commit them.
- [ ] `builder.md` Output forbids:
  - touching `factory/board.json`, `factory/backlog.md` or any other job's folder
  - staging or committing anything under `factory/`, including its own `build.md`, which the orchestrator commits in step 7
- [ ] `npm test` passes, including the new tests below.

## Out of scope
- `.claude/` (generated; do not edit), `scripts/board.mjs`, `scripts/lib/board.mjs`, `factory/config.json`, board.json, backlog.md, the dashboard, and the other agent files.
- Auto-pushing main, and any change to stage names or transitions.

## Tests
- Add `tests/skill.test.mjs` (`node:test`, paths via `node:path`). It reads `claude-setup/skills/factory/SKILL.md` and `claude-setup/agents/builder.md` and asserts that:
  - SKILL.md contains `factory: record <id>`, the `git add factory/board.json factory/backlog.md factory/jobs/<id>` command and `reset --keep ORIG_HEAD`
  - SKILL.md does not contain `reset --hard`
  - builder.md mentions `factory/backlog.md`
- No changes to existing tests. The setup test's count of 8 copied files is unchanged.

## Risks
- This changes the orchestrator's git behaviour on main: it adds an extra commit per job and changes the rollback command. Wrong wording could lose job records or leave the tree dirty.
- In `pr` mode, local main moves ahead of origin with record commits. This is acceptable because nothing pushes them.

## Assumptions
- "After parking" means before step 6's message to the user, so the stop leaves a clean tree.
- `/factory rework` on a parked job does not record at that point. The job records again, with the same message, when it next reaches an end state.
- The builder never commits `build.md`. If it did, switching back to main on a needs-human or failed job would delete `build.md` from the working tree before step 7.
- A content test of SKILL.md is acceptable, even though business logic tests normally target `scripts/lib/board.mjs`, because this change is docs only.
