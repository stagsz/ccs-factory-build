# Build report: Commit factory records after each job

- Job: j-20261015-005
- Branch: factory/j-20261015-005-commit-factory-records-after-each-job
- Last commit: ca8a6ac

## Files changed
- `claude-setup/skills/factory/SKILL.md`: new step "### 7. Record the job"; every end-state path now runs step 7 (and step 6 only after it); rollback uses `git reset --keep ORIG_HEAD`; Rules updated; `/factory approve` records; `/factory rework` merges main into the job branch first (see Notes).
- `claude-setup/agents/builder.md`: Output item 1 now forbids touching `factory/board.json`, `factory/backlog.md` or any other job's folder, and forbids staging or committing anything under `factory/` (including its own `build.md`, which the orchestrator commits in step 7). It also says to stage by path, never `git add -A` / `git add .`.
- `tests/skill.test.mjs`: new content test for SKILL.md and builder.md.

## Acceptance criteria
- [x] SKILL.md step "### 7. Record the job" runs, in order: `node scripts/board.mjs validate` (stop without committing on errors), `git switch <mainBranch>` (skipped if already on main), `git add factory/board.json factory/backlog.md factory/jobs/<id>`, then `git commit -m "factory: record <id>"`, skipped when nothing is staged (`git diff --cached --quiet`).
- [x] Step 7 says: "Do not push the record commit. It stays on local main."
- [x] Every end state runs step 7:
  - Step 3 `failed`: "run step 7, then stop".
  - Step 4 `needs-human`, both the `decide-review` answer and the rework-budget overflow: "run step 7, then step 6".
  - Step 5 `merged`: "run step 7 (in both `local` and `pr` mode)".
  - Step 5 `needs-human`: "run step 7, then step 6".
  - Rollback: "run step 7, then step 6".
  - `/factory approve`: "and run step 7", with the rollback falling back to step 5's path.
  - Step 6 opens with "Run this only after step 7 has recorded the job."
- [x] The rollback line uses `git reset --keep ORIG_HEAD`. The Rules line now reads "except the `git reset --keep ORIG_HEAD` rollback in step 5". `reset --hard` no longer appears.
- [x] Rules: "Only you commit `factory/board.json`, `factory/backlog.md` and `factory/jobs/`, and only in step 7. Agents never stage or commit them."
- [x] builder.md Output forbids both items listed in the spec.
- [x] `npm test` passes (36/36), including the new tests.

## Tests
- Command: `npm test`
- Result: passed, 36 tests, 0 failed
- Added or changed: `tests/skill.test.mjs` (new; 2 tests). No existing test changed. The setup test still counts 8 copied files.
- Manual check in a scratch git repo:
  - After a `--no-ff` merge, `git reset --keep ORIG_HEAD` kept the uncommitted board.json and backlog.md edits and the untracked job folder.
  - Step 7 then left a clean tree.
  - The human-rework path (switch to branch, `git merge --no-edit main`, edit, then step 7 from the branch) kept `factory/jobs/<id>/` and ended with a clean tree.

## Notes
- **Change beyond the listed criteria: `/factory rework`.** Step 7 commits `factory/jobs/<id>/` and the newer board.json on main, and the job branch does not have that commit. The old flow ran `board.mjs rework` on main and then switched to the branch. That switch would either refuse, because board.json has local edits and differs between the two commits, or delete the tracked `factory/jobs/<id>/` from the working tree. The builder would then lose `build.md` and the reviews it has to read.

  The rework command now switches to the job branch, runs `git merge --no-edit <mainBranch>` and only then runs `board.mjs rework`. Reviewer diffs use `main...branch` (merge-base), so the merged-in factory files do not show in later reviews. If reviewers prefer, this can be reverted and logged as a follow-up job instead.
- The rollback text mentions `--hard` only as "`--hard` would throw them away". It does not contain the string `reset --hard`.
- The step 7 validate rule stops without committing on errors. The spec does not say what happens on a validate failure, and committing a board that fails validation seemed worse than leaving the tree dirty for a human to fix.
- Per the orchestrator's instruction, this build.md is not committed. The orchestrator commits it in step 7.
- No pre-existing test failures.

## Rework 1
- Last commit: 2c1d9e1
- Addressed: ux-reviewer: validate failure in step 7 is a dead end -> step 7 item 1 now reports the errors, says the records are uncommitted, skips the rest of step 7 and continues the path (step 6 for `needs-human`). Step 6 now runs "after step 7, even if step 7 stopped early" and then says the records are uncommitted.
- Addressed: ux-reviewer: no recovery if `git switch <mainBranch>` fails -> "If the switch fails, stop and tell the user (with the step 6 message for a `needs-human` job); do not use `git stash` or `--force`."
- Addressed: ux-reviewer (note, optional): human not told they are on main -> the step 6 message now says the repo is left on `<mainBranch>` and names `<branch>`.
- Addressed: security-reviewer: `reset --keep ORIG_HEAD` can abort, and step 7 would then record on top of a failing merge -> step 5 and `/factory approve` now say "If `reset --keep` reports an error, stop and tell the user: do not run step 7, and never retry with `--hard`."
- Addressed: security-reviewer: a rework `git merge --no-edit <mainBranch>` can conflict -> "If the merge reports conflicts, run `git merge --abort`, switch back to `<mainBranch>` and tell the user; do not resolve conflicts yourself." This happens before `board.mjs rework`, so the board is unchanged and the tree is clean.
- Addressed: security-reviewer (note): "not pushed" is untrue in `pr` mode -> now reads "Never push main yourself; the record commit stays on local main." It then explains that in `pr` mode, earlier record commits (and this job's own, after a human rework) reach origin through a later job branch and its PR.
- Addressed: code-reviewer: `/factory approve` rollback would run `stage needs-human` from `needs-human`, which the board rejects -> approve now says to run `reset --keep ORIG_HEAD` (with the same stop-on-error rule), leave the stage as is (do not run `stage`), then run step 7 and step 6.
- Addressed: code-reviewer (note, optional): tests cover more -> `tests/skill.test.mjs` has a new test asserting the reset-error stop, the "never retry with `--hard`" rule, the switch-failure stop, `git merge --abort`, "do not resolve conflicts yourself", and the approve "leave the stage as is" rule. The builder test now also asserts "Never stage or commit anything under `factory/`".
- Not addressed: none.
- Tests: `npm test` passed, 37 tests, 0 failed.
