# Approval: Add help command to board CLI

- Job: j-20261015-001
- Branch: factory/j-20261015-001-add-help-command-to-board-cli
- Rework cycles: 0

## What changed
`scripts/board.mjs` now keeps its usage text in a single `USAGE` constant, and the header comment points to it instead of repeating it. `help`, `--help` and `-h` print the usage and exit 0. Running with no command prints only the usage and exits 2. An unknown command prints the same `Unknown command ...` line as before, then the usage, and exits 2. `tests/cli.test.mjs` adds 4 tests: the three aliases give identical output, help works with no `factory/` folder and writes nothing to stderr, the no-command case is covered, and the unknown-command test checks that every key of `commands` appears in USAGE.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- The change touches 2 files (+75/-15), well under the 15-file limit. Neither file matches any `alwaysEscalatePaths` entry, and there are no auth, payments, migration, CI, dependency or factory config changes.
- The diff matches the spec and contains nothing else. The `commands` object and the try/catch around it are untouched, so every existing command keeps its output and exit code. The help branch runs before any filesystem IO.
- `npm test` passes 28/28, and the new tests would fail if the feature broke.
- The orchestrator depends on this CLI. The only change on its paths is the extra usage lines after an unknown-command message, and the exit code there is still 2. A bad merge would show up at once in CLI output and could be reverted with one commit.
- Follow-up, not a blocker: `!commands[cmd]` still lets inherited names such as `toString` through. This existed before the change and was flagged by the builder and two reviewers. Fix it in a separate job with `Object.hasOwn`.

RISK: low
DECISION: merge
