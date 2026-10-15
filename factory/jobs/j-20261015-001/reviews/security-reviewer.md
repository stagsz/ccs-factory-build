# Security reviewer review: Add help command to board CLI

- Job: j-20261015-001
- Round: 1

## Summary
I checked the diff to `scripts/board.mjs` and `tests/cli.test.mjs` against the spec for secrets, injection, privilege or behavior widening, input handling, dependencies and information leakage. The change adds a static usage string and a help branch at the top of the dispatch. It adds no new inputs, IO, dependencies or capabilities, and it stays within what the spec asked for. I found no security issues.

## Findings
- **note** `scripts/board.mjs:163`: The unknown-command check `!commands[cmd]` does not exclude inherited prototype names (`toString`, `constructor`, `__proto__`, ...). Those names skip the "Unknown command" path and either run a harmless built-in or throw inside the existing try/catch, which prints `error: <message>` and exits 1. This behavior existed before this diff and has no exploitable effect, because the CLI is only run locally by the orchestrator. The builder already flagged it in build.md. Fix (separate follow-up job, out of scope here): use `Object.hasOwn(commands, cmd)`.
- **note** `scripts/board.mjs:164`: `cmd` comes straight from argv and is echoed to stdout inside the unknown-command message. This was already the case before the diff. Nothing evaluates or interprets it (no shell, eval or filesystem use), so it is not an injection vector.

## Checked
- Secrets: no tokens, keys or credentials added to code or tests.
- Injection: USAGE is a static template literal with no interpolation. The help branch does no shell, path or eval work. `cmd` only reaches stdout and the existing `commands` lookup.
- Filesystem/IO: the help branch runs before any read or write. The only module-level code before it is `B.paths(root)` (`scripts/lib/board.mjs:41`), which only joins paths. The test confirms no `factory/` folder is created.
- Behavior widening: `help` is not added to `commands`. Exit codes and output for existing commands are unchanged (try/catch and the `commands` object are untouched). The no-command case still exits 2.
- Error messages: no new error output, and the existing `error: ${err.message}` handler is unchanged.
- Dependencies: none added. The test only adds `spawnSync` from `node:child_process`, called with `process.execPath` and a fixed argv (no shell).
- Tests: the temp directory comes from `fs.mkdtempSync` under `os.tmpdir()`, and no fixtures contain sensitive data.
- Logging: no personal data or credentials are written.

VERDICT: pass
