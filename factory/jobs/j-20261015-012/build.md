# Build report: Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Branch: factory/j-20261015-012-run-several-jobs-in-parallel-with-git-wo
- Last commit: 73ea6fe

## Files changed
- `scripts/lib/board.mjs`: new pure functions `ACTIVE_STAGES`, `worktreeDir`, `worktreePath`, `maxJobs`, `capacity`, `parseGitStatusZ`, `preflightErrors`. `validateBoard` now reports `config.parallel.maxJobs must be an integer >= 1`. `STAGES`/`TRANSITIONS` and the board shape are unchanged.
- `scripts/board.mjs`: new commands `worktree <id>`, `slots` and `preflight`, all listed in `USAGE` and all resolving paths against `FACTORY_ROOT` (or cwd). `preflight` is the only command that runs git (`git status --porcelain=v1 -z --untracked-files=all` in root).
- `factory/config.json`: `"parallel": { "maxJobs": 1, "worktreeDir": ".worktrees" }`, a minimal insert with no reformatting of the other keys.
- `.gitignore`: `.worktrees/`.
- `claude-setup/skills/factory/SKILL.md`: worktree flow (Decisions 1-6), `/factory next [<n>]`, preflight and slots before the first job, a "Running several jobs" section, and no `git switch`.
- `claude-setup/agents/builder.md`: works only in `<worktree>` (`git -C <worktree> branch --show-current` as step 1) and writes `<jobdir>/build.md`. The Output item 1 `factory/` prohibitions are kept word for word.
- `claude-setup/agents/{code,security,ux,ui-design}-reviewer.md`, `approver.md`: read the code and run tests in `<worktree>`, and write their file at the absolute `<jobdir>` path. VERDICT/RISK/DECISION wording is unchanged.
- `README.md`: Quick start, Commands, a new "Running several jobs" table, Install (gitignore the worktree dir, `core.longpaths`, per-worktree deps), Limitations, and Roadmap (worktree item removed).
- `tests/board.test.mjs`, `tests/cli.test.mjs`, `tests/skill.test.mjs`: see Tests.

## Acceptance criteria
- [x] config has `parallel` with `maxJobs: 1`, `worktreeDir: ".worktrees"`; `.gitignore` has `.worktrees/`.
- [x] Lib exports `ACTIVE_STAGES` (7 stages), `worktreeDir` (`path.resolve(root, config.parallel?.worktreeDir || ".worktrees")`), `worktreePath` (`path.join(worktreeDir(...), id)`), `maxJobs` (1 when unset, throws otherwise), `capacity` (`{ active, max, free }`, oldest first by `createdAt`, `free` clamped at 0), and `preflightErrors` (normalises `\` to `/`).
- [x] `validateBoard` adds the exact maxJobs error. Configs without `parallel` stay valid (existing tests unchanged and passing).
- [x] `worktree <id>` prints the absolute path; an unknown or missing id exits 1. `slots` prints `active <n>/<max>: <ids or none>; free <k>`. `preflight` passes both paths of rename/copy entries to `preflightErrors`. It prints `Clean apart from in-flight factory records.` and exits 0, or lists `- <path>` lines and exits 1. All three are in `USAGE` and honour `FACTORY_ROOT` (tested with an unrelated cwd).
- [x] SKILL.md contains no `git switch`, no `worktree remove --force` and no "One job at a time in this version". Step 3 runs `git worktree add -b <branch> <worktree> <mainBranch>`, with `<worktree>` taken from `node scripts/board.mjs worktree <id>` and a fallback to `git worktree add <worktree> <branch>` when the branch already exists. Tests run in `<worktree>`. Step 5 merges without switching and handles a conflict with `git merge --abort` and `needs-human --note "conflicts with <mainBranch>"`. Step 7 has no switch and runs `git worktree remove <worktree>` for `merged`/`failed`, with "If `git worktree remove` fails, stop and tell the user". `approve`/`rework` never change the main checkout's branch. "Before the first job" runs `preflight` and `slots`. The Commands table shows `/factory next [<n>]`, and the "Running several jobs" section covers lockstep rounds, serial merges and `parallel.maxJobs`.
- [x] Step 6 says the work is on `<branch>` in `<worktree>`. It checks `git branch --show-current` on the main checkout, names `<mainBranch>` and `<branch>`, and keeps "three lines or fewer".
- [x] builder.md edits, tests and commits only in the worktree, checks with `git -C <worktree> branch --show-current` first, and writes `build.md` to the absolute job folder. The prohibitions are unchanged.
- [x] All four reviewers and approver.md say to read code and run tests in the worktree and to write at the absolute job-folder path.
- [x] README: Usage (Quick start) and Commands show `/factory next [<n>]` and `parallel.*`. Install mentions gitignoring the worktree dir. Limitations describes the lockstep, single-session model. The Roadmap worktree item is removed.
- [x] `npm test` passes. `git diff main...HEAD -- .claude dashboard scripts/setup.mjs scripts/serve.mjs` is empty.

## Tests
- Command: `npm test`
- Result: passed, 120/120 (101 on main before this job).
- Added or changed:
  - `tests/board.test.mjs` (+8 tests):
    - `ACTIVE_STAGES`
    - `worktreeDir`/`worktreePath`: default, empty, relative, absolute, and a Windows-style `build\trees` value (the exact `path.join` equality is only asserted on win32)
    - `maxJobs`: unset, 1, 3, 0, -1, "2", 1.5, true, NaN
    - `capacity`: active vs needs-human vs terminal, oldest-first by `createdAt`, `free` clamped, a bad cap throws
    - `preflightErrors`: in-flight folder ok, merged and needs-human folders flagged, `j-…-0011` not matched by `j-…-001`, `src/x.js` and `src\x.js` flagged, `.worktrees/` flagged, board.json and backlog.md flagged when nothing is active
    - `parseGitStatusZ`: renames and copies
    - `validateBoard` with a bad `maxJobs`
  - `tests/cli.test.mjs` (+9 tests, plus the three new commands in `allCommands`):
    - `worktree`: path under `.worktrees`, `FACTORY_ROOT`, a custom dir, creates nothing; unknown or missing id exits 1
    - `slots`: exact output at caps 1 and 3, `FACTORY_ROOT`, after failing jobs; a bad maxJobs fails `slots` and `validate`
    - `preflight` in a temp git repo: clean; in-flight `spec.md` untracked still exits 0; dirty `src/a.js` exits 1 naming it; records flagged once the job failed; both paths of a staged `git mv`
    - End to end: `git worktree add -b <branch> <printed path> main` succeeds, the main checkout stays on `main`, an edit inside the worktree, and `preflight` still exits 0
    - The same setup without the `.gitignore` entry flags `.worktrees/…`
    - All git work runs in `os.tmpdir()` repos and is cleaned up with `fs.rmSync`. No worktree, branch or `--force` git command touches this repo (`git worktree list` checked after the run).
  - `tests/skill.test.mjs`:
    - Test 2 swaps the switch assertion for "If `git worktree remove` fails, stop and tell the user".
    - New test for the worktree, preflight, slots and `parallel.maxJobs` strings and the three forbidden strings.
    - The builder test also asserts `worktree`.
    - New test: every reviewer in config plus `approver.md` mentions `worktree`.
    - Tests 1, 3 and 4 are unchanged.

## Notes
- **Small additions beyond the spec:**
  - `parseGitStatusZ(text)` is an extra exported pure function, so the CLI only does IO and the rename handling is unit-tested.
  - `maxJobs` treats `null` like unset.
  - On failure, `preflight` prints one header line ("Uncommitted changes outside in-flight factory records. Commit or remove them first:") before the `- <path>` lines.
  - `slots` joins ids with `", "`.
- **SKILL.md choices the spec left open:**
  - Step 7 commits the records first and removes the worktree last (step 7.4). A failed `git worktree remove` therefore never leaves records uncommitted.
  - "Before the first job" also checks that the main checkout is on `<mainBranch>`.
  - After each builder run (build and rework), the orchestrator runs `preflight`, then checks that `git -C <worktree> status --porcelain` is empty, then runs the tests in the worktree.
  - `/factory approve` on a merge conflict runs `git merge --abort`, leaves the stage as is (the job is already `needs-human`) and points the user to `/factory rework`.
  - `/factory rework` requires a free slot, because `rework` is an active stage.
- `.claude/` is not synced. After merge, run `npm run setup -- --force` (as earlier jobs did) so the installed skill and agents pick up the worktree flow.
- The task prompt calls the test at `tests/cli.test.mjs` line 144 a "bare repo". It is a plain temp dir, not a git repo. The new `gitRepo()` helper creates real temp git repos (`git init -b main`, local user config, `core.autocrlf false`).
- This job itself ran under the old single-checkout flow, as the spec assumes.
- Follow-ups, flagged and not built: (a) `parallel.setupCommand`, (b) dashboard worktree/slots badge, (c) non-lockstep scheduling, (d) deleting merged branches, (e) builder-resolved merge conflicts on rework.
- No pre-existing test failures.

## Rework 1
Commit: c310876. Every SKILL.md change is in `claude-setup/` only; `.claude/` is untouched.

- Addressed:
  - ux-reviewer: step 6 park message is too tight. Step 6 is now a fixed three-line template:
    - line 1: `<id> <title>: needs you because <why>.`
    - line 2: `Work is on <branch> in <worktree>; the main checkout is on <current branch>.`
    - line 3: the approve and rework commands.
    - Suffixes cover a main checkout that is not on `<mainBranch>` and uncommitted records.
    - A merge-conflict park gets its own line 3. It says `/factory rework` merges `<mainBranch>` into `<branch>` first. If that conflicts too, the human resolves it in `<worktree>`, commits and runs rework again. `approve` would hit the same conflict.
    - It keeps `git branch --show-current`, `<mainBranch>`, `<branch>`, "three lines or fewer" and both commands.
  - ux-reviewer: no wording for "no free slot" or "backlog shorter than `<n>`". "Before the first job" step 6 now runs `slots` before every new job, not just at startup.
    - With `free 0`, no job is created and the user is told: `No free slot (active: <ids>). Wait for one to finish, or end one with node scripts/board.mjs stage <id> failed. Resuming jobs left by an earlier session is not supported yet.` (The last sentence is from the review's note.)
    - When fewer than `<n>` jobs start, the user is told: `Started <k> of <n>: <ids>.` plus the reason (too few slots, or the backlog ran out).
  - ux-reviewer: the spec-approval gate in a multi-job round. Step 2 now stops that job only: it leaves the round but keeps its slot while it waits, and the other jobs carry on. "Running several jobs" item 3 says the same, and that the job rejoins once the user answers.
- Optional items taken (each a one-line wording change):
  - Quoting paths: rather than change the quoting in each command, SKILL.md ("The line") and every agent file (in Input) gain one rule. It says to wrap `<worktree>`/`<jobdir>` in double quotes in shell commands, because Git Bash strips backslashes from unquoted Windows paths. The command literals stay unquoted on purpose: the spec's acceptance criteria quote `git worktree add -b <branch> <worktree> <mainBranch>` and `git -C <worktree> branch --show-current` exactly.
  - Step 5 `local`: if `git merge` exits non-zero without starting a merge (for example "would overwrite local changes"), the job goes to `needs-human --note "merge refused: <git message>"`, then step 7 and step 6. It never goes on to tests or `merged`. `/factory approve` gets the matching line: leave the stage as is and relay git's message.
  - Step 7.1: when validate fails, the user is also told the job's worktree (if any) was left in place.
- Not addressed (the review's non-blocking notes):
  - The friendlier "not a git repository" hint for `preflight`: it is a CLI code change, not a one-line SKILL.md fix, so it stays out of this rework.
  - The note on `slots`/`worktree` output needs no change.
- Tests: `npm test` passed, 121/121. `tests/skill.test.mjs` has one new test that pins the park template, the conflict line 3, the no-free-slot and started-k-of-n messages, the spec-approval slot wording, the refused-merge rule, the worktree-left-in-place line and the quoting rule. The existing step 6 test still passes unchanged.
