# UX reviewer review: Fix park message branch wording when validate fails

- Job: j-20261015-006
- Round: 1

## Summary
I checked the step 6 wording in SKILL.md from two views: the orchestrator who follows it, and the human who reads the park message. The orchestrator now has a concrete check (`git branch --show-current`) and a clear rule for each case. The human gets a message that names the branch the repo is really on, and the three-line limit is kept.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md:83`: When the repo is on `<branch>`, the message says the repo is on `<branch>` and the work is on `<branch>`. This is accurate but repeats itself, and the human is not told they must switch to main themselves. Fix (optional): tell the orchestrator to state it once, for example "repo is still on `<branch>`", when the two names are the same.
- **note** `claude-setup/skills/factory/SKILL.md:83`: The step 6 paragraph is now one dense block. The first half is the message content and the second half is the check logic, so the orchestrator may find it harder to scan. This is acceptable, because the content list stays first and the logic follows in the same order as the spec. Fix (optional): split the check into a separate sentence or a short bullet pair.

## Checked
- The diff of SKILL.md and tests/skill.test.mjs against spec.md acceptance criteria.
- The message still lists job id, title, reason, branch, and both commands (`/factory approve <id>`, `/factory rework <id> <note>`).
- "three lines or fewer" and the uncommitted-records note for early-stopped step 7 are both kept.
- The new text is a conditional on a git check, so it covers the rollback paths where the repo is already on main.
- The old unconditional phrase is removed, and no other step changed.
- The new test covers the wording, and it reads the step 6 section only.

VERDICT: pass
