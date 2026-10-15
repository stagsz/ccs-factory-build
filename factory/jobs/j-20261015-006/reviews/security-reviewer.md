# Security reviewer review: Fix park message branch wording when validate fails

- Job: j-20261015-006
- Round: 1

## Summary
I reviewed `git diff main...factory/j-20261015-006-fix-park-message-branch-wording-when-val`. It changes only the step 6 wording in the orchestrator skill and adds one string-match test. Nothing in it is security-relevant. The only new instruction is a read-only `git branch --show-current`, which takes no user input.

## Findings
None.

## Checked
- `claude-setup/skills/factory/SKILL.md:83`: the step 6 rewrite. The new command `git branch --show-current` is read-only and has no interpolated arguments, so it adds no shell injection surface. It does not widen what the orchestrator can do (no new git write, merge, push or approval path). It does not change who can approve or rework a job. The `/factory approve <id>` and `/factory rework <id> <note>` handoff to the human is unchanged.
- `tests/skill.test.mjs:29-42`: the new test only reads the source SKILL.md through the existing `read` helper and runs `includes` checks. It has no file writes, no dynamic paths built from input, no eval and no fixtures.
- Secrets and tokens: none added in either file.
- Dependencies: none added. `package.json` is not in the diff.
- Logging and error messages: none added. The park message names a branch, which is not sensitive data.
- Scope: the diff touches only the two files the spec allows. `.claude/`, `scripts/`, `dashboard/`, `factory/config.json` and agent files are not changed, and nothing in it is security-relevant beyond what the spec asked for.

VERDICT: pass
