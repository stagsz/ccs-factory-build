# Build report: Add help command to board CLI

- Job: j-20261015-001
- Branch: factory/j-20261015-001-add-help-command-to-board-cli
- Last commit: 35613e5

## Files changed
- `scripts/board.mjs`: Removed the command list from the header comment and replaced it with a pointer to USAGE / `node scripts/board.mjs help`. Added a module-level `USAGE` constant and a `HELP` set (`help`, `--help`, `-h`). Changed the dispatch so help is handled first, a missing command prints only USAGE, and an unknown command prints the existing line followed by USAGE.
- `tests/cli.test.mjs`: Added 4 tests covering help and its aliases, help in a bare directory, no command, and unknown command with a drift guard. Imported `spawnSync` so the bare-directory test can assert on stderr when the exit code is 0.

## Acceptance criteria
- [x] One module-level constant holds the usage text: `const USAGE` contains the `Usage: node scripts/board.mjs <command> [args]` line and all 11 command lines, with the same commands, arguments, descriptions and column alignment as the old header. It also has a new line: `help (also --help, -h)                 print this usage`.
- [x] The header comment no longer lists commands: it now reads ``// Usage: see USAGE below, or run `node scripts/board.mjs help`.`` I grepped the file for several description strings and each appears exactly once.
- [x] `help`, `--help` and `-h` write USAGE to stdout, write nothing to stderr, exit 0, and print identical output. The new tests assert equality, exit 0 and an empty stderr.
- [x] Help runs before the `commands` lookup and does no filesystem IO: the `HELP.has(cmd)` branch is the first check in the dispatch. Code at module level before it only calls `B.paths(root)`, which just joins paths. A test runs `help` in a fresh temp dir with no `factory/` folder and checks that no `factory/` folder is created.
- [x] No command prints USAGE and exits 2, without `Unknown command ""`: a separate `if (!cmd)` branch handles this, and a test covers it.
- [x] An unknown command prints the existing template, then USAGE, then exits 2: the `Unknown command "${cmd}". Commands: ${Object.keys(commands).join(", ")}` line is kept, followed by `out(USAGE)`. Since `cmd` is always set at this point, the `?? ""` fallback was dropped and the output is unchanged.
- [x] Every key of `commands` appears in USAGE: the unknown-command test reads the `Commands:` list from the first stdout line and checks that each name starts a `^  <name>\b` line in the usage part.
- [x] Existing commands are unchanged: the `commands` object and the try/catch around execution are untouched. All existing tests pass without changes.

## Tests
- Command: `npm test`
- Result: passed, 28/28 (0 failed, 0 skipped)
- Added or changed: `tests/cli.test.mjs` (4 new tests, none of the existing tests modified)

## Notes
- `help` is not added to the `commands` object, as the spec assumes. The `Commands:` list in the unknown-command message is therefore the same as before.
- The unknown-command check is still `!commands[cmd]`. This means inherited names such as `toString` or `constructor` still pass the check and get called, which is existing behavior. I did not switch to `Object.hasOwn` because changing that is outside this spec. It could be a follow-up job.
- The help path calls `process.exit(0)` right after `out(USAGE)`, the same way the existing unknown-command path exits after writing. USAGE is about 1 KB, well under any pipe buffer.
- No pre-existing test failures.
