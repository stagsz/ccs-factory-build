# Approval: Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Branch: factory/j-20261016-001-split-the-step-5-local-merge-bullet-into
- Rework cycles: 0

## What changed
In `claude-setup/skills/factory/SKILL.md`, the single-paragraph step 5 `local` merge bullet (old line 94) is now 8 nested sub-bullets: the merge command, the non-zero-exit MERGE_HEAD check with its two branches, the `<git line>` definition, and the exit-0 test plus rollback. The rule "if `git merge --abort` fails, stop and do not run step 7" now sits inside the MERGE_HEAD-set branch, before that branch's `stage` and `run step 7`. `tests/skill.test.mjs` swaps one pinned substring that broke for an `includes` check, an order check, and a check that the `local:` header line holds no rule text.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
The work itself is clean. The diff is one hunk in SKILL.md plus the test update, and it matches the spec's target block. I compared it with the old paragraph rule by rule and found nothing dropped, weakened or added. The `<git line>` sanitising text and the `reset --keep` / never-`--hard` rollback text are unchanged word for word. `npm test` passes in the worktree (122/122), and `.claude/` is untouched.

It is still rated high, for two reasons:
- `claude-setup/**` is in `risk.alwaysEscalatePaths`.
- The change rewrites the orchestrator's own merge and rollback instructions on main. A wording slip there would only show up the next time a merge fails.

What a human should check before merging:
- Read the new step 5 `local` block in SKILL.md (lines 94-101 on the branch). Both MERGE_HEAD branches should end in `needs-human`, step 7 and step 6. A failed `git merge --abort` or `reset --keep` should stop before step 7.
- "In either branch never go on to the tests or `merged`." now sits above the two branches instead of after them. Confirm it still reads as covering both.
- After merging, run `npm run setup -- --force` so `.claude/skills/factory/SKILL.md` picks up the new wording. This job deliberately did not run it.

RISK: high
DECISION: escalate
