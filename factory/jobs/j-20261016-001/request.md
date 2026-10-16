# Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Branch: factory/j-20261016-001-split-the-step-5-local-merge-bullet-into
- Source: backlog
- Created: 2026-10-16T09:59:18.494Z

## Request

In claude-setup/skills/factory/SKILL.md, step 5 `local` is one long bullet holding the merge command, the MERGE_HEAD rule for any non-zero `git merge` exit, the `<git line>` definition, and the test-on-main / `reset --keep ORIG_HEAD` rollback. Split it into nested sub-bullets (merge command; on non-zero exit: MERGE_HEAD set / MERGE_HEAD unset; `<git line>` definition; on exit 0: tests on main and rollback) so each rule sits in the branch it belongs to; in particular the "if `git merge --abort` fails, stop and do not run step 7" rule must sit inside the MERGE_HEAD-set branch, before that branch runs step 7. Wording change only: keep every rule and its meaning, keep the phrases tests/skill.test.mjs pins (update the test only where a pinned substring has to move or change), and do not edit .claude/. Depends on j-20261015-013 being merged first.
