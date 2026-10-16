# UX reviewer review: Friendly preflight error outside a git repo

- Job: j-20261016-003
- Round: 1

## Summary
I checked the CLI message, its channel and its exit code against the spec. Running `preflight` in a non-repo temp dir printed exactly `error: preflight needs a git repository at <root>` on stderr and exited 1. `npm test` passes (124/124).

## Findings
- **note** `scripts/board.mjs:~252`: The message names the problem and the root path, but gives no next step such as "run git init". The spec fixes the exact wording, so this is not a defect. Fix: none needed.

## Checked
- Message format matches the other `error:` lines. All go through the single top-level catch (`board.mjs:297`, `error: ${err.message}` on stderr).
- The message includes the resolved root, from either cwd or FACTORY_ROOT. The test covers both.
- stdout stays empty. There is no `fatal:` or `Command failed` text. Exit code is 1, the same as every other failure.
- Other git failures (cwd inside `.git`) keep git's own error, and a test covers that case.
- The probe runs only after a status 128 failure, so the happy path is unchanged.
- Ran the CLI manually in a non-repo dir and got the expected output and exit 1.
- Ran the full `npm test` in the worktree.

VERDICT: pass
