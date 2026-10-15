# UX reviewer review: Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Round: 1

## Summary
This is a CLI-only change. The "user" is a developer or the /factory orchestrator running `node scripts/board.mjs`. I checked the diff against spec.md. Inherited names such as `toString` and `constructor` now get the same "Unknown command" message, usage text and exit 2 as `bogus`. Before, they exited 0 silently, or exited 1 with a confusing "is not a function" error for `__proto__`.

## Findings
None.

## Checked
- `scripts/board.mjs`: the diff is exactly one line, `!commands[cmd]` became `!Object.hasOwn(commands, cmd)`. The message template, the `Commands:` list, USAGE and exit code 2 are untouched. The HELP and no-command branches still run before the check.
- Error copy: the message names the bad input and lists the valid commands, then prints usage. It is identical to the existing unknown-command behaviour, so it is consistent.
- Stdout and stderr: the new path writes to stdout only. The new test asserts stderr is empty, which matches the existing convention.
- Silent failure: the old behaviour of exiting 0 for `toString`, `constructor`, `hasOwnProperty` and `valueOf` is gone. This matters for orchestrator scripts that rely on the exit code.
- `tests/cli.test.mjs`: the new test covers all five spec names. It checks status 2, the first stdout line prefix, `Usage:` in the remaining output and empty stderr. It also asserts that `board.json` is not created. The test handles CRLF line endings, so it is safe on Windows.
- Real commands are unaffected, because every real command is an own property of `commands`. Per the build context, `npm test` passes 29/29.
- No UI, accessibility or loading-state surface is involved.

VERDICT: pass
