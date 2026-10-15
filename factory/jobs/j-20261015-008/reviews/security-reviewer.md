# Security reviewer review: Add a history command to the board CLI

- Job: j-20261015-008
- Round: 1

## Summary
I reviewed the four changed files against spec.md and build.md. The change adds a read-only `history <id>` subcommand and a pure formatter. The id is only compared in memory against `board.jobs`. It never reaches a file path, a shell or a dynamic evaluation, and the command does not write anything. I found no security issues.

## Findings
- **note** `scripts/lib/board.mjs:328-337`: `formatJobHistory` prints `title`, `branch`, `at`, `stage` and `note` to the terminal exactly as stored, so terminal control sequences in a stored note or title would also be printed. `show` and `list` already work the same way. The data comes from the local, operator-controlled `board.json`, so this change does not create a new trust boundary. Fix: none needed for this job. If board data ever comes from an untrusted source, add control-character stripping for every output command at once.

## Checked
- Secrets, tokens and keys: the diff adds none to code or tests. The test fixtures contain only synthetic ids, timestamps and notes.
- Injection: the `id` argument is used only in `board.jobs.find((j) => j.id === id)` (`scripts/lib/board.mjs:129-133`). It is not used in a path, a shell command, a template or HTML. `loadBoard` reads a fixed path from `root`.
- Authorization and scope: the command is read-only. It calls no `saveBoard`, and the CLI test checks that `board.json` stays byte-identical. Nothing in the diff goes beyond the spec, and no files under `claude-setup/`, `.claude/` or `factory/` changed.
- Input validation: a missing id is rejected before the lookup. An unknown id goes through the existing generic error path (stderr, exit 1).
- Unsafe deserialization, eval and dynamic requires: none were added. `JSON.parse` of the local board was already there and is unchanged.
- Dependencies: none added. `package.json` is unchanged.
- Logging: no personal data or credentials are logged. Error messages echo only the id the user typed and the static usage text. No stack traces or internal paths are exposed.
- Tests: new tests use `spawnSync(process.execPath, [cli, ...])` with an argument array and no shell.

VERDICT: pass
