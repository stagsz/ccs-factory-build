# UX reviewer review: Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Round: 2

## Summary
I re-read the rework diff (73ea6fe..c310876) against my three round-1 should-fix items. All three are resolved with fixed wording that is unambiguous and consistent with the rest of SKILL.md and the human commands. The remaining points are minor notes.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md` (step 6, `Started <k> of <n>` line): the template nests alternatives (`<Only <free> slot(s) free | The backlog has no more "- [ ]" items>`). It reads fine for an orchestrator, but a reader could miss that the part in angle brackets is a choice. Optional: write the two sentences out on separate bullets.
- **note** `claude-setup/skills/factory/SKILL.md` (step 6, conflict line 3): the conflict-park "Next:" line is long, so the "three lines or fewer" rule is met only by line count. It is still correct and matches the `rework` command, which merges `<mainBranch>` into the branch first. No change needed.
- **note** (carried over, accepted): the CLI `preflight` outside a git repo prints raw git output. Exit code is right.

## Round-1 items
- Step 6 park message: resolved. A fixed three-line template now carries id, title, why, branch and worktree, main-checkout branch, and both commands. The wrong-branch case (`expected <mainBranch>`), the early-stop case (`Records are uncommitted.`) and the merge-conflict case (rework merges main first, approve would hit the same conflict) each have their own rule. This matches the `/factory rework` description further down.
- No free slot and short backlog mid-session: resolved. `slots` now runs before every `/factory <feature>` and `/factory next <n>`. The `free 0` message gives the active ids, the two ways forward, and says that resuming earlier-session jobs is not supported yet, which also closes my earlier note. The `Started <k> of <n>` message covers both fewer free slots and an empty backlog.
- Spec-approval gate with other jobs running: resolved. The step 2 text says the job stops alone, keeps its slot and the others carry on. The "Running several jobs" section says the same, and the wording is consistent between the two.

## Checked
- Rework diff of SKILL.md, the six agent prompts (quoting of Windows paths in shell commands) and `tests/skill.test.mjs` (the new test pins the new wording).
- Extra rework changes: the refused-merge path ("would overwrite local changes") in step 5 and in `/factory approve` now parks or relays git's message instead of continuing, and step 7 tells the user when a worktree was left in place. Both are clear and consistent with the existing conflict handling.
- Not re-run: `npm test`; I relied on build.md.

VERDICT: pass
