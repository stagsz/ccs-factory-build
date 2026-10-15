# Spec: Add a list command to the board CLI

- Job: j-20261015-003
- Branch: factory/j-20261015-003-add-a-list-command-to-the-board-cli

## Goal
`node scripts/board.mjs list` prints every job on the board as one line in an aligned plain-text table (id, stage, rework count, title), oldest first and newest last. On an empty board it prints `No jobs.`. It never writes anything.

## Context
- `scripts/board.mjs`: `USAGE` constant (lines 12-24) is the single source of truth for the command list. Commands live in the `commands` object and are dispatched through `Object.hasOwn(commands, cmd)`. `out()` writes a string plus `\n`. `show` (line 139) is the existing read-only command to copy: it only calls `B.loadBoard(root)`.
- `scripts/lib/board.mjs`: `loadBoard` returns `emptyBoard()` (`{ version, updatedAt, jobs: [] }`) when `board.json` is missing. `createJob` pushes jobs in creation order with `id`, `title`, `stage`, `rework` (number) and `createdAt` (ISO string).
- `tests/board.test.mjs` imports `* as B` from the lib. `tests/cli.test.mjs` has `setup()/run()` (run trims stdout), an `allCommands` array (line 78) checked against help output, and a drift guard that checks every `commands` key appears in USAGE.

## Acceptance criteria
- [ ] `scripts/lib/board.mjs` exports a pure function `formatJobList(board)` that returns a string and does no IO. It must not mutate `board` or `board.jobs` (sort a copy).
- [ ] When `board.jobs` is empty, `formatJobList` returns exactly `No jobs.`.
- [ ] Otherwise it returns a header line `ID  STAGE  REWORK  TITLE` followed by one line per job, joined with `\n` and with no trailing newline.
- [ ] Each column is left-aligned and padded with spaces to the width of its widest cell, header included. Columns are separated by two spaces. TITLE is the last column and is not padded, so no line has trailing whitespace.
- [ ] Rows are sorted by `createdAt` ascending (newest last). The sort is stable, so jobs with equal `createdAt` keep their board order.
- [ ] `scripts/board.mjs` has a `list` command that does `out(B.formatJobList(B.loadBoard(root)))`. It does not load config, does not call `saveBoard` and does not create `factory/board.json` if it is missing (in that case it prints `No jobs.` and exits 0).
- [ ] `USAGE` has a `list` line in the same two-space-indented, column-aligned format, placed next to `show`, e.g. `  list                                   print one line per job (id, stage, rework, title)`.
- [ ] All existing commands keep their output and exit codes. `npm test` passes.

## Out of scope
- Filtering, sorting or JSON options for `list` (e.g. `--stage`, `--json`).
- Changes to `show`, `validate`, other commands, the board shape, `STAGES`/`TRANSITIONS`, the dashboard, or `claude-setup/skills/factory/SKILL.md`.
- Truncating long titles or detecting terminal width.

## Tests
- `tests/board.test.mjs`: tests for `formatJobList`:
  - empty board returns `No jobs.`
  - multi-job board with ids/stages/titles of different lengths, plus a two-digit rework count. Assert the exact expected string: header, alignment, two-space gaps, no trailing whitespace.
  - jobs given out of `createdAt` order come out newest last
  - the input `board.jobs` array is unchanged after the call (order and contents)
- `tests/cli.test.mjs`:
  - add `"list"` to `allCommands`
  - new test: `list` in a fresh temp repo with no `board.json` prints `No jobs.` and leaves `board.json` absent
  - new test: after `init` and two `new` jobs (move one with `stage <id> spec`), `list` prints a header plus two rows in creation order. Each row contains its id, stage, rework `0` and title. The `board.json` bytes are identical before and after `list`.

## Risks
- None. This is a read-only CLI addition. The CLI is internal to the orchestrator, and it is a new command, so no existing output contract changes.

## Assumptions
- "Aligned plain-text table" includes a header row (`ID  STAGE  REWORK  TITLE`). The empty-board case prints only `No jobs.` with no header.
- "Newest last" means ascending `createdAt`, which matches board order for boards written by `createJob`.
- Titles are printed as stored, with no escaping or truncation.
- The function takes the whole board, not `board.jobs`, to match the other lib helpers that take `board`.
