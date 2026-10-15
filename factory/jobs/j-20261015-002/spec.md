# Spec: Use Object.hasOwn for unknown-command check

- Job: j-20261015-002
- Branch: factory/j-20261015-002-use-object-hasown-for-unknown-command-ch

## Goal
`node scripts/board.mjs <name>` treats names inherited from `Object.prototype` (`toString`, `constructor`, `hasOwnProperty`, `__proto__`, `valueOf`) as unknown commands. It prints the `Unknown command` message and usage, then exits 2, the same as for `bogus`.

## Context
- `scripts/board.mjs` lines 154-173: the dispatch. Line 163 checks `if (!commands[cmd])`. `commands` is a plain object literal (lines 55-152), so `commands["toString"]` and the other inherited names are truthy. They skip the unknown-command branch and go to `commands[cmd](args)` on line 169. Today `toString`, `constructor`, `hasOwnProperty` and `valueOf` run silently and exit 0. `__proto__` resolves to `Object.prototype`, which is not callable, so it hits the catch and exits 1 with `error: ... is not a function` on stderr.
- The order before this check is unchanged: the `HELP` set check (line 155), then the no-command check (line 159).
- `tests/cli.test.mjs`: `setup()` returns `run(...args)` (wraps `execFileSync`). A non-zero exit throws an error carrying `.status`, `.stdout` and `.stderr`. The existing test "unknown command prints the command list, then usage, and exits 2" (lines 106-122) shows the expected output shape.

## Acceptance criteria
- [ ] Line 163 of `scripts/board.mjs` becomes `if (!Object.hasOwn(commands, cmd))`. The diff touches only that one line in this file.
- [ ] For each of `toString`, `constructor`, `hasOwnProperty`, `__proto__` and `valueOf`, the CLI exits 2. The first stdout line is `Unknown command "<name>". Commands: <list>`, followed by USAGE, and stderr is empty.
- [ ] The `Unknown command` message template, the `Commands:` list (still `Object.keys(commands)`), USAGE text, help handling, no-command handling and the exit codes of real commands are all unchanged.
- [ ] All existing tests pass unchanged, and `npm test` is green.

## Out of scope
- `scripts/lib/board.mjs`, the dashboard, SKILL.md, agent files, `factory/config.json`, `factory/board.json`.
- Changing `commands` to `Object.create(null)` or a `Map`, or restructuring the dispatch in any other way.
- Validating command arguments, or adding per-command help.
- Moving any output between stdout and stderr.

## Tests
Add one test to `tests/cli.test.mjs`, reusing `setup()` with no `init`, named for example "names inherited from Object.prototype are unknown commands":
- For each name in `["toString", "constructor", "hasOwnProperty", "__proto__", "valueOf"]`, call `assert.throws(() => run(name), (e) => ...)`. The predicate checks that `e.status === 2`, that the first line of `e.stdout` (split on `/\r?\n/`) matches `Unknown command "<name>"\. Commands: ` (escape the name for the regex, or compare with `startsWith`), that the remaining stdout contains `Usage:`, and that `e.stderr === ""`.
- After the loop, assert that `factory/board.json` does not exist under `root`. This shows the unknown-command path does no filesystem writes.

## Risks
- Low. The orchestrator calls this CLI for every board write. Every real command key is an own property of `commands`, so `Object.hasOwn` returns true for exactly the same set of real commands as before. Only the inherited names change behaviour.

## Assumptions
- The five names in the request are enough coverage. Other inherited names (`isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `__defineGetter__` and so on) are fixed by the same one-line change, so they get no tests of their own.
- `cmd` is never `undefined` when it reaches the check, because the no-command branch exits first. `Object.hasOwn` with a string key is safe there.
