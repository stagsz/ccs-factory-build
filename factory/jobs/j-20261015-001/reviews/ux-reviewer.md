# UX reviewer review: Add help command to board CLI

- Job: j-20261015-001
- Round: 1

## Summary
This is a CLI-only change, so I judged help text, error output, streams and exit codes as the user experience. The diff meets the spec. `help`, `--help` and `-h` print the usage and exit 0. A missing or unknown command now shows the usage and still exits 2. I found no problems that matter.

## Findings
- **note** `scripts/board.mjs:156-166`: The `Commands:` list in the unknown-command message does not include `help`, because `help` is not in `commands`. The usage block printed right after it does list `help`, so a user still sees it. This follows the spec's assumption, so no change is needed.
- **note** `scripts/board.mjs:157`: Help is handled before the `commands` lookup and does no filesystem IO, so it works with no `factory/` folder. The new test covers this. A developer who runs the tool in a fresh directory gets help rather than a crash.

## Checked
- Request fit: a developer who types `help`, `--help` or `-h` gets the usage. A bare invocation now shows usage instead of `Unknown command ""`, which is clearer.
- Copy: the usage text is the old header block verbatim, plus one line, `help (also --help, -h)  print this usage`. It uses no internal jargon and its columns line up.
- Streams and exit codes: all usage goes to stdout, as before. Help exits 0 and the error paths exit 2, so orchestrator callers see no change. Existing commands are untouched.
- Single source of truth: the header comment is reduced to a pointer, so the usage cannot drift from what the tool prints.
- Tests: they cover all three help aliases (equal output), no stderr output, no `factory/` folder, no-command and unknown-command output, and a drift guard between `commands` and the usage. I did not re-run `npm test`. The task context reports 28/28 passing.

VERDICT: pass
