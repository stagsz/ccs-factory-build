# Spec: Add a history command to the board CLI

- Job: j-20261015-008
- Branch: factory/j-20261015-008-add-a-history-command-to-the-board-cli

## Goal
`node scripts/board.mjs history <id>` prints a readable stage history for one job: its id, title and branch, then one aligned line per history entry (timestamp, stage, note), oldest first.

## Context
- `scripts/board.mjs`: `commands` map (`show` at ~L145, `list` at ~L150), `USAGE` block (L12-25). Errors thrown inside a command go to stderr as `error: <message>` and exit 1 (L178-183).
- `scripts/lib/board.mjs`: `findJob(board, id)` (L129) throws `No job with id <id>.`; `formatJobList(board)` (L317-325) is the pattern to copy (pure, sorts a copy, aligned columns, two-space gaps, last column unpadded). History entries are `{ stage, at, note }` (L123, L149); jobs carry `id`, `title`, `branch`.
- `tests/board.test.mjs` `formatJobList` tests (L240-277); `tests/cli.test.mjs` `setup()` (L14), `list` tests (L183-203), and the `allCommands` drift guard (L119).

## Acceptance criteria
- [ ] `scripts/lib/board.mjs` exports a pure `formatJobHistory(job)` placed directly after `formatJobList`. It does not mutate `job` or `job.history`.
- [ ] Output is exactly, joined with `\n`, no trailing newline:
  1. `<id>  <title>`
  2. `Branch: <branch>`
  3. empty line
  4. header `AT  STAGE  NOTE` with columns padded
  5. one row per history entry: `at`, `stage`, `note`
- [ ] Rows are sorted by `at` ascending on a copy (stable for equal timestamps). AT and STAGE columns are padded to the widest value including the header, joined by two spaces; NOTE is last and unpadded; no line has trailing whitespace (an empty note ends the line after the stage).
- [ ] If `job.history` is missing or empty, line 4 onward is replaced by the single line `No history.`.
- [ ] `history <id>` in `scripts/board.mjs` loads the board, calls `B.findJob`, prints `B.formatJobHistory(job)` via `out`, and does not write `board.json`.
- [ ] Unknown id: stderr is `error: No job with id <id>.`, stdout is empty, exit code 1 (same path as `show <id>`).
- [ ] Missing id (`history` with no argument): throws so stderr is `error: history needs a job id. Usage: node scripts/board.mjs history <id>`, stdout is empty, exit code 1. It must not print `No job with id undefined.`
- [ ] `USAGE` gains `  history <id>` with the description `print one job's stage history, oldest first`, placed after `list` and aligned with the other descriptions.
- [ ] `npm test` passes.

## Out of scope
- `claude-setup/` (including SKILL.md and `/factory status`), `.claude/`, and everything under `factory/`.
- Changing `show`, `list`, the unknown-flag behaviour of other subcommands, or the `findJob` message.
- New dependencies, stage/transition changes, dashboard changes.

## Tests
- `tests/board.test.mjs`:
  - `formatJobHistory` exact-string test with mixed-width stages and an empty note; also checks there is no trailing whitespace and no trailing newline.
  - Sort test: out-of-order `at` values plus a tie; the input `history` array is deep-equal and reference-equal afterwards.
  - Empty and missing history both give `No history.`.
- `tests/cli.test.mjs`:
  - Add `"history"` to `allCommands`.
  - `history <id>` after `init`, `new` and `stage spec`: checks lines 1-2, the header regex, the `queued` and `spec` rows in order, and that `board.json` is byte-identical.
  - Unknown id: use `spawnSync` to check exit 1, empty stdout, and that stderr matches `No job with id`.
  - No id: use `spawnSync` to check exit 1, empty stdout, and that stderr matches `history needs a job id`.

## Risks
- None. The command is read-only and adds no config or data changes. The `USAGE` text is checked by the drift-guard test, so the new line must start with `  history`.

## Assumptions
- "Existing unknown job style message" means reusing `findJob`'s `No job with id <id>.` and the CLI's generic error path (exit 1).
- A missing id is a usage error raised from inside the command (exit 1), not the top-level exit 2. This keeps the change local to `history`.
- `history --help` is treated as an id, so it fails with `No job with id --help.` and exit 1. That is a clear error and matches the scope limit.
- "Oldest first" means sorting by `at`. History is append-only, so this normally matches the array order.
