# Spec: Add help command to board CLI

- Job: j-20261015-001
- Branch: factory/j-20261015-001-add-help-command-to-board-cli

## Goal
`node scripts/board.mjs help` (or `--help` / `-h`) prints the CLI's usage and exits 0. A missing or unknown command also shows that usage and still exits 2. The usage text exists in exactly one place in the source.

## Context
- `scripts/board.mjs` lines 6-17: the usage block lives only in the header comment ("Usage: node scripts/board.mjs <command> [args]" plus 11 command lines).
- `scripts/board.mjs` lines 149-153: the dispatch. If there is no command or the command is unknown, it calls `out()` (stdout) with `Unknown command "<cmd>". Commands: <Object.keys(commands)>` and then `process.exit(2)`. No help path exists.
- `tests/cli.test.mjs`: `setup()` returns `run(...args)`, which wraps `execFileSync` and trims stdout. A non-zero exit throws an error that carries `.status`, `.stdout` and `.stderr` (untrimmed).
- Placement: the usage text and help handling go in `scripts/board.mjs`, not `scripts/lib/board.mjs`. The usage text is presentation for the CLI only. It has no business logic and no state, and nothing else uses it. Putting it in the lib would break the rule that the lib holds the domain core and the CLI handles IO.

## Acceptance criteria
- [ ] `scripts/board.mjs` defines one module-level constant (for example `const USAGE = \`...\``). It holds the "Usage: node scripts/board.mjs <command> [args]" line and the full command list, with the same commands, arguments and descriptions as today's header comment, plus one line for `help` (aliases `--help`, `-h`).
- [ ] The header comment no longer contains the command list. It points to the constant or to `node scripts/board.mjs help` instead. The per-command description strings appear exactly once in the file.
- [ ] `node scripts/board.mjs help`, `--help` and `-h` each write USAGE to stdout, write nothing to stderr, exit 0, and produce identical output.
- [ ] Help is handled before the `commands` lookup and does no filesystem IO. It works in a directory that has no `factory/` folder.
- [ ] Running with no command writes USAGE to stdout and exits 2. It does not print `Unknown command ""`.
- [ ] An unknown command (for example `bogus`) writes `Unknown command "bogus". Commands: <list>` to stdout, using the same template as today, then USAGE, then exits 2.
- [ ] Every key of `commands` appears in USAGE.
- [ ] Every existing command behaves exactly as before. All existing tests pass unchanged, and `npm test` is green.

## Out of scope
- `scripts/lib/board.mjs`, the dashboard, SKILL.md, agent files, `factory/config.json`.
- Per-command help (`help <cmd>`), argument validation, and any change to existing command output or exit codes.
- Moving the unknown-command message to stderr.
- New dependencies.

## Tests
Add to `tests/cli.test.mjs`, reusing `setup()`:
- `help`, `--help` and `-h`: `run(...)` returns output that matches `/^Usage: node scripts\/board\.mjs/` and contains every command name (`init`, `new`, `next`, `stage`, `verdict`, `decide-review`, `rework`, `risk`, `decide-merge`, `show`, `validate`, `help`). All three outputs are equal. Run before `init` so the test also proves help needs no board.
- No command: `assert.throws(() => run(), (e) => e.status === 2 && /Usage:/.test(e.stdout) && !/Unknown command/.test(e.stdout))`.
- Unknown command: `assert.throws(() => run("bogus"), (e) => e.status === 2 && /Unknown command "bogus"\. Commands: /.test(e.stdout) && /Usage:/.test(e.stdout))`. Also parse the `Commands:` list from the first line of `e.stdout` and assert that each name appears in the usage part, as a drift guard between `commands` and USAGE.

## Risks
- None that touch auth, payments, migrations or config. The orchestrator calls this CLI, so the dispatch change must not alter output or exit codes for any existing command.

## Assumptions
- "Keep the usage text in one place" means a single string constant in the CLI, with the header comment reduced to a pointer. Parsing the script's own comment at runtime would be fragile, so the spec rules it out.
- With no command, the output is only the usage. `Unknown command ""` is dropped because no command was given. The exit code stays 2.
- All usage output goes to stdout, because the existing unknown-command message already does. The streams are not changed.
- `help` is not added to the `commands` object, so the `Commands:` list in the unknown-command message stays exactly as it is today.
