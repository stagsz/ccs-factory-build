# UX reviewer review: Commit factory records after each job

- Job: j-20261015-005
- Round: 2 (re-review after rework 1)

## Summary
All my round 1 findings are fixed. The instructions read clearly for the orchestrator, and the messages the human gets on every stop path say what happened and what to do next. No UX problems that matter remain.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md` (step 3, `failed`): "run step 7, then stop" gives no user message on a failed job. This is the same as before the change and out of scope. The one-line-per-stage-change rule covers it.
- **note** `claude-setup/skills/factory/SKILL.md` (step 5 and `/factory approve`, `reset --keep` error): the orchestrator stops and tells the user, but the text does not say what to tell them. The instruction is still clear enough, since the cause is the reset error itself. Optional only.

## Previous findings
- Validate failure dead end: fixed. Step 7 item 1 reports the errors, says the records are uncommitted, skips the rest of step 7 and continues to step 6 for `needs-human`. Step 6 now runs "after step 7, even if step 7 stopped early" and repeats the uncommitted warning.
- No recovery when `git switch` fails: fixed. Step 7 item 2 says to stop, tell the user (with the step 6 message for `needs-human`), and not to use `git stash` or `--force`.
- Human not told which branch they are on: fixed. The step 6 message names `<mainBranch>` and `<branch>`. It still fits "three lines or fewer".
- New text (rework merge conflict, approve rollback): the rework conflict path aborts the merge, returns to main and tells the user without resolving conflicts. The board is unchanged at that point. The approve rollback explains why `stage` is not run, so the orchestrator will not hit the board's rejection.

## Checked
- Every end-state path names step 7, and step 6 is gated after it.
- The Rules section matches step 7 and the rollback wording.
- builder.md: forbidden paths are explicit and the staging-by-path instruction is clear.
- The "not pushed" wording is now accurate for `pr` mode.

VERDICT: pass
