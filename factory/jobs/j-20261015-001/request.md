# Add help command to board CLI

- Job: j-20261015-001
- Branch: factory/j-20261015-001-add-help-command-to-board-cli
- Source: cli
- Created: 2026-10-15T16:51:23.679Z

## Request

Add a help command to scripts/board.mjs. `node scripts/board.mjs help`, `--help` and `-h` should print the usage block (the command list currently in the file's header comment) to stdout and exit 0. Running with no command should also print that usage, but keep exit code 2. An unknown command keeps exit code 2 and its error message, followed by the usage. Keep the usage text in one place so the header comment and the printed help cannot drift apart. Add tests in tests/cli.test.mjs.
