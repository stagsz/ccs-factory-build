# Add a list command to the board CLI

- Job: j-20261015-003
- Branch: factory/j-20261015-003-add-a-list-command-to-the-board-cli
- Source: backlog
- Created: 2026-10-15T17:31:11.301Z

## Request

Add `node scripts/board.mjs list` that prints one line per job (id, stage, rework count, title) as an aligned plain-text table, newest last, and "No jobs." when the board is empty. Read-only. Put the row formatting in scripts/lib/board.mjs as a pure function with unit tests in tests/board.test.mjs, add a CLI test in tests/cli.test.mjs, and add the command to USAGE.
