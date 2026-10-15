# Approval: Fix park message branch wording when validate fails

- Job: j-20261015-006
- Branch: factory/j-20261015-006-fix-park-message-branch-wording-when-val
- Rework cycles: 0

## What changed
Step 6 ("Park for a human") of `claude-setup/skills/factory/SKILL.md` no longer always says the repo is left on `<mainBranch>`. It now tells the orchestrator to check `git branch --show-current` and name the branch the repo is really on: `<mainBranch>` after step 7 switched (or on the rollback paths, where the repo was already on main), and `<branch>` when step 7 stopped early. One line changed in SKILL.md, plus one new string-match test in `tests/skill.test.mjs`.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass (two optional notes: the message repeats itself when the repo and the work are both on `<branch>`, and the step 6 paragraph is now dense)
- ui-design-reviewer: pass (nothing in scope)
- code-reviewer: pass

## Why this risk rating
The change itself is small, matches the spec, and is easy to revert. All four reviewers passed in round 1. `npm test` passes (38 tests, 0 failures, rerun by the approver), and the new test covers the new wording. `.claude/` was not touched.

It is still rated high, because the diff edits `claude-setup/**`, which is on the `alwaysEscalatePaths` list. That file holds the orchestrator's own instructions, so it counts as factory config. A wrong instruction there changes how every later job is run, and a test that only matches strings cannot show that the orchestrator acts correctly.

Before merging, a human should check:
- The new step 6 text in `claude-setup/skills/factory/SKILL.md` (line 83) reads correctly, and the park message can still fit in three lines.
- Whether to take the optional UX note: when the repo is still on `<branch>`, say "repo is still on `<branch>`" once, and tell the user to switch to main themselves.
- After merging, run `npm run setup -- --force` so the installed `.claude/` copy picks up the change.

RISK: high
DECISION: escalate
