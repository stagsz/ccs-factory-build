# Build report: Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Branch: factory/j-20261015-002-use-object-hasown-for-unknown-command-ch
- Last commit: bcb350a

## Files changed
- `scripts/board.mjs`: line 163 `if (!commands[cmd])` -> `if (!Object.hasOwn(commands, cmd))`. One line, nothing else in the file touched.
- `tests/cli.test.mjs`: new test "names inherited from Object.prototype are unknown commands".

## Acceptance criteria
- [x] Line 163 becomes `if (!Object.hasOwn(commands, cmd))`, diff touches only that line: `git diff main -- scripts/board.mjs` shows a single `-`/`+` pair.
- [x] `toString`, `constructor`, `hasOwnProperty`, `__proto__`, `valueOf` exit 2, first stdout line is `Unknown command "<name>". Commands: <list>`, followed by USAGE, stderr empty: covered by the new test, which loops over all five names and checks `e.status === 2`, `first.startsWith(...)`, `Usage:` in the rest, and `e.stderr === ""`.
- [x] Message template, `Object.keys(commands)` list, USAGE, help handling, no-command handling and real-command exit codes unchanged: none of those lines were edited; existing tests for help, no-command, `bogus` (including the USAGE drift guard) and the full CLI line still pass. Every real command is an own property of `commands`, so `Object.hasOwn` admits exactly the same real commands.
- [x] All existing tests pass unchanged and `npm test` is green: 29/29 pass; no existing test was modified.

## Tests
- Command: `npm test`
- Result: passed, 29 tests, 0 failures.
- Added or changed: `tests/cli.test.mjs` (one new test; also asserts `factory/board.json` is not created under the temp root, so the unknown-command path writes nothing).
- Verified the new test fails against the old `!commands[cmd]` check (temporarily reverted, ran it, 1 fail), then restored the fix.

## Notes
None.
