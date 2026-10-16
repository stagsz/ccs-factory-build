# Build report: Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Branch: factory/j-20261016-001-split-the-step-5-local-merge-bullet-into
- Last commit: 71e1746

## Files changed
- `claude-setup/skills/factory/SKILL.md`: line 94 (the single-paragraph `local` bullet) is replaced by the 8-line nested structure from the spec's "Target structure" block. The block was copied programmatically from spec.md, so the text matches it byte for byte. LF line endings are kept. No other line changed (`git diff -U0` shows a single hunk `@@ -94 +94,8 @@`).
- `tests/skill.test.mjs`: the pin `In either branch never go on to the tests or \`merged\`. If \`git merge --abort\` fails` is replaced with the three assertions the spec names:
  - `In either branch never go on to the tests or \`merged\`.` is still present.
  - In the step 5 slice, the phrases appear in this order: MERGE_HEAD-set branch start < abort-failure rule < `conflict or rejected merge: <git line>` < `If it fails, nothing started`.
  - The `    - \`local\`:` line does not contain `MERGE_HEAD`.

## Acceptance criteria
- [x] Only line 94 changes, and it becomes the target structure: it was replaced with the spec block verbatim. Lines 95-96 (`pr` bullet, `Then ... stage <id> merged`) and all other sections are untouched (one diff hunk).
- [x] The `    - \`local\`:` line holds no rule text and contains neither `git rev-parse` nor `MERGE_HEAD`. The new test asserts the `MERGE_HEAD` part.
- [x] The abort-failure rule sits in the MERGE_HEAD-set sub-bullet. It comes after `run \`git merge --abort\`.` and before `Otherwise \`stage <id> needs-human --note "conflict or rejected merge: <git line>"\`, run step 7`. The new test asserts the order.
- [x] All existing rules are kept with the same meaning: the merge command, the three causes, "do not judge by git's message", both MERGE_HEAD branches with their notes, "never go on to the tests or `merged`" (now in the parent bullet so it covers both branches), "do not resolve conflicts yourself", the full `<git line>` definition with both cleaning clauses and the fallback, tests on main, `reset --keep ORIG_HEAD` with the `--hard` reason, stop on a `reset --keep` error and never retry with `--hard`, and the "tests failed on main after merge" park.
- [x] No new rule, step or command. The only wording changes are structural:
  - "Run" added before the merge command.
  - ", then `stage`" became ". ... Otherwise `stage`" around the moved abort-failure sentence.
  - "Otherwise" was already in the tests-failed branch.
- [x] The step 5 positive pins still match. All 122 tests pass, including the unchanged pins in "SKILL.md decides every failed git merge by MERGE_HEAD" and "records each job on main".
- [x] None of the negative pins appear. `grep -cF` returns 0 for each of: `reset --hard`, `In both cases never go on to the tests`, `If the merge reports conflicts`, `conflicts with <mainBranch>`, `merge refused: <git message>`, `refused without starting`, `git switch`, `worktree remove --force`.
- [x] `npm test` passes.

## Tests
- Command: `npm test` (in the worktree)
- Result: passed, 122 tests, 0 failures
- Added or changed: `tests/skill.test.mjs`

## Notes
- `.claude/skills/factory/SKILL.md` was not edited and `npm run setup` was not run, as the spec requires. The loaded copy keeps the old wording until someone runs `npm run setup -- --force`.
- Pre-existing failures: none.
