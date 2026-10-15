# Spec: Fix park message branch wording when validate fails

- Job: j-20261015-006
- Branch: factory/j-20261015-006-fix-park-message-branch-wording-when-val

## Goal
When a job is parked for a human, the step 6 message names the branch the repo is actually on: `<mainBranch>` after step 7 switched to it, otherwise the branch the repo stayed on.

## Context
- `claude-setup/skills/factory/SKILL.md` line 83, step "### 6. Park for a human": says "that the repo is left on `<mainBranch>` (the work is on `<branch>`)" with no condition.
- Step 7 (lines 85-90) can stop before switching. Item 1: `validate` errors skip the rest of step 7, including the switch. Item 2: `git switch <mainBranch>` can fail. In both cases a job that came from the review or approve path is still on `<branch>`. Step 7 item 2 already refers to "the step 6 message", so fixing step 6 fixes that case too.
- Edge case: on the step 5 local-merge rollback path and the `/factory approve` rollback path, the repo is already on `<mainBranch>` before step 7 runs. So "step 7 did not switch" does not always mean "on `<branch>`". Checking the actual current branch gives the right answer on every path.
- Other paths I checked, which need no change: the step 3 `failed` path runs step 7 and then stops, without step 6, and makes no claim about the branch. The `/factory rework` conflict path switches back to `<mainBranch>` itself and does not use step 6.
- `tests/skill.test.mjs` reads the source SKILL.md through `read("skills", "factory", "SKILL.md")` and checks it with `assert.ok(skill.includes(...))`.

## Acceptance criteria
- [ ] In `claude-setup/skills/factory/SKILL.md`, step 6 no longer contains the unconditional text "that the repo is left on `<mainBranch>` (the work is on `<branch>`)".
- [ ] Step 6 tells the orchestrator to name the branch the repo is actually on, checked with `git branch --show-current`. It says this is `<mainBranch>` once step 7 has switched (or the repo was already on main), and `<branch>` when step 7 stopped before switching away from the job branch (validate errors or a failed switch). It still says the work is on `<branch>`.
- [ ] Step 6 still says "three lines or fewer" and still lists job id, title, why it needs the human, the uncommitted-records note when step 7 stopped early, `/factory approve <id>` and `/factory rework <id> <note>`.
- [ ] No other step in SKILL.md changes, except an optional wording tweak in step 7 item 2 if the step 6 reference needs it.
- [ ] `tests/skill.test.mjs` has a new test for the step 6 wording, and `npm test` passes.

## Out of scope
- `.claude/` (generated; do not edit or regenerate it in this job).
- The `scripts/` and `dashboard/` folders, `board.mjs` logic, `factory/config.json`, agent files.
- Wording for step 3 `failed`, step 7 item 1, the `/factory rework` conflict path, and `/factory approve`.
- Any change to step 7's order or git commands.

## Tests
- `tests/skill.test.mjs`: add one test, e.g. "SKILL.md step 6 names the branch the repo is actually on". Take the step 6 section as the text between `### 6. Park for a human` and `### 7. Record the job`, then assert:
  - it includes `git branch --show-current`
  - it includes `<mainBranch>` and `<branch>`
  - it includes `three lines or fewer`, `/factory approve <id>` and `/factory rework <id> <note>`
  - the whole of SKILL.md does not include `that the repo is left on \`<mainBranch>\` (the work is on \`<branch>\`)`
- Leave the existing tests unchanged; they must still pass.

## Risks
- None. This is wording in the orchestrator instructions only. The orchestrator still has to stay within step 6's limit of three lines or fewer.

## Assumptions
- I use `git branch --show-current` instead of a pure "did step 7 switch" rule because of the rollback paths that are already on main. This matches the request's intent: name the branch the repo is actually on.
- The step 3 `failed` path and the `/factory rework` conflict path are left alone. Neither makes a wrong claim about the branch.
