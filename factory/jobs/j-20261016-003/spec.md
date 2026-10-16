# Spec: Friendly preflight error outside a git repo

- Job: j-20261016-003
- Branch: factory/j-20261016-003-friendly-preflight-error-outside-a-git-r

## Goal
When `node scripts/board.mjs preflight` runs where the factory root is not inside a git repository, it prints one clear line, `error: preflight needs a git repository at <root>`, and exits 1. Today it prints git's raw "fatal: not a git repository" output. Every other git failure behaves exactly as it does now.

## Context
- `scripts/board.mjs`, `commands.preflight()` (lines 243-254) calls `execFileSync("git", ["status","--porcelain=v1","-z","--untracked-files=all"], { cwd: root, stdio: ["ignore","pipe","pipe"] })` before `B.loadBoard(root)`. On failure, `execFileSync` throws, and the top-level `try/catch` (lines 271-276) writes `error: ${err.message}` to stderr and exits 1. That message is "Command failed: git status ...", followed by git's `fatal:` text.
- `root` (line 35) is `path.resolve(FACTORY_ROOT)` or `process.cwd()`.
- `tests/cli.test.mjs` has `setup()` (l.14), `runAt()` (l.497: FACTORY_ROOT plus an unrelated cwd), `gitEnv()` (l.511: strips GIT_DIR, GIT_WORK_TREE and related vars), `gitRepo()` and `preflightRun()` (l.536). The preflight tests are at l.603 onward.

**Detection method (chosen):** keep the existing `git status` call unchanged and catch its error. If `err.status === 128`, run a confirming probe: `execFileSync("git", ["rev-parse", "--git-dir"], { cwd: root, encoding: "utf8", stdio: ["ignore","pipe","pipe"], env: { ...process.env, LC_ALL: "C", LANGUAGE: "" } })`. If the probe also fails with `status === 128` and its stderr matches `/not a git repository/i`, throw `new Error(\`preflight needs a git repository at ${root}\`)`. In every other case, including a probe that succeeds or a probe that fails differently, rethrow the original `git status` error unchanged.

Why this method:
- Exit code 128 alone is not enough. Git also uses 128 for dubious ownership, a corrupt repo, and running inside `.git`.
- Forcing the C locale on the probe only makes the English message reliable without changing the locale or output of the real `git status` call.
- The happy path adds no extra spawn.
- An `ENOENT` (git not installed) has no `status === 128`, so it passes through unchanged.

## Acceptance criteria
- [ ] Running `preflight` with cwd set to a temp dir outside any git repo (and no FACTORY_ROOT) exits 1. Stdout is empty, and stderr is exactly `error: preflight needs a git repository at <root>\n`, where `<root>` is the resolved root.
- [ ] The same result holds when FACTORY_ROOT points at a non-repo dir and cwd is a different non-repo dir. `<root>` is the FACTORY_ROOT value after `path.resolve`.
- [ ] Stderr in these cases contains no `fatal:` and no `Command failed`.
- [ ] The git check still runs before `B.loadBoard`, so a dir with no `factory/` folder gets the git message, not a board error.
- [ ] Other git failures are unchanged. Running preflight with root set to a repo's `.git` directory (where `git status` exits 128 with "must be run in a work tree") still exits 1 with stderr starting `error: Command failed`. It does not show the new message.
- [ ] The probe runs only after `git status` fails with status 128. The successful path and its output are unchanged.
- [ ] Only `scripts/board.mjs` and `tests/cli.test.mjs` change. No new dependencies. Paths are built with `node:path`.
- [ ] `npm test` passes, including all existing preflight tests.

## Out of scope
- `scripts/lib/board.mjs`, including `preflightErrors` and `parseGitStatusZ`. This is CLI IO-error handling, not business logic.
- Usage/help text, other commands, and the "Uncommitted changes" / "Clean apart from..." messages.
- `claude-setup/skills/factory/SKILL.md` (job j-20261016-001) and `dashboard/index.html` / `tests/dashboard.test.mjs` (job j-20261016-002). Do not touch them.
- Friendlier messages for any other git failure, such as git missing or dubious ownership.

## Tests
Add both tests to `tests/cli.test.mjs` next to the other preflight tests. Clean up temp dirs in `finally`.
- `preflight outside a git repo prints one clear error line`:
  - Create the dir with `fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "ccs-factory-nogit-")))`. Realpath it so the `<root>` that the CLI computes from `process.cwd()` matches the string the test asserts, on Windows (8.3 names) and macOS (`/private/var`). Do not run `git init` and do not create `factory/` files.
  - Use env `{ ...gitEnv(), GIT_CEILING_DIRECTORIES: path.dirname(dir) }` so git cannot find a parent repo on CI.
  - Case A: cwd is `dir`, with no FACTORY_ROOT.
  - Case B: FACTORY_ROOT is `dir` and cwd is a second realpathed non-repo temp dir. Use the same env, with the ceiling covering that dir's parent too; both dirs share `os.tmpdir()` as their parent.
  - In both cases, assert `status === 1`, `stdout === ""`, `stderr.trim() === \`error: preflight needs a git repository at ${dir}\``, and that stderr does not match `/fatal|Command failed/`.
- `preflight keeps git's own error for other git failures`:
  - Build a repo with `gitRepo()`.
  - Run preflight with cwd `path.join(root, ".git")` and env `gitEnv()`.
  - Assert `status === 1`, that stderr matches `/^error: Command failed/`, and that it does not contain `needs a git repository`.

## Risks
- Low. This changes CLI error output only. The orchestrator treats any non-zero exit from preflight as a stop, so changing the message text does not change control flow.
- The test depends on `GIT_CEILING_DIRECTORIES` and realpath behaving the same on Windows and Linux. Run the tests on both if possible.

## Assumptions
- "Not inside a git work tree" means git reports "not a git repository". Other cases, such as being inside `.git` or a bare repo, count as "other git failures" and keep the current output.
- The new message goes to stderr through the existing top-level catch, matching every other `error:` line in the CLI.
