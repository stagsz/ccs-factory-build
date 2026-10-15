# Approval: Decide merge failures by MERGE_HEAD, not git's message

- Job: j-20261015-013
- Branch: factory/j-20261015-013-decide-merge-failures-by-merge-head-not
- Rework cycles: 1

## What changed
When `git merge` fails, the orchestrator skill (`claude-setup/skills/factory/SKILL.md`) no longer decides what happened by reading git's message. At all three merge sites (step 5 `local`, `/factory approve`, `/factory rework`) it now checks `git rev-parse -q --verify MERGE_HEAD`. If a merge started, it aborts it, and it never goes on to tests or `merged`. If the abort itself fails, it stops before step 7, so the record commit cannot finish a half-done merge that was never tested. The `--note` now carries a cleaned `<git line>`: double quotes, `$`, backticks and backslashes are stripped. `tests/skill.test.mjs` pins the new wording and checks that the old wording is gone.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass (round 1 asked for changes, which rework 1 fixed)
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
The diff is small, matches the spec and stays inside the two allowed files (24 insertions, 5 deletions). `npm test` passes 122/122, and the new test pins every required phrase plus the negative assertions. Even so, `claude-setup/skills/factory/SKILL.md` matches the `claude-setup/**` path in alwaysEscalatePaths. The change also governs how the orchestrator handles every failed merge on main. That makes it high risk by rule, and the spec expected this outcome.

Before merging, a human should check:
- **Step 5 `local` paragraph:** read it once end to end. It is now one long bullet, and the order matters: decide by MERGE_HEAD, abort, park, and stop before step 7 if the abort fails.
- **`/factory rework`:** the paragraph must stop on any non-zero merge exit and name the success path ("If the merge exits 0, run `node scripts/board.mjs rework ...`").
- **After merging:** run `npm run setup -- --force`. `.claude/` was deliberately left alone, so the live orchestrator keeps the old wording until you do.

Reviewer follow-ups, all optional and not blocking:
- **Step 6, line 3 (ux, code):** it still says "/factory approve <id> would hit the same conflict", even for a job parked because a hook rejected the merge. The spec froze this text. A later job could add "or rejection".
- **Step 5 bullet length (ui-design):** splitting step 5's `local` bullet into nested sub-bullets would make it easier to read.
- **`/factory rework` wording (ux):** it says "In both cases" where step 5 now says "In either branch". This is cosmetic.

RISK: high
DECISION: escalate
