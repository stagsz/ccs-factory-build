# Fix park message branch wording when validate fails

- Job: j-20261015-006
- Branch: factory/j-20261015-006-fix-park-message-branch-wording-when-val
- Source: cli
- Created: 2026-10-15T18:21:35.436Z

## Request

In claude-setup/skills/factory/SKILL.md, step 6 (Park for a human) always tells the user the repo is left on <mainBranch>. But when step 7's validate reports errors, step 7 skips the rest (including git switch <mainBranch>), so the repo is actually still on the job branch <branch>. The same is true if step 7's git switch fails. Fix the step 6 wording so the message names the branch the repo is actually on: <mainBranch> when step 7 completed its switch, otherwise <branch>. Keep the change minimal, keep step 6 to three lines or fewer for the user, and extend tests/skill.test.mjs to assert the new wording. Do not edit .claude/ (generated).
