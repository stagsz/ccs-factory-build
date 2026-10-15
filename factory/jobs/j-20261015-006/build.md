# Build report: Fix park message branch wording when validate fails

- Job: j-20261015-006
- Branch: factory/j-20261015-006-fix-park-message-branch-wording-when-val
- Last commit: 95321ad

## Files changed
- `claude-setup/skills/factory/SKILL.md`: step 6 only. Replaced the unconditional "that the repo is left on `<mainBranch>` (the work is on `<branch>`)" with "the branch the repo is actually on and that the work is on `<branch>`", and added one sentence telling the orchestrator to check with `git branch --show-current`: `<mainBranch>` once step 7 has switched (or the repo was already on main, as on the rollback paths), `<branch>` when step 7 stopped before switching away from the job branch (validate errors or a failed switch).
- `tests/skill.test.mjs`: new test "SKILL.md step 6 names the branch the repo is actually on".

## Acceptance criteria
- [x] Unconditional text removed from step 6: the old phrase is gone; the new test asserts the whole SKILL.md no longer contains it.
- [x] Step 6 names the actual branch via `git branch --show-current`, with `<mainBranch>` after the switch or when already on main, `<branch>` when step 7 stopped early (validate errors or failed switch), and still says the work is on `<branch>`.
- [x] Step 6 still says "three lines or fewer" and lists job id, title, why it needs the human, the uncommitted-records note when step 7 stopped early, `/factory approve <id>` and `/factory rework <id> <note>`.
- [x] No other step changed. Step 7 item 2 already says "with the step 6 message", which now reads correctly, so it was left as is.
- [x] New test added in `tests/skill.test.mjs`; `npm test` passes.

## Tests
- Command: `npm test`
- Result: passed, 38 tests, 0 failures
- Added or changed: `tests/skill.test.mjs`

## Notes
- `.claude/` was not edited or regenerated (out of scope); the installed copy of the skill picks this up on the next `npm run setup -- --force`.
- The "three lines or fewer" limit applies to the message to the user; the added sentence is an instruction to the orchestrator, not message content.
