# UX reviewer review: Decide merge failures by MERGE_HEAD, not git's message

- Job: j-20261015-013
- Round: 2

## Summary
I re-read the rework diff (90970df..7ac61bc) against my two round-1 should-fix items. Both are resolved and the new wording reads unambiguously for the orchestrator and for the human. No new UX problems came from the rework.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md:94` (step 5 `local`): the new backslash rule in `<git line>` cleaning is a sound addition, because a trailing `\` would escape the closing quote of `--note "..."`. It is stated once, in the definition, and approve and rework now point back to it ("as defined in step 5"). No action needed.
- **note** `claude-setup/skills/factory/SKILL.md:110` (step 6 line 3): carried over from round 1. A hook rejection parked as "conflict or rejected merge" may still be told "would hit the same conflict". The spec says to keep that text, so this is not a blocker. A later job could add "or rejection".

Round-1 items:
- Rework success path: resolved. `/factory rework` now says "If the merge exits 0, run `node scripts/board.mjs rework ...`" directly after the stop instruction, so "stop, then rework anyway" can no longer be read from it.
- "In both cases" ambiguity in step 5: resolved. It now reads "In either branch never go on to the tests or `merged`", placed straight after the `merge refused` branch and before the abort-failure sentence. "Branch" clearly means MERGE_HEAD set or not set.
- Optional `<git line>` pointer: done in both the approve and rework bullets.

## Checked
- The rework diff in full: SKILL.md step 5, `/factory approve`, `/factory rework`, and the added assertions in `tests/skill.test.mjs`.
- The new tests pin the new substrings (backslashes, "In either branch", the rework success clause) and forbid the old "In both cases never go on to the tests".
- The abort-failure stop ("do not run step 7") is still present at all three merge sites.
- The rework bullet still uses "In both cases tell the user `<git line>`" for MERGE_HEAD set or not set. It follows the abort-failure sentence, but there it means the same two outcomes and the earlier sentence already gives the abort-failure stop. I read it as unambiguous, though "In either branch" there would match step 5. This is cosmetic.
- There is no end-user UI. I did not check accessibility.

VERDICT: pass
