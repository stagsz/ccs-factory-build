# Code reviewer review: Add a list command to the board CLI

- Job: j-20261015-003
- Round: 1

## Summary
I checked the diff against every acceptance criterion in spec.md and re-ran `npm test` (34/34 pass). All criteria are met. `formatJobList` is pure, sorts a copy, aligns columns correctly and leaves no trailing whitespace. The `list` command is read-only. The tests assert the exact output and would fail if the feature broke.

## Findings
- **note** `tests/board.test.mjs` (sort test): the ids are parsed with `l.split(/\s+/)[0]`. This is fine for the fixtures used. It would break only if an id contained spaces, which `createJob` does not produce. No change needed.
- **note** `scripts/lib/board.mjs` (`formatJobList`): `createdAt` is compared as ISO strings with `<` and `>`. This is correct for uniform ISO-8601 UTC strings, which `createJob` writes. A missing `createdAt` compares as equal and keeps board order, so it does not throw. No change needed.

## Checked
- AC1: `formatJobList` is exported and pure. It uses `[...board.jobs].sort(...)`, and a test checks the array reference and contents are unchanged.
- AC2: an empty board returns `No jobs.` (unit test plus CLI test with no board.json).
- AC3 and AC4: the header and rows are joined with `\n`. Widths are computed over the header and all rows for the first three columns, and the title is not padded. The exact-string test covers different lengths and a two-digit rework.
- AC5: the sort is by `createdAt` ascending, with 0 on ties. The test covers ties and out-of-order input.
- AC6: the `list` command only calls `B.loadBoard(root)`. It does not load config or save. The CLI tests confirm board.json stays absent when missing and its bytes are unchanged after `list`.
- AC7: the `USAGE` line sits right after `show` and is aligned. `allCommands` includes `list`, so the help test and drift guard cover it.
- AC8: only additions, no other commands touched. `npm test` passes.
- Scope: the 4 changed files match the spec. No debug output, dead code or commented-out blocks. The style fits the repo, with logic in the lib and IO only in the CLI.

VERDICT: pass
