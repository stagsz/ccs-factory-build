# Code reviewer review: Decide merge failures by MERGE_HEAD, not git's message

- Job: j-20261015-013
- Round: 2 (re-review after rework 1)

## Summary
I re-checked the full diff (`main...HEAD`) and the rework-only changes (`90970df..7ac61bc`) against every acceptance criterion. I ran `npm test` in the worktree: 122 pass, 0 fail. All criteria are still met, the three merge sites agree, and the tests pin the reworded text. Only the two allowed files changed.

## Findings
- No blocking or should-fix findings. My round 1 note (rework sentence order) is resolved: the sentence after "stop" now opens with "If the merge exits 0, run `node scripts/board.mjs rework ...`".
- **note** Step 6 line 3 still says `/factory approve <id> would hit the same conflict`. That does not fit a hook rejection, but the spec requires the line text to stay unchanged, and build.md records it as deferred. No change needed.

## Checked
- Step 5 `local`: one rule "whenever `git merge` exits non-zero" using `git rev-parse -q --verify MERGE_HEAD`. If it succeeds: abort, then `conflict or rejected merge: <git line>`, step 7, step 6. If it fails: `merge refused: <git line>`, step 7, step 6. "In either branch never go on to the tests or `merged`" is present, and the exit-0 path still runs the tests. The abort-failure stop precedes any step 7.
- `<git line>` is defined once, in step 5. The literal "double quotes, `$` and backticks removed" is intact. The added ", and backslashes removed too" extends the cleaning (a trailing `\` would escape the closing quote of `--note "..."`) without breaking the pinned substring. The first-non-empty-line fallback is kept.
- "If `git merge --abort` fails, stop and tell the user: do not run step 7" appears at all three sites.
- `/factory approve`: same check, stage left as is in both branches, abort then point to `/factory rework`, or relay `<git line>`. "Either way never go on to the tests or `merged`." It refers to step 5's definition of `<git line>`.
- `/factory rework`: quoted merge command; `git -C "<worktree>" rev-parse -q --verify MERGE_HEAD`; `git -C "<worktree>" merge --abort`; "In both cases tell the user `<git line>` and stop", with no `board.mjs rework` and no builder resume. "do not resolve conflicts yourself" is kept. Success path is named explicitly.
- The three sites are consistent: the same MERGE_HEAD test, the same abort-failure stop, and the same `<git line>` definition.
- Removed phrases (`If the merge reports conflicts`, `conflicts with <mainBranch>`, `merge refused: <git message>`, `refused without starting`) are gone, and the tests assert their absence.
- Step 6 line 3: the trigger is now "conflict or rejected merge"; the line text, including `merges <mainBranch> into <branch> first`, is unchanged.
- Tests: the old `exits non-zero without starting a merge` assertion is replaced. The new test has all 8 required positive substrings and the negatives. The rework adds assertions for "and backslashes removed too", the either-branch ordering, the rework success-path sentence, and the absence of "In both cases never go on to the tests". Each would fail if the wording regressed. Existing assertions for `git merge --abort`, `do not resolve conflicts yourself` and `merges <mainBranch> into <branch> first` still pass.
- Scope: `git diff --stat main...HEAD` shows only `claude-setup/skills/factory/SKILL.md` and `tests/skill.test.mjs`. `.claude/` is untouched. No debug output or dead code.
- `npm test`: 122 pass, 0 fail.

VERDICT: pass
