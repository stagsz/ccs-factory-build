# Add a history command to the board CLI

- Job: j-20261015-008
- Branch: factory/j-20261015-008-add-a-history-command-to-the-board-cli
- Source: backlog
- Created: 2026-10-15T19:28:57.392Z

## Request

`/factory status <id>` is meant to show one job's history, but the CLI only has `show <id>`, which dumps raw JSON. Add `node scripts/board.mjs history <id>` that prints the job's id, title and branch, then one aligned line per history entry (timestamp, stage, note), oldest first. Unknown id exits non-zero with the existing "unknown job" style message. Formatting goes in scripts/lib/board.mjs as a pure function next to `formatJobList`, with unit tests in tests/board.test.mjs, a CLI test in tests/cli.test.mjs, and a USAGE line. Do not change SKILL.md in this job.
