# Code reviewer review: Close backlog items when a job ends

- Job: j-20261015-007
- Round: 1

## Summary
Checked the diff against every acceptance criterion and re-ran `npm test` (48 pass, 0 fail). The implementation matches the spec: a pure `closeBacklogItem` in lib, IO-only wiring in the CLI, and tests that would fail if the behaviour broke.

## Findings
- **note** `scripts/board.mjs:92`: the CLI test for a missing file and a cli-source job both rely on the guard order; this is correct. A missing-backlog case that throws on read is avoided by `existsSync`. No change needed.
- **note** `scripts/lib/board.mjs:287`: if a backlog line mixes EOLs, `split(/\r?\n/)` and rejoin normalise to one EOL, but only when a match changed. This is the same behaviour as `markBacklogItem`. No change needed.

## Checked
- Criteria 1-4: exported pure function, throws on any mark other than "x" or "!", prefix-captured rewrite that changes only the checkbox, `trimEnd().endsWith("(id)")` exact match (j-1 vs j-11 tested both ways), returns the same string when unchanged, EOL and trailing newline preserved (LF and CRLF tests compare full strings).
- Criterion 5: `nextBacklogItem` regex untouched; new test covers `[!]`, `[x]`, `[~]`.
- Criteria 6-9: CLI closes only when `TERMINAL` and `source === "backlog"`, after `saveBoard`, writes only on change, skips when backlog.md is missing, stdout still `<id> -> <stage>` (asserted).
- Criterion 10: legend in the comment above `nextBacklogItem` and on the README `/factory next` row.
- Tests: the four CLI tests the spec lists exist and assert exact content; the cli-source test uses a lookalike `[~]` line and a byte comparison.
- Scope: only the five listed files changed; nothing under `factory/` was committed. Zero deps, `node:path`/`node:fs` only, no debug output or dead code.

VERDICT: pass
