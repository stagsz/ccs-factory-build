# Build report: Add a list command to the board CLI

- Job: j-20261015-003
- Branch: factory/j-20261015-003-add-a-list-command-to-the-board-cli
- Last commit: 6eb2ad3

## Files changed
- `scripts/lib/board.mjs`: new `formatJobList(board)` in a new "listing" section at the end of the file. It is a pure function that sorts a copy of `board.jobs` and builds the aligned table.
- `scripts/board.mjs`: new `list` command (`out(B.formatJobList(B.loadBoard(root)))`) placed after `show`. Also a `list` line in `USAGE`, directly after `show`.
- `tests/board.test.mjs`: three `formatJobList` tests: empty board; exact aligned output; sort order, stability and no mutation.
- `tests/cli.test.mjs`: `"list"` added to `allCommands`. Two new tests: `list` with no board.json, and `list` after init + two jobs.

## Acceptance criteria
- [x] Pure exported `formatJobList(board)` with no IO and no mutation: it uses `[...board.jobs].sort(...)` and only reads job fields. A test checks that `board.jobs` is the same array reference and is deep-equal to a `structuredClone` taken before the call.
- [x] Empty board returns exactly `No jobs.`: tested by `formatJobList: empty board prints No jobs.` and by the CLI test with no board.json.
- [x] Header `ID  STAGE  REWORK  TITLE` plus one line per job, joined with `\n` and no trailing newline: the exact-string test asserts this, including `!text.endsWith("\n")`.
- [x] Columns are left-aligned with `padEnd` to the widest cell (header included), separated by two spaces. TITLE is not padded, so no line has trailing whitespace. The exact-string test uses ids, stages and titles of different lengths plus a two-digit rework (`12`), and checks every line equals its `trimEnd()`.
- [x] Rows are sorted by `createdAt` ascending with a stable comparator (returns 0 on ties; `Array.prototype.sort` is stable in Node 22+). The test gives jobs out of order, with two equal timestamps, and expects `j-a, j-b1, j-b2, j-c`.
- [x] `list` command only calls `B.loadBoard(root)`. It does not call `loadConfig` or `saveBoard`. `loadBoard` returns `emptyBoard()` without writing when the file is missing. The CLI tests check that board.json is still absent after `list`, and that board.json bytes are identical before and after `list` (`Buffer.equals`).
- [x] `USAGE` has `  list                                   print one line per job (id, stage, rework, title)` right after `show`, aligned with the other lines. The existing drift guard and the `allCommands` help test both cover it.
- [x] Existing commands are unchanged (only additions). `npm test` passes, 34/34.

## Tests
- Command: `npm test`
- Result: passed, 34 tests, 0 failed
- Added or changed: `tests/board.test.mjs`, `tests/cli.test.mjs`
- Manual smoke run: `node scripts/board.mjs list` on this repo printed the three real jobs, aligned, with exit 0.

## Notes
- No trailing whitespace is possible on any line because `createJob` rejects empty titles and trims them, and TITLE is never padded.
- Uncommitted orchestrator files (`factory/board.json`, `factory/backlog.md`, `factory/jobs/`) were not staged or committed.
- No pre-existing test failures.

<!-- On rework, append below. Do not rewrite the sections above. -->
