# Code reviewer review: Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Round: 1

## Summary
The diff is a one-line change in `scripts/board.mjs` plus one new test in `tests/cli.test.mjs`. I checked each acceptance criterion against the diff and re-ran `npm test` (29/29 pass). No problems found.

## Findings
None.

## Checked
- AC1: `scripts/board.mjs:163` is now `if (!Object.hasOwn(commands, cmd))`. It is the only changed line in that file (1 insertion, 1 deletion). Met.
- AC2: the new test loops over `toString`, `constructor`, `hasOwnProperty`, `__proto__` and `valueOf`. For each it checks status 2, the first stdout line via `startsWith`, `Usage:` in the remaining lines, and empty stderr. Met. After the loop it asserts `factory/board.json` does not exist, as the spec asks.
- AC3: the message template, `Object.keys(commands)` list, USAGE, help handling and no-command handling are untouched in the diff. `Object.hasOwn` is true for every real command key, so real command behaviour is unchanged. Met.
- AC4: no existing test was modified (the diff only adds lines to the test file), and `npm test` is green with 29 pass and 0 fail. Met.
- Test quality: the `fs` and `path` imports the test uses are already present. The test would fail on the old check, because those names would exit 0 or 1 instead of 2. The builder reports confirming this by reverting the fix. `startsWith` avoids regex-escaping `__proto__`.
- Scope: no files outside the spec were changed. There is no dead code, debug output or commented-out code.
- Cross-platform: the stdout split uses `/\r?\n/`, and the paths use `node:path`.

VERDICT: pass
