# Code reviewer review: Commit factory records after each job

- Job: j-20261015-005
- Round: 2

## Summary
The round 1 defect is fixed. `/factory approve` now runs `git reset --keep ORIG_HEAD`, leaves the stage as `needs-human` and does not run `stage`, then runs step 7 and step 6. All seven acceptance criteria are still met, the git sequences are correct on every end-state path, and `npm test` passes (37/37, which I ran myself).

## Findings
- **note** `claude-setup/skills/factory/SKILL.md` step 7 and step 6: the validate-failure and switch-failure stops are consistent. The orchestrator tells the user the records are uncommitted and does not use stash or `--force`. This is a sound choice where the spec is silent.
- **note** `claude-setup/skills/factory/SKILL.md` `/factory rework`: the `git merge --no-edit <mainBranch>` on the job branch is outside the spec, but build.md justifies it. The merge runs before `board.mjs rework`, so a conflict leaves the board untouched and the tree clean after `merge --abort`. Reviewer diffs use `main...branch`, so merged-in factory files stay out of them. I accept it.
- **note** `tests/skill.test.mjs`: the tests are string-presence checks. They would fail if step 7, the `git add` line, `--keep` or the safe-stop wording were removed. They do not check that each end-state path says "run step 7". The spec does not require that. Optional.

## Checked
- Acceptance criteria against the diff:
  - Step 7 order (validate, switch, add, commit with `git diff --cached --quiet` skip): met.
  - "Not pushed" wording: met ("Never push main yourself").
  - Step 7 on every end-state path, with step 6 only after step 7: met.
    - Paths covered: step 3 failed, step 4 both needs-human routes, step 5 merged in `local` and `pr` mode, step 5 needs-human, rollback, and approve.
  - `reset --keep ORIG_HEAD` and the updated Rules line: met. `grep -c "reset --hard"` on SKILL.md returns 0.
  - Rules line on who commits factory files: met.
  - `builder.md` forbids both listed items: met.
  - `npm test`: met.
- Git sequences:
  - After `merge --no-ff`, `reset --keep ORIG_HEAD` is safe. The merge does not touch `board.json`, `backlog.md` or the untracked job folder.
  - On a rollback, the `stage needs-human` call runs from `merged`/`build` state against the intact board. The approve rollback skips `stage`, which avoids the rejected `needs-human -> needs-human` transition.
  - The `git switch <mainBranch>` in step 7 is safe from the job branch while the factory records are uncommitted. A reset error or switch error stops without recording, with no destructive fallback.
- Tests use `node:test`, `node:path` and `fileURLToPath`, so they are Windows and Linux safe. Existing tests are unchanged.
- Scope: only `SKILL.md`, `builder.md` and `tests/skill.test.mjs` changed. `.claude/`, `scripts/` and `factory/config.json` are untouched. No debug output or dead code.

VERDICT: pass
