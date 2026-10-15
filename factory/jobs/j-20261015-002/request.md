# Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Branch: factory/j-20261015-002-use-object-hasown-for-unknown-command-ch
- Source: cli
- Created: 2026-10-15T17:21:35.160Z

## Request

In scripts/board.mjs the dispatch checks `!commands[cmd]`, so names inherited from Object.prototype (toString, constructor, hasOwnProperty, __proto__, valueOf) are not treated as unknown: they skip the 'Unknown command' message and either run or fall into the error handler with exit 1. Use Object.hasOwn(commands, cmd) so those names behave like any other unknown command (message + usage, exit 2). Add tests in tests/cli.test.mjs. Flagged as a follow-up by the builder and reviewers of j-20261015-001.
