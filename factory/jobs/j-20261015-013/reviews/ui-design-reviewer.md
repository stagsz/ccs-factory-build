# UI design reviewer review: Decide merge failures by MERGE_HEAD

- Job: j-20261015-013
- Round: 2

## Summary
The full diff (`main...HEAD`) touches only `claude-setup/skills/factory/SKILL.md` and `tests/skill.test.mjs`. `dashboard/` is untouched, so there is no UI change. I re-checked the rework diff (`90970df..7ac61bc`) for markdown consistency in SKILL.md. The round 1 finding is fixed.

## Findings
- **note** `claude-setup/skills/factory/SKILL.md` (step 5, `local` bullet): still one very long bullet, as before the job. Splitting it into nested sub-bullets is optional and not required for this change.

## Checked
- Round 1 "Then run" contradiction: the `/factory rework` paragraph now says "If the merge exits 0, run `node scripts/board.mjs rework ...`". This matches step 5's separate failure and success branches.
- `<git line>` is now referenced as "(as defined in step 5)" in both `/factory approve` and `/factory rework`. The definition, including the added backslash removal, lives in one place.
- Heading levels, bullet nesting, backtick code spans, `<placeholder>` style and the `"<worktree>"` quoting match neighbouring text. No lines were broken or reflowed.
- `git diff main...HEAD --stat` lists only the two files above. No dashboard, token or component changes.

VERDICT: pass
