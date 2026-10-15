# Build report: Add a history command to the board CLI

- Job: j-20261015-008
- Branch: factory/j-20261015-008-add-a-history-command-to-the-board-cli
- Last commit: 18a92a5

## Files changed
- `scripts/lib/board.mjs`: new pure `formatJobHistory(job)` directly after `formatJobList`. It follows the same pattern: sort a copy, pad columns, two-space gaps, last column unpadded.
- `scripts/board.mjs`: new `history <id>` command and a `USAGE` line. The command throws a usage error when the id is missing, otherwise loads the board, calls `B.findJob` and prints the formatted history. It never saves.
- `tests/board.test.mjs`: three `formatJobHistory` tests (exact string, sort/purity, empty/missing history).
- `tests/cli.test.mjs`: `"history"` added to `allCommands`; three CLI tests (happy path read-only, unknown id, missing id).

## Acceptance criteria
- [x] Pure exported `formatJobHistory(job)` placed directly after `formatJobList`, does not mutate `job` or `job.history`: it sorts `[...history]`. The sort test checks that `job.history` is reference-equal and that `job` is deep-equal to a `structuredClone` taken before the call.
- [x] Exact output format, joined with `\n`, no trailing newline: `<id>  <title>`, `Branch: <branch>`, an empty line, the `AT  STAGE  NOTE` header, then one row per entry. The exact-string test covers this.
- [x] Rows sorted by `at` ascending on a copy, stable for ties. AT and STAGE are padded to the widest value including the header, NOTE is unpadded, and each line is `trimEnd()`ed so a row with an empty note ends after the stage. The tests check the tie order and that no line has trailing whitespace.
- [x] Missing or empty history gives `No history.` in place of line 4 onward. Both cases are tested.
- [x] `history <id>` loads the board, calls `B.findJob`, prints via `out`, and does not write `board.json`. The CLI test checks the file is byte-identical.
- [x] Unknown id: `findJob` throws, so the generic error path writes `error: No job with id <id>.` to stderr and exits 1 with empty stdout. Tested with `spawnSync`.
- [x] Missing id: throws `history needs a job id. Usage: node scripts/board.mjs history <id>` before `findJob`, giving exit 1, empty stdout and no `undefined`. Tested with `spawnSync`.
- [x] `USAGE` gains `  history <id>` with `print one job's stage history, oldest first`, after `list` and aligned at the same column as the other descriptions. The drift guard and help tests pass.
- [x] `npm test` passes.

## Tests
- Command: `npm test`
- Result: passed, 54/54 (0 fail, 0 skipped)
- Added or changed: `tests/board.test.mjs`, `tests/cli.test.mjs`

## Notes
- Trailing whitespace is removed with `trimEnd()` on each assembled line. This also trims trailing whitespace inside a note itself, which the "no line has trailing whitespace" criterion allows.
- I also ran it by hand against the real board (`node scripts/board.mjs history j-20261015-007`): the columns aligned and empty-note rows had no trailing spaces.
- Nothing under `factory/` was staged or committed.
