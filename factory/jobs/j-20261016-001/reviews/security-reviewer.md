# Security reviewer review: Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Round: 1

## Summary
I compared the old step 5 `local` paragraph with the new nested bullets one rule at a time, looking for any merge or rollback safety rule that was weakened, dropped or reordered in a dangerous way. Every rule is still there with the same wording. The only reorder moves the abort-failure stop ahead of `stage ... needs-human` and `run step 7`, which removes an ordering ambiguity in the old text and so makes the instruction safer. The diff adds no new command, dependency, secret or permission.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md:96`: "In either branch never go on to the tests or `merged`." now sits in the parent bullet, before the two branches it refers to. In the old text it came after them. It still covers both branches, and "If it succeeds, a merge started" plainly refers to the `rev-parse` check, so the meaning holds. Fix: none required.

## Checked
- The diff touches only `claude-setup/skills/factory/SKILL.md` (one hunk, old line 94 becomes 8 lines) and `tests/skill.test.mjs`. `.claude/`, the `pr` bullet, `Then ... stage <id> merged`, `/factory approve`, `/factory rework` and step 6 are unchanged.
- MERGE_HEAD decision: "do not judge by git's message" and `git rev-parse -q --verify MERGE_HEAD` are kept. Both branches and their notes (`conflict or rejected merge: <git line>`, `merge refused: <git line>`) are kept. "never go on to the tests or `merged`" still covers both branches.
- `git merge --abort` runs only in the branch where MERGE_HEAD is set. If the abort fails, the instruction is to stop, tell the user and not run step 7, and the reason ("its commit would finish the untested merge") is kept word for word. This rule now comes before `stage` and `run step 7` inside that branch, so the orchestrator cannot reach step 7 after a failed abort by following the bullets in order. This is stronger than the old placement.
- "do not resolve conflicts yourself" is kept.
- Note sanitising: the `<git line>` definition is byte-identical. It still removes double quotes, `$`, backticks and backslashes (with the trailing-backslash rationale), and the fallback line is "cleaned the same way". The shell-injection guard on `--note "..."` is intact.
- Rollback: `git reset --keep ORIG_HEAD`, the reason `--hard` is not used, "If `reset --keep` reports an error, stop and tell the user: do not run step 7, and never retry with `--hard`" and the "tests failed on main after merge" park are all byte-identical.
- No `reset --hard`, `--force`, `git switch` or other new destructive command appears anywhere in the diff.
- Tests: the replaced pin is covered by an `includes` check, an order check (merge started < abort-failure stop < conflict note < refused branch) and a check that the `local` header line has no rule text. All other positive and negative pins are unchanged.
- Secrets, dependencies, injection, auth and logging: the diff touches only prose and test assertions. Nothing relevant was added.
- `npm test` in the worktree: 122 pass, 0 fail.

VERDICT: pass
