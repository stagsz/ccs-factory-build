# Security reviewer review: Add a list command to the board CLI

- Job: j-20261015-003
- Round: 1

## Summary
I checked the four changed files (+79/-1) for secrets, injection, privilege widening, unsafe parsing, new dependencies and data leakage. The new `list` command only reads. It calls `B.loadBoard(root)` and a pure formatter, never writes, and never creates `board.json`. It adds no new inputs, dependencies or file paths, and it does nothing the spec did not ask for. The one note is low-risk and the spec already accepts it.

## Findings
- **note** `scripts/lib/board.mjs:301`: `formatJobList` prints `j.title` as stored, with no escaping. `createJob` (`scripts/lib/board.mjs:107-113`) only trims the ends of a title. A title created through `new` could therefore contain an embedded newline or ANSI/terminal control sequences. In `list` output, such a title could fake an extra table row or change terminal output. `show` does not have this problem because it prints JSON, which escapes these characters. The spec chose this behaviour on purpose ("Titles are printed as stored, with no escaping"), board.json is a local file written by the orchestrator, and titles come from the operator or backlog. Exposure is low, so this is not a blocker. Fix (optional, a future job): replace control characters (`/[\x00-\x1f\x7f]/g`) in cells before formatting, or reject them in `createJob`.

## Checked
- Secrets: none added in code, tests or fixtures. Test data is synthetic ids, stages, titles and timestamps.
- Injection: no shell, SQL, template or HTML sinks. `list` takes no arguments. `root` comes from the existing `FACTORY_ROOT`/cwd logic, which this change does not touch. No new path building. The test `RegExp` uses generated job ids (`j-YYYYMMDD-NNN`) in test code only.
- Authorization and scope: the only new capability is read-only output of fields `show` already exposes (id, stage, rework, title). It does not call `loadConfig` or `saveBoard`, and it does not write files. The CLI tests check that board.json is still absent, and that its bytes are identical before and after `list`. Nothing outside the spec.
- Input validation and deserialization: no new parsing. It reuses the existing `JSON.parse` in `loadBoard`. No `eval` and no dynamic imports.
- Dependencies: none added. package.json and the lockfile are unchanged.
- Logging and error output: no new logging. No credentials or personal data beyond job titles, which `show` already prints.
- Dispatch: `list` is a plain key in `commands`, so the existing `Object.hasOwn` dispatch guard still applies.

VERDICT: pass
