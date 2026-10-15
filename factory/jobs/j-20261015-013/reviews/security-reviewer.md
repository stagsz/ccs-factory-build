# Security reviewer review: Decide merge failures by MERGE_HEAD, not git's message

- Job: j-20261015-013
- Round: 2 (after rework 1, commit 7ac61bc)

## Summary
Rework 1 fixes both of my round 1 notes and does not weaken any merge-failure path. `<git line>` now strips backslashes as well as double quotes, `$` and backticks. Those are all the characters bash treats specially inside double quotes, apart from `!`, and `!` is inert in the Bash tool's non-interactive shell. A cleaned line can no longer escape or break the `--note "..."` argument. `/factory rework` now names its success path ("If the merge exits 0, run `node scripts/board.mjs rework ...`"), so it can no longer be read as "stop, then rework anyway". The diff still touches only `claude-setup/skills/factory/SKILL.md` and `tests/skill.test.mjs`. `npm test` passes, 122/122.

## Findings
None.

## Checked
- Backslash fix (`claude-setup/skills/factory/SKILL.md:94`): the definition now reads "with double quotes, `$` and backticks removed, and backslashes removed too (a trailing `\` would escape the closing quote of `--note "..."`)". The pinned substring "double quotes, `$` and backticks removed" is still intact. I reproduced the round 1 case `merge refused: foo\ bar\` in Git Bash. After stripping `"`, `$`, backtick and `\` it becomes `merge refused: foo bar`, and `bash -c` with the double-quoted note exits 0. In PowerShell, only `$` and backtick expand inside double quotes, and both are removed. Git prints paths with forward slashes, even on Windows, so dropping backslashes loses no useful detail. "cleaned the same way" makes the fallback (first non-empty line) strip backslashes too.
- Step 5 `local`, after the reorder: on any non-zero exit it runs `git rev-parse -q --verify MERGE_HEAD`.
  - If that succeeds, it runs `git merge --abort`, parks with "conflict or rejected merge", runs step 7, then step 6.
  - If it fails, it parks with "merge refused", runs step 7, then step 6.
  - "In either branch never go on to the tests or `merged`" now sits right after both branches.
  - The abort-failure stop ("do not run step 7, because its commit would finish the untested merge") follows it. It applies to the only branch that runs an abort, so step 7 cannot commit while `MERGE_HEAD` is still set.
  - The test-failure path (`reset --keep ORIG_HEAD`, never `--hard`) is unchanged.
- `/factory approve`: the only change is "(as defined in step 5)". Both branches still leave the stage as is. The abort-failure stop and "Either way never go on to the tests or `merged`" are unchanged.
- `/factory rework`:
  - merge, rev-parse and abort all still use `git -C "<worktree>"` (quoted).
  - On a non-zero exit it tells the user `<git line>` and stops, before `board.mjs rework` and before resuming the builder.
  - The success path now starts with "If the merge exits 0".
  - "do not resolve conflicts yourself" is kept.
  - Here `<git line>` is relayed to the user as text, not passed through a shell.
- Tests: the new assertions pin "and backslashes removed too", the either-branch ordering and the rework success-path sentence. A negative assertion checks that the old "In both cases never go on to the tests" text is gone. All earlier positive and negative assertions remain.
- No new `--force`, `--hard`, `stash`, `reset` or `clean`. No secrets, dependencies, eval, logging or auth changes. `.claude/`, `scripts/` and the dashboard are untouched (`git diff --stat main...HEAD` shows 2 files).
- Out of scope, unchanged: the human-supplied `<note>` in `/factory rework`'s `--note "<note>"` comes from the user, not from git output, and this spec does not cover it.

VERDICT: pass
