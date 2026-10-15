# Security reviewer review: Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Round: 1

## Summary
I checked the one-line dispatch change in `scripts/board.mjs` and the new test in `tests/cli.test.mjs` against the spec. The change tightens input validation at the CLI boundary. Inherited `Object.prototype` names can no longer reach `commands[cmd](args)`, so they no longer run prototype methods or fail with an internal `is not a function` error. I found no new attack surface, secrets, dependencies or widened permissions.

## Findings
None.

## Checked
- `scripts/board.mjs:163`: `Object.hasOwn(commands, cmd)` admits only the object's own keys. `cmd` cannot be `undefined` here because the no-command branch at line 159 exits first. Real commands are all own properties, so the set of runnable commands for legitimate callers is unchanged. Inherited names (`toString`, `constructor`, `hasOwnProperty`, `__proto__`, `valueOf` and the rest) are now rejected with exit 2 before dispatch. This closes a small prototype-name dispatch gap. It does not widen access.
- `scripts/board.mjs:169-172`: the catch path still writes `err.message` to stderr, as before. Inherited names no longer reach it, so the `is not a function` leak for `__proto__` is gone.
- `scripts/board.mjs:164`: the unknown-command message echoes `cmd` to stdout. This is unchanged from before. It is a local CLI with the caller's own argv, so the echo is not an injection or leak concern.
- Injection: no shell, SQL, path, template or HTML sinks are added. The test calls the CLI through the existing `run()` wrapper (`execFileSync`, no shell).
- Secrets: none in either file. The test fixtures are literal command names only.
- Dependencies: none added. `package.json` and the lockfile are untouched, and `Object.hasOwn` is built into Node 22+.
- Deserialization, eval, dynamic requires: none introduced.
- Logging of personal data: none.
- Scope: the diff touches only the two files the spec allows. Nothing security-relevant goes beyond the spec. The new test also confirms that the rejected path writes nothing (`factory/board.json` is absent).

VERDICT: pass
