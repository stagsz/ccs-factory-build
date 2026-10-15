# Code reviewer review: Add a history command to the board CLI

- Job: j-20261015-008
- Round: 1

## Summary
Read spec.md, build.md and the full diff. Every acceptance criterion is met. I ran `npm test`: 54 pass, 0 fail, 0 skipped. The change stays inside the four listed files, adds no dependencies and leaves no debug output or dead code.

## Findings
- **note** `scripts/lib/board.mjs:337`: `trimEnd()` on each row also trims trailing whitespace inside a note. The spec's "no line has trailing whitespace" allows this, and build.md says so. No change needed.
- **note** `scripts/lib/board.mjs:333`: the comparator compares `at` as strings. This is correct for ISO timestamps, which is what `at` holds, and `Array.prototype.sort` is stable. No change needed.

## Checked
- Acceptance criteria, all met:
  - `formatJobHistory` is exported directly after `formatJobList`, is pure, and sorts a copy (`[...history]`).
  - The output layout is header, `Branch:`, empty line, `AT  STAGE  NOTE`, then rows, joined with `\n` and with no trailing newline.
  - AT and STAGE are padded to the widest value including the header. NOTE is unpadded. An empty note ends the line after the stage.
  - Missing or empty history (`?? []`) gives `No history.` in place of line 4 onward.
  - The `history` command throws the exact missing-id message before `findJob`, so `undefined` never appears.
  - An unknown id goes through `findJob` and the generic error path (stderr `error: ...`, exit 1).
  - The command never saves.
  - The `USAGE` line follows `list` and is aligned with the other descriptions.
  - `npm test` passes.
- Tests:
  - The exact-string test uses mixed-width stages and an empty note. It would fail if the padding, header or trailing-whitespace handling broke.
  - The sort test covers out-of-order timestamps, a tie, reference equality and deep equality.
  - The empty and missing history test checks both cases.
  - The CLI tests check read-only behaviour (byte-identical `board.json`), the unknown id and the missing id, each with exit code, empty stdout and stderr.
  - `"history"` is added to the `allCommands` drift guard.
- Conventions: pure logic in `scripts/lib/board.mjs`, the CLI only does IO, zero dependencies, no hard-coded path separators. The new code matches the `formatJobList` pattern.
- Scope: nothing outside the spec was changed, and nothing under `factory/` was committed.

VERDICT: pass
