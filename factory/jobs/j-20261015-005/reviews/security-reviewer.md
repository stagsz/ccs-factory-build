# Security reviewer review: Commit factory records after each job

- Job: j-20261015-005
- Round: 2

## Summary
I re-reviewed the full `main...branch` diff after rework 1 (commit 2c1d9e1). Both should-fix findings from round 1 are fixed. A `reset --keep` error now stops the flow before step 7 and bans a `--hard` retry. A rework merge conflict now aborts and hands off to the human. The `pr`-mode push note is reworded accurately. Rework 1 adds no new git-safety problem: every new failure path stops and tells the user, and none of them uses `--force`, `stash`, `--hard`, a push or a history rewrite. `npm test` passes (37/37).

## Findings
- **note** `claude-setup/skills/factory/SKILL.md:107`: the Rules line says the only allowed history rewrite is "the `git reset --keep ORIG_HEAD` rollback in step 5". `/factory approve` (line 96) now spells out the same rollback. That is still step 5's merge rule in substance, so this is not a permission gap. Fix (optional): "in step 5 and `/factory approve`".
- **note** `claude-setup/skills/factory/SKILL.md:87` and `:91`: if `validate` fails, step 7 skips the switch. The step 6 message then says the repo is left on `<mainBranch>`, but it is still on the job branch. This has no security impact, since nothing is committed and the tree stays dirty for the human. It is a wording inaccuracy for the UX reviewer to weigh.

## Round 1 findings
- Fixed: `SKILL.md:77` `reset --keep` abort. The text now says "If `reset --keep` reports an error, stop and tell the user: do not run step 7, and never retry with `--hard`." Line 96 (approve) has the same rule. Step 7 can no longer record on top of a failing merge.
- Fixed: `SKILL.md:98` rework merge conflict. The text now says to run `git merge --abort`, switch back to `<mainBranch>` and tell the user, and not to resolve conflicts. This happens before `board.mjs rework`, so the board is unchanged. The branch never commits factory files, so after the abort both trees are clean and the switch back cannot fail.
- Fixed (note): `SKILL.md:92` now reads "Never push main yourself". It explains that in `pr` mode, record commits reach origin through a later job branch. The records hold no credentials, so this exposes no data.

## Checked
- Secrets, tokens or keys in the three changed files: none.
- Injection: `<id>` comes from `board.mjs`'s fixed `j-YYYYMMDD-NNN` format, and `git add` uses fixed paths. There is no new interpolation of user-supplied text into shell commands. The `--note` args are unchanged.
- New failure paths added in rework 1:
  - step 7 validate failure: skips the commit, so a bad board is never committed
  - step 7 switch failure: stops, with no `stash` and no `--force`
  - reset error: stops, never `--hard`
  - rework merge conflict: aborts and stops
  - approve rollback: no `stage` call, so no attempt to work around the board error
- Force-push and history rewrite: none added. `reset --hard` is absent from SKILL.md, and the test asserts that.
- Push behaviour: still the single existing `pr`-mode branch push. No push of main.
- Permission scope: only the orchestrator commits `factory/` paths, as the spec asks. The builder's scope is narrowed: no staging under `factory/`, stage by path, and no `git add -A` or `git add .`.
- `/factory rework` change (beyond spec, accepted in round 1): it is still local-only. It merges without rewriting history and is now guarded on conflict.
- `tests/skill.test.mjs`: it reads two fixed files through `node:path`, with no eval, no dynamic import and no new dependencies.
- `npm test`: 37 pass, 0 fail.
- Logging and error messages: unchanged.

VERDICT: pass
