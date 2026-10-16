# Build report: Friendly preflight error outside a git repo

- Job: j-20261016-003
- Branch: factory/j-20261016-003-friendly-preflight-error-outside-a-git-r
- Last commit: 995720b

## Files changed
- `scripts/board.mjs`: `commands.preflight()` wraps the existing `git status` call, which itself is unchanged, in a try/catch. On `err.status === 128` it calls a new module-level helper `notAGitRepo()`. The helper runs `git rev-parse --git-dir` with `cwd: root`, `encoding: "utf8"`, `stdio: ["ignore","pipe","pipe"]` and `env: { ...process.env, LC_ALL: "C", LANGUAGE: "" }`. It returns true only if the probe fails with `status === 128` and its stderr matches `/not a git repository/i`. If it returns true, preflight throws `new Error(\`preflight needs a git repository at ${root}\`)`. Otherwise it rethrows the original `git status` error unchanged. The existing top-level catch prints the message as `error: ...` and exits 1.
- `tests/cli.test.mjs`: two new tests, placed after "preflight lists both paths of a staged rename".

## Acceptance criteria
- [x] Outside any git repo with cwd = temp dir and no FACTORY_ROOT: exit 1, empty stdout, stderr `error: preflight needs a git repository at <root>`. Covered by the test case `viaCwd`. The test deletes FACTORY_ROOT from env explicitly.
- [x] FACTORY_ROOT points at a non-repo dir and cwd is a different non-repo dir: same result, with `<root>` = `path.resolve(FACTORY_ROOT)` (the existing `root` constant). Covered by the test case `viaEnv`.
- [x] No `fatal:` and no `Command failed` in stderr. The test asserts `doesNotMatch(/fatal|Command failed/)` for both cases.
- [x] The git check still runs before `B.loadBoard`. The try/catch sits where the old call was, ahead of `loadBoard`. The test dirs have no `factory/` folder and still get the git message.
- [x] Other git failures are unchanged. In `<repo>/.git`, `git status` exits 128 but the probe `rev-parse --git-dir` succeeds, so the original error is rethrown. The new test asserts `^error: Command failed` and that stderr does not contain `needs a git repository`.
- [x] The probe runs only in the catch, only when `err.status === 128`. The success path has no extra spawn and its output is unchanged.
- [x] Only `scripts/board.mjs` and `tests/cli.test.mjs` changed (`git diff --stat`: 2 files, +66/-5). No new dependencies. Test paths use `path.join` / `path.dirname`.
- [x] `npm test` passes, including all existing preflight tests.

## Tests
- Command: `npm test` (run in the worktree)
- Result: passed, 124/124, 0 failed, 0 skipped.
- Added or changed: `tests/cli.test.mjs`:
  - "preflight outside a git repo prints one clear error line": realpathed `ccs-factory-nogit-` dirs, `GIT_CEILING_DIRECTORIES` set to `path.dirname(dir)`, cases A and B.
  - "preflight keeps git's own error for other git failures": `gitRepo()`, cwd `<root>/.git`.
- Sanity check: with `scripts/board.mjs` reverted (stashed), the new "outside a git repo" test fails. With the fix in place it passes.

## Notes
- Tested on Windows only (win32, Git Bash). The spec suggests also running on Linux. That was not possible here.
- In the test, both temp dirs come from `fs.realpathSync.native(mkdtempSync(os.tmpdir()/...))`, so they share one realpathed parent. A single `GIT_CEILING_DIRECTORIES` value covers both, as the spec allows.
- Pre-existing failures: none.
