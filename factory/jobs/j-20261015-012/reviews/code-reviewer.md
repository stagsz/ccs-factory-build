# Code reviewer review: Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Round: 2 (re-review after rework 1, commit c310876)

## Summary
The rework is a wording-only change to SKILL.md and the six agent files, plus one new skill test. I re-ran `npm test`: 121 pass, 0 fail. Every acceptance criterion that was met in round 1 is still met. SKILL.md is internally consistent. I found no must-fix items.

## Acceptance criteria (re-checked after the rework)
| Criterion | Status |
|---|---|
| config `parallel` block, `.gitignore` | met, untouched by rework |
| lib functions, `validateBoard` error | met, untouched by rework (`git diff 73ea6fe..c310876` touches no `scripts/`) |
| CLI `worktree`, `slots`, `preflight` | met, untouched |
| SKILL.md: no `git switch`, no `worktree remove --force`, no "One job at a time in this version" | met (grep count 0) |
| SKILL.md uses `git worktree add -b <branch> <worktree> <mainBranch>` and `git -C <worktree> branch --show-current` verbatim | met. The literal forms stay unquoted. |
| Step 6 names the branch and worktree, checks `git branch --show-current`, names `<mainBranch>`, says "three lines or fewer", keeps both commands | met. Now a three-line template. |
| `builder.md`, four reviewers, `approver.md` | met. Each gained one quoting line in Input. The `factory/` prohibitions and the VERDICT/RISK/DECISION formats are unchanged. |
| README, `.claude/` untouched, `npm test` | met |

## Judgement on the unquoted command literals
Accepted. The spec's acceptance criteria quote `git worktree add -b <branch> <worktree> <mainBranch>` and `git -C <worktree> branch --show-current` exactly, and the skill test pins them. A general rule in "The line" (and in each agent's Input) says to wrap `<worktree>` and `<jobdir>` in double quotes when they go into a shell command. This is the one spot where the placeholder is a template rather than a command to paste, so a single rule is less error-prone than quoting some call sites and missing others. The one cost is that a reader copying a literal gets no quotes. The rule sits directly above the first use, so this is acceptable.

## Consistency of the new SKILL.md paths
- Merge refused without starting (step 5 `local`): `needs-human --note "merge refused: ..."`, then step 7, then step 6, and it never reaches the tests or `merged`. The job is in `approve` at that point, so `approve` to `needs-human` is a valid transition. `/factory approve` has the matching line (leave the stage, relay git's message), and it fits the existing rule that `needs-human` to `needs-human` is rejected.
- Step 6 template: the merge-conflict variant of line 3 matches the `rework` command (it merges `<mainBranch>` into `<branch>` in the worktree first, and a conflict there is left to the human). The "records uncommitted" and "expected `<mainBranch>`" suffixes line up with step 7.1 and the branch check.
- Step 7.1 validate failure now also says the worktree was left in place. This resolves my round 1 note.
- Slot checks: "Before the first job" step 6 runs `slots` before every `/factory <feature>` and `/factory next <n>`. The `free 0` and `Started <k> of <n>` messages are given. `rework` still checks for a free slot. `spec-approval` keeps its slot, and this is stated the same way in step 2 and in "Running several jobs" item 3, matching `ACTIVE_STAGES`.

## Tests
`tests/skill.test.mjs` has a new test. It slices step 6 and asserts the template's line 2, the conflict line 3 fragment, `No free slot (active: <ids>).`, `Started <k> of <n>: <ids>.`, the spec-approval slot sentence, `exits non-zero without starting a merge`, `its worktree (if any) was left in place` and the quoting rule. Each assertion is a verbatim substring of the current SKILL.md, so rewording any of them fails the test. Two small gaps, neither blocking:
- **note** The test does not pin the `approve` command's refused-merge sentence ("relay git's message"). Only the step 5 half is pinned.
- **note** The quoting rule is asserted for SKILL.md only. The six agent files each gained the same line, but none is asserted. Optionally add `includes("double quotes")` to the existing per-agent worktree test.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md` step 6 (Before the first job): the `free 0` message says "Resuming jobs left by an earlier session is not supported yet". It is accurate, and it is a candidate follow-up job. No change needed.
- No dead code, debug output or scope creep in the rework diff. The deferred item (a friendlier `preflight` message outside a git repo) is correctly left out.

VERDICT: pass
