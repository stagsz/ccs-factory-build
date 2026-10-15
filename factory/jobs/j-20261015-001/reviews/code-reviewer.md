# Code reviewer review: Add help command to board CLI

- Job: j-20261015-001
- Round: 1

## Summary
I checked the diff of `scripts/board.mjs` and `tests/cli.test.mjs` against every acceptance criterion in spec.md. I also ran `npm test` and got 28/28 passing. All criteria are met. I found no correctness problems and no scope creep.

## Acceptance criteria
- Single `USAGE` constant with the Usage line, all 11 original commands and a `help (also --help, -h)` line: met (`scripts/board.mjs` lines 12-26).
- Header comment reduced to a pointer, descriptions appear once: met (line 6).
- `help`, `--help`, `-h` write USAGE to stdout, nothing to stderr, exit 0, identical output: met. The `HELP` set is checked once, so the three aliases share one path. Tests assert equality, exit 0 and empty stderr.
- Help handled before the `commands` lookup, no filesystem IO: met. The only module-level work before it is `B.paths(root)`, which is pure. A test runs `help` in a bare temp directory and checks that no `factory/` is created.
- No command writes USAGE only and exits 2, without `Unknown command ""`: met.
- Unknown command prints the original template line, then USAGE, then exits 2: met.
- Every key of `commands` appears in USAGE: met. The drift-guard test covers it.
- Existing commands unchanged, existing tests unchanged, `npm test` green: met. The `commands` object and the try/catch are untouched.

## Findings
- **note** `scripts/board.mjs:~155`: `HELP.has(undefined)` is false, so the no-command path is reached correctly. No issue.
- **note** `tests/cli.test.mjs` (drift guard): it checks only that each `commands` key appears in USAGE. It does not check the reverse (a USAGE line with no matching command). The spec asks only for the first direction, so no change is needed.
- **note** `scripts/board.mjs:~163`: `!commands[cmd]` lets inherited names such as `toString` through. This is existing behavior and out of scope. The builder flagged it correctly as a follow-up.

## Checked
- Full diff `main...factory/j-20261015-001-add-help-command-to-board-cli`
- Dispatch order and exit codes for the help, no-command, unknown-command and existing-command paths
- That the new tests would fail if the feature broke: the regex, the stderr, exit status and no-`factory/` assertions are all specific
- No debug output, dead code or commented-out blocks left behind
- Windows/Linux safety: the tests use `node:path`, and the stdout split handles `\r?\n`
- `npm test`: 28 pass, 0 fail, 0 skipped

VERDICT: pass
