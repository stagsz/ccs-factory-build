# Approval: Commit factory records after each job

- Job: j-20261015-005
- Branch: factory/j-20261015-005-commit-factory-records-after-each-job
- Rework cycles: 1

## What changed
The orchestrator skill (`claude-setup/skills/factory/SKILL.md`) gets a new step 7. On every end state (merged, needs-human, failed) it validates the board, switches to main and commits `factory/board.json`, `factory/backlog.md` and `factory/jobs/<id>/` as "factory: record <id>". The post-merge rollback changes from `git reset --hard ORIG_HEAD` to `git reset --keep ORIG_HEAD`. `builder.md` now forbids the builder from staging anything under `factory/`. A new `tests/skill.test.mjs` checks the wording. Three files, +55/-12. `npm test` passes, 37/37, and I re-ran it.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
High, for three reasons:
- **Protected path.** Two of the three files are under `claude-setup/**`, which `factory/config.json` lists in `alwaysEscalatePaths`. The deterministic risk check escalates this anyway.
- **Git behaviour on main changes.** This changes how the factory itself runs git: it adds a commit on main for every job and changes the rollback command. If the wording is wrong, job records could be lost or the tree left dirty. The tests only check that certain strings are present. None of them runs the flow.
- **Out of spec.** The builder also changed `/factory rework`, which now runs `git merge --no-edit <mainBranch>` into the job branch before reworking. The spec did not ask for this. build.md justifies it and code-reviewer and security-reviewer accepted it, but it changes how job branches look over time.

What to check before merging:
1. **The `/factory rework` merge.** Decide whether merging main into the job branch is acceptable, or whether it should be reverted and handled in a follow-up job.
2. **Step 7's switch to main** on the needs-human and failed paths. The factory records are uncommitted, so they move across to main with it. Confirm `build.md` is never committed on the branch; if it were, the switch would remove it.
3. **`--keep` on the rollback.** Confirm `git reset --keep ORIG_HEAD` is the rollback you want, and that a `--keep` error stopping the flow with no `--hard` fallback is acceptable.
4. **Optional wording nit** from security-reviewer. If step 7's validate fails, the step 6 message says the repo is on `<mainBranch>`, but it is still on the job branch.
5. **Run the next job.** Watch that it passes the clean-tree check and that one "factory: record <id>" commit appears on main.

RISK: high
DECISION: escalate
