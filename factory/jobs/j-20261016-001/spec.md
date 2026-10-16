# Spec: Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Branch: factory/j-20261016-001-split-the-step-5-local-merge-bullet-into

## Goal
Restructure the step 5 `local` merge bullet in the factory skill into nested sub-bullets so each merge rule sits under the outcome it applies to. The rules and what they mean stay the same.

## Context
- `claude-setup/skills/factory/SKILL.md`, section `### 5. Approve`, line 94: the bullet `    - \`local\`: ...` (4-space indent, under `  - \`merged\``) is one paragraph. It holds the merge command, the MERGE_HEAD rule for a non-zero exit (two branches), the abort-failure rule, the `<git line>` definition, and the exit-0 test plus `reset --keep ORIG_HEAD` rollback. Right now the abort-failure rule ("If `git merge --abort` fails, stop and tell the user: do not run step 7 ...") comes *after* the MERGE_HEAD-set branch has already said "run step 7, then step 6".
- The `pr` bullet (line 95) and the `    Then \`node scripts/board.mjs stage <id> merged ...` line (line 96) follow it and stay unchanged.
- `/factory approve` (line 138) and `/factory rework` (line 140) point to step 5 ("step 5's `MERGE_HEAD` check", "`<git line>` (as defined in step 5)"), so the check and the definition must stay in step 5.
- `tests/skill.test.mjs` pins SKILL.md phrases with `includes`. It checks case and exact wording.

## Target structure (replace line 94 only)
Use 2-space nesting like the rest of the file: sub-bullets at 6 spaces, sub-sub-bullets at 8. Keep the existing sentences word for word except where a sentence has to be split or moved.
```
    - `local`:
      - Run `git merge --no-ff <branch> -m "factory: <title> (<id>)"`.
      - One rule applies whenever `git merge` exits non-zero (a conflict because another job merged first, a hook that rejected the merge, or a refusal such as "would overwrite local changes"): do not judge by git's message, run `git rev-parse -q --verify MERGE_HEAD`. In either branch never go on to the tests or `merged`.
        - If it succeeds, a merge started: run `git merge --abort`. If `git merge --abort` fails, stop and tell the user: do not run step 7, because its commit would finish the untested merge. Otherwise `stage <id> needs-human --note "conflict or rejected merge: <git line>"`, run step 7, then step 6; do not resolve conflicts yourself.
        - If it fails, nothing started and there is nothing to abort: `stage <id> needs-human --note "merge refused: <git line>"`, run step 7, then step 6.
      - `<git line>` is the first line of git's output that starts with `error:` or `CONFLICT`, with double quotes, `$` and backticks removed, and backslashes removed too (a trailing `\` would escape the closing quote of `--note "..."`); if git printed no such line, it is the first non-empty line of git's output, cleaned the same way.
      - If the merge exits 0, run the test command on main.
        - If it fails, `git merge --abort` is no longer possible, so `git reset --keep ORIG_HEAD` (it keeps the uncommitted factory records; `--hard` would throw them away). If `reset --keep` reports an error, stop and tell the user: do not run step 7, and never retry with `--hard`. Otherwise `stage <id> needs-human --note "tests failed on main after merge"`, run step 7, then step 6.
```

## Acceptance criteria
- [ ] Only line 94 of `claude-setup/skills/factory/SKILL.md` changes. It becomes the structure above. Lines 95-96 and every other section are byte-identical.
- [ ] The line `    - \`local\`:` contains no rule text. Neither `git rev-parse` nor `MERGE_HEAD` appears on it.
- [ ] The abort-failure rule sits in the MERGE_HEAD-set sub-bullet. It comes after `run \`git merge --abort\`` and before both `stage ... "conflict or rejected merge: <git line>"` and `run step 7`.
- [ ] All the existing rules are still there with the same meaning:
  - the merge command
  - the three example causes
  - "do not judge by git's message"
  - the two MERGE_HEAD branches with their notes
  - never go on to the tests or `merged`
  - do not resolve conflicts yourself
  - the full `<git line>` definition, including both cleaning clauses and the fallback
  - run the tests on main
  - `reset --keep ORIG_HEAD` and why `--hard` is not used
  - stop on a `reset --keep` error and never retry with `--hard`
  - the "tests failed on main after merge" park
- [ ] The diff adds no new rule, step or command.
- [ ] The step 5 pins in `tests/skill.test.mjs` still match. These all stay in place: `whenever \`git merge\` exits non-zero` (lowercase; step 5 is the only lowercase occurrence), `git rev-parse -q --verify MERGE_HEAD`, `git merge --abort`, `conflict or rejected merge: <git line>`, `merge refused: <git line>`, ``double quotes, `$` and backticks removed``, `and backslashes removed too`, `If \`git merge --abort\` fails, stop and tell the user`, `do not resolve conflicts yourself`, `reset --keep ORIG_HEAD`, `If \`reset --keep\` reports an error, stop and tell the user`, `never retry with \`--hard\``.
- [ ] None of the negative pins appear: `reset --hard`, `In both cases never go on to the tests`, `If the merge reports conflicts`, `conflicts with <mainBranch>`, `merge refused: <git message>`, `refused without starting`, `git switch`, `worktree remove --force`.
- [ ] `npm test` passes.

## Out of scope
- `.claude/`: do not edit it and do not run `npm run setup`.
- The `pr` bullet, the `Then ... stage <id> merged` line, `/factory approve`, `/factory rework` and step 6, even though they say similar things.
- `dashboard/`, `tests/dashboard.test.mjs` (job j-20261016-002), `scripts/board.mjs` and `tests/cli.test.mjs` (job j-20261016-003). Touch no files other than SKILL.md and `tests/skill.test.mjs`.

## Tests
`tests/skill.test.mjs`, test "SKILL.md decides every failed git merge by MERGE_HEAD, not by git's message":
- Only one pinned substring breaks. Line 98, `In either branch never go on to the tests or \`merged\`. If \`git merge --abort\` fails`, no longer matches because the abort rule moves. Replace it with:
  - `assert.ok(skill.includes("In either branch never go on to the tests or \`merged\`."))`
  - Take a step 5 slice from `### 5. Approve` to `### 6. Park for a human` and assert this order with `indexOf`: `If it succeeds, a merge started: run \`git merge --abort\`` < `If \`git merge --abort\` fails, stop and tell the user` < `conflict or rejected merge: <git line>` < `If it fails, nothing started`.
  - In that slice, assert that the line starting with `    - \`local\`:` does not include `MERGE_HEAD`.
- Leave every other assertion unchanged, including line 99 (rework section) and all negative pins.

## Risks
- The change touches the orchestrator's merge and rollback instructions, so a wording slip could change how failed merges are handled on main. Reviewers should check rule by rule against the old line 94.
- Until someone runs `npm run setup -- --force`, `.claude/skills/factory/SKILL.md` keeps the old wording. That is expected and outside this job.

## Assumptions
- "Before that branch runs step 7" means the abort-failure rule comes straight after `git merge --abort` and before the `stage <id> needs-human` command. "Stop" means nothing in that branch runs after a failed abort, which matches the original "run `git merge --abort`, then `stage` ..." order. The original sentence "do not run step 7, because its commit would finish the untested merge" stays word for word.
- "In either branch never go on to the tests or `merged`." goes in the non-zero-exit parent bullet, above both branches, so it still covers both. It is not repeated in each branch.
- The request does not ask for an explicit "tests pass" sub-bullet, so none is added. The following `Then ... stage <id> merged` line still covers that path.
