# Build report: Decide merge failures by MERGE_HEAD, not git's message

- Job: j-20261015-013
- Branch: factory/j-20261015-013-decide-merge-failures-by-merge-head-not
- Last commit: 90970df7c6eb4756fffa6dc4e4d3b2d0990f53cb

## Files changed
- `claude-setup/skills/factory/SKILL.md`: step 5 `local`, step 6 line 3 trigger, `/factory approve` and `/factory rework` now decide merge failures by `MERGE_HEAD` instead of git's message. `<git line>` is defined in step 5. The abort-failure stop is added at all three sites.
- `tests/skill.test.mjs`: removed the `exits non-zero without starting a merge` assertion. Added the test "SKILL.md decides every failed git merge by MERGE_HEAD, not by git's message" with the 8 positive and 4 negative substring checks.

## Acceptance criteria
- [x] Step 5 `local` has one rule: "One rule applies whenever `git merge` exits non-zero (...): do not judge by git's message, run `git rev-parse -q --verify MERGE_HEAD`."
  - If it succeeds: `git merge --abort`, then `stage <id> needs-human --note "conflict or rejected merge: <git line>"`, step 7, then step 6.
  - If it fails: `stage <id> needs-human --note "merge refused: <git line>"`, step 7, then step 6.
  - "In both cases never go on to the tests or `merged`." The old "Otherwise run the test command" now reads "If the merge exits 0, run the test command on main".
- [x] `<git line>` is defined once, in step 5: the first output line starting with `error:` or `CONFLICT`, "with double quotes, `$` and backticks removed". It falls back to the first non-empty line, cleaned the same way.
- [x] Abort failure: all three sites say "If `git merge --abort` fails, stop and tell the user: do not run step 7". Step 5 also gives the reason: step 7's commit would finish the untested merge.
- [x] `/factory approve`: "Whenever `git merge` exits non-zero, apply step 5's `MERGE_HEAD` check, but leave the stage as is in both branches".
  - If `MERGE_HEAD` is set: abort, and tell the user to use `/factory rework <id> <note>`.
  - If it is not set: relay `<git line>`.
  - Includes the abort-failure stop and "Either way never go on to the tests or `merged`".
- [x] `/factory rework`:
  - Runs `git -C "<worktree>" merge --no-edit <mainBranch>` (quoted).
  - On a non-zero exit, runs `git -C "<worktree>" rev-parse -q --verify MERGE_HEAD`. If that succeeds, runs `git -C "<worktree>" merge --abort`.
  - "In both cases tell the user `<git line>` and stop: do not run `board.mjs rework` and do not resume the builder; do not resolve conflicts yourself."
- [x] Message-based wording removed. None of `If the merge reports conflicts`, `conflicts with <mainBranch>`, `merge refused: <git message>` or `refused without starting` remain, and negative test assertions check for all four.
- [x] Step 6: line 3 now triggers with "If the job was parked as \"conflict or rejected merge\"". The line 3 text itself is unchanged.
- [x] `npm test` passes, and only `claude-setup/skills/factory/SKILL.md` and `tests/skill.test.mjs` changed (`git diff --stat main..HEAD`).

## Tests
- Command: `npm test` (in the worktree)
- Result: passed, 122/122 (121 on main plus the 1 new test)
- Added or changed: `tests/skill.test.mjs`

## Notes
- The spec's negative-assertion list names three strings. I also asserted the fourth string from the acceptance criteria (`refused without starting`).
- Step 5 lists example causes in parentheses: a conflict, a hook rejection, and "would overwrite local changes". These only illustrate the rule; the decision still rests on `MERGE_HEAD`.
- Line 45 ("every `git merge` from the main checkout") and the "Running several jobs" paragraph were not touched. Both are still accurate enough and are outside the spec. `.claude/` was not edited.

## Rework 1
Commit: 7ac61bc22b74eb917834c464a3052941363fb707
- Addressed: ux-reviewer (should fix): `/factory rework` sentence order. The next sentence now opens with "If the merge exits 0, run `node scripts/board.mjs rework ...`", so the success path is named and cannot be read as "stop, then rework anyway". ui-design-reviewer and code-reviewer raised the same point.
- Addressed: ux-reviewer (should fix): step 5 `local` "In both cases". It is now "In either branch never go on to the tests or `merged`.", placed directly after the `merge refused` branch and before the abort-failure sentence.
- Addressed: security-reviewer (note): `<git line>` now also strips backslashes: "with double quotes, `$` and backticks removed, and backslashes removed too (a trailing `\` would escape the closing quote of `--note "..."`)". The pinned substring stays intact.
- Addressed: ux-reviewer (note, optional): approve and rework now say "`<git line>` (as defined in step 5)".
- Not addressed: ux-reviewer (note): step 6 line 3 says "would hit the same conflict", which does not fit a hook rejection. The spec requires line 3 to stay unchanged, so I left it for a later job.
- Not addressed: ux-reviewer (note): rework gives a bare git line with no next step. The reviewer marked this fine, and it matches the spec.
- Tests: `npm test` passes, 122/122. tests/skill.test.mjs adds assertions for "and backslashes removed too", the either-branch ordering and the rework success-path sentence, plus a negative assertion that "In both cases never go on to the tests" is gone.
