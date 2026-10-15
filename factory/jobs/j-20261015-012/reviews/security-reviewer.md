# Security reviewer review: Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Round: 2

## Summary
This round covers rework 1 (`git diff 73ea6fe..c310876`): SKILL.md wording, one quoting line in each agent file, and one new test in `tests/skill.test.mjs`. I re-checked the full `main...branch` diff stat and found no code changes outside those files since round 1.

The rework adds no git commands, no `--force`/`--hard`/`clean`/`stash`/push, and no new code paths. Two of my round-1 notes were handled: quoting and the "merge refused" path. The new refused-merge rule is safer than what it replaces, because a refused merge can no longer be recorded as `merged`. One gap is left in how it tells "refused" apart from "started but failed". It needs a repo-level merge hook to trigger and does not widen who can merge, so it is a note.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md:94, 138`: the orchestrator now picks the branch from git's message: "reports conflicts" leads to `merge --abort`, and "exits non-zero without starting a merge" leads to "nothing to abort". `git merge --no-ff` can also exit non-zero after it has applied the merge to the index with `MERGE_HEAD` set and no conflicts. That happens when a `pre-merge-commit` or `commit-msg` hook rejects it, for example a commitlint hook that rejects `factory: <title> (<id>)`.
  - If the orchestrator files that under "refused", nothing is aborted, and step 7's `git add factory/... && git commit -m "factory: record <id>"` then concludes the merge. The branch lands on main untested, and the board says `needs-human`.
  - If it files it under neither case, it falls through to "Otherwise run the test command" and `merged`, which is the pre-rework behaviour.
  - In both cases the merge had already been authorised (by `decide-merge` or by `/factory approve`), so no authorization is widened. The risks are untested code on main and a board that is wrong.

  Fix (optional, follow-up): decide by repo state, not by the message: "If `git merge` exits non-zero: if `git rev-parse -q --verify MERGE_HEAD` succeeds, run `git merge --abort`; then `needs-human` with git's first error line."
- **note** `claude-setup/skills/factory/SKILL.md:94`: `--note "merge refused: <git message>"` puts git output inside a double-quoted shell argument.
  - Git's refusal message lists file paths that are dirty in the main checkout and touched by the branch. Preflight limits those to factory-generated record names, so the injection surface is very small in practice.
  - The message is multi-line and can contain `"`, `$` or backticks.
  - The dashboard escapes `history[].note` (`dashboard/index.html:73, 101`), so it is not an XSS sink.

  Fix (optional): "use git's first `error:` line, with quotes, `$` and backticks removed".
- **note** `claude-setup/skills/factory/SKILL.md:43` and the Input line of each agent file: the quoting rule resolves my round-1 note. The command literals stay unquoted because the spec pins them, and the rule sits next to them, which is acceptable. Double quotes keep Windows backslashes (`\U`, `\s`, `\.`) but still expand `$` and backticks and collapse a leading `\\` (UNC). That is irrelevant for the default `.worktrees` under a normal user path. No fix needed.
- **note** Round-1 notes that were not handled are still optional follow-ups, and none of them blocks this job:
  - `worktreePath` id format check (`scripts/lib/board.mjs:329-335`)
  - listing `factory/jobs/<id>/` before `git add` in step 7
  - `runAt` env scrubbing (`tests/cli.test.mjs:495-501`)

## Checked
- Rework diff `73ea6fe..c310876` in full: 8 files, +42/-7.
- SKILL.md has no `--force`, `--hard`, `git clean`, `stash`, `--no-verify` or new push.
  - Step 7.4 still forbids `--force` and deleting by hand.
  - `reset --keep ORIG_HEAD` is unchanged, and "never retry with `--hard`" is kept in both step 5 and `approve`.
- Refused-merge path (step 5 and `/factory approve`): it never reaches tests or `merged`, runs step 7 then step 6, and keeps the worktree for `needs-human`. The approve variant leaves the stage alone and only relays git's message.
- Park template (step 6): it shows `<id>`, `<title>`, `<why>`, `<branch>` and `<worktree>` to the user only. It contains no secrets and is not interpolated into shell. The merge-conflict line 3 tells the human to resolve conflicts in `<worktree>`, which is the existing rework flow; the orchestrator still never resolves conflicts itself.
- No-free-slot and "Started <k> of <n>" messages: text to the user only. Running `slots` before every new job tightens the cap and does not loosen it.
- Spec-approval wording: the job keeps its slot, so a parked spec cannot be used to go over `maxJobs`.
- Step 7.1 addition (worktree left in place): text only.
- Agent files: one identical Input line each. No change to the VERDICT/RISK/DECISION wording, the builder's `factory/` prohibitions, or "read-only git commands only".
- `tests/skill.test.mjs`: the new test only reads SKILL.md and makes no git or filesystem writes. `node --test tests/skill.test.mjs` gives 8/8 passing.
- Dashboard: `history[].note` and every other board field are passed through `esc()` before `innerHTML`.
- Full `main...branch` diff stat: 15 files, the same set as round 1. `.claude/`, `package.json` and the dashboard are untouched, and there are no new dependencies or secrets.

VERDICT: pass
