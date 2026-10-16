# Code reviewer review: Split the step 5 local merge bullet into sub-bullets

- Job: j-20261016-001
- Round: 1

## Summary
I compared the old single-paragraph `local` bullet with the new nested structure sentence by sentence. Every rule is present with the same meaning, and the new text matches the spec's target block. The diff touches only SKILL.md (one hunk, line 94 replaced) and `tests/skill.test.mjs`. `npm test` in the worktree passes: 122 tests, 0 failures.

## Findings
- **note** `tests/skill.test.mjs` (new local-line assertion): `!localLine.includes("MERGE_HEAD")` is satisfied by any short `local` line, so it only guards against rule text being pasted back onto that line. That is what the spec asks for, so no change is needed.
- **note** `claude-setup/skills/factory/SKILL.md:96`: "In either branch never go on to the tests or `merged`." now comes before the two branches it refers to. This is the placement the spec chose and it still covers both branches. No change needed.

## Checked
- Old vs new rules, one by one:
  - Merge command: kept, with "Run" added.
  - Three example causes and "do not judge by git's message": kept.
  - `git rev-parse -q --verify MERGE_HEAD`: kept.
  - Succeeds branch: run `git merge --abort`, with the abort-failure rule now inline. It comes after the abort and before the `stage ... conflict or rejected merge` note and step 7. "Do not run step 7, because its commit would finish the untested merge" is word for word. "Do not resolve conflicts yourself" is kept.
  - Fails branch: `merge refused` note, step 7, then step 6. Kept.
  - "Never go on to tests or `merged`": moved to the parent bullet and still covers both branches.
  - `<git line>` definition: both cleaning clauses, the trailing-backslash reason and the fallback are kept.
  - Exit 0: run the tests on main. Kept.
  - Test failure: `reset --keep ORIG_HEAD`, why not `--hard`, stop on a `reset --keep` error and never retry with `--hard`, then the "tests failed on main after merge" note, step 7, step 6. Kept.
  - No rule, step or command was added.
- `git diff main...HEAD` shows only SKILL.md and `tests/skill.test.mjs`. Lines 95-96 (the `pr` bullet and the `Then ... merged` line) are unchanged. `.claude/` is untouched, and git status in the worktree is clean.
- The `/factory approve` and `/factory rework` pointers still resolve. The MERGE_HEAD check and the `<git line>` definition remain in step 5, and the rework-section pin at line 99 still passes.
- The old pin that broke, "...`merged`. If `git merge --abort` fails", is replaced by the spec's three assertions. The remaining positive and negative pins are unchanged and pass.
- The new order assertion would catch the regression you named. If the abort-failure rule moved out of the MERGE_HEAD-set branch, to before `If it succeeds, a merge started` or after `If it fails, nothing started`, then `started < abortFails < conflictNote < refused` would fail. Moving it behind the `conflict or rejected merge` note fails it too. All four `indexOf` anchors occur once in step 5, so the first-occurrence lookups are unambiguous.
- Node 22, ESM, `node:test` and zero dependencies are respected. There is no dead code and no debug output.

VERDICT: pass
