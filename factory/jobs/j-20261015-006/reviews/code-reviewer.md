# Code reviewer review: Fix park message branch wording when validate fails

- Job: j-20261015-006
- Round: 1

## Summary
Checked the diff against spec.md and build.md. Only step 6 of SKILL.md changed (one line) plus one new test. All acceptance criteria are met and `npm test` passes (38 tests, 0 failures).

## Findings
None.

## Checked
- AC1: the old unconditional phrase is gone from SKILL.md; the new test asserts this on the whole file.
- AC2: step 6 now says to check `git branch --show-current`. It gives `<mainBranch>` after the switch or when already on main (rollback paths), and `<branch>` when step 7 stopped early (validate errors or a failed switch). It still says the work is on `<branch>`.
- AC3: "three lines or fewer", job id, title, why, the uncommitted-records note, `/factory approve <id>` and `/factory rework <id> <note>` are all still in step 6.
- AC4: `git diff --stat` shows a one-line SKILL.md change, in step 6 only. Step 7 item 2 is untouched and its "step 6 message" reference still reads correctly. `.claude/`, `scripts/` and the agents are untouched.
- AC5: the test uses node:test, `read()` (which uses node:path) and the same `assert.ok(includes)` style as its neighbours. Slicing between the `### 6.` and `### 7.` headings is guarded by `start !== -1 && end > start`. All asserted strings are single-line, so CRLF checkouts are safe (the file has no CR now, and no multi-line matches are used). The existing tests are unchanged.
- No debug output, dead code or commented-out blocks.
- Ran `npm test`: 38 pass, 0 fail.

VERDICT: pass
