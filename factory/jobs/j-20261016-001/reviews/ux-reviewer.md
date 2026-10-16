# UX reviewer review: Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Round: 1

## Summary
I checked the nested `local` bullet against the old line 94 and the spec's target structure, reading as the orchestrator model and as the human who sees its messages. The structure is easier to follow. Every branch has one outcome, and the abort-failure rule now comes before step 7 in the MERGE_HEAD-set branch, which removes the earlier contradiction. `npm test` passes (122/122).

## Findings
- **note** `claude-setup/skills/factory/SKILL.md:94-101`: Two sibling branches both start with "If it fails". The first is `rev-parse` failing and the second is the test command failing. Nesting keeps them apart, and the spec fixes the wording. Fix: none needed. If the wording is touched later, name the subject ("If `rev-parse` fails", "If the tests fail").
- **note** `claude-setup/skills/factory/SKILL.md:97`: `<git line>` is defined after the bullets that use it. This was already true in the old paragraph, and `/factory rework` points to the definition in step 5. Fix: none.

## Checked
- Rule-by-rule against the old line 94: merge command, three example causes, "do not judge by git's message", both MERGE_HEAD branches and their notes, "never go on to the tests or `merged`" (now above both branches, so it still covers both), "do not resolve conflicts yourself", the `<git line>` definition with both cleaning clauses and the fallback, the exit-0 test, `reset --keep ORIG_HEAD` and why not `--hard`, stopping on a `reset --keep` error, and the "tests failed on main after merge" park. All are present with the same meaning, and no new rule was added.
- The abort-failure rule now sits after `run git merge --abort` and before the `stage` and step 7 instructions. "Stop" is unambiguous in that position.
- The `    - \`local\`:` line holds no rule text, and the `pr` and `Then ... merged` lines are unchanged.
- The new test pins the order of the four phrases and asserts that the `local` line has no MERGE_HEAD. The old brittle pin is relaxed correctly.
- Ran `npm test` in the worktree: 122 pass, 0 fail.

VERDICT: pass
