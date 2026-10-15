# Code reviewer review: Pin line endings for factory files

- Job: j-20261015-004
- Round: 1

## Summary
I checked the diff against every acceptance criterion in spec.md and re-ran the git commands. The branch adds only `.gitattributes`. It has one comment line plus the five required rules in the required order, and the file is LF in the index. The attribute checks match the spec.

## Findings
None.

## Checked
- AC1: `.gitattributes` is at the repo root. The five rules match the spec text and order. The only extra is a leading `#` comment, which the spec allows. `git ls-files --eol` shows `i/lf` for it.
- AC2: `git diff --name-status main...<branch>` gives only `A .gitattributes`. No other file is added, modified or renormalised.
- AC3: `git check-attr text eol` gives `text: set` and `eol: lf` for README.md, package.json, scripts/board.mjs, dashboard/index.html and factory/jobs/x/spec.md.
- AC4: `.gitignore` gives `text: auto` and `eol: unspecified`.
- AC5: `git ls-files --eol` index column is 60 `i/lf` and 1 `i/none` (the empty `.gitkeep`). The builder's listing shows `attr/text eol=lf` on the four named types. I did not recount that column myself.
- AC6: the orchestrator reports `npm test` at 34/34. I did not re-run it, because the change is git configuration only.
- AC7: build.md records the check-attr output and the ls-files summary, including the 4 out-of-scope `w/crlf` files.
- Scope: no stray files, debug output or commented-out blocks. No test was added, as the spec directs. The `.gitattributes` staging warning is explained in build.md and is expected.

VERDICT: pass
