# Spec: Run several jobs in parallel with git worktrees

- Job: j-20261015-012
- Branch: factory/j-20261015-012-run-several-jobs-in-parallel-with-git-wo

## Goal
Every job gets its own git worktree, so the main checkout stays on main the whole time. The orchestrator can then run up to `parallel.maxJobs` jobs at once without one job overwriting another's files.

## Context
- `claude-setup/skills/factory/SKILL.md`: step 3 runs `git switch -c <branch>`, step 5 and `approve` run `git switch <mainBranch>`, step 7.2 switches back to main, `rework` switches to the job branch and merges main into it. Rules line 111 says "One job at a time in this version".
- `scripts/lib/board.mjs`: `STAGES`/`TRANSITIONS`, `validateBoard`, `exportDir` (the pattern to copy for resolving a configured dir against root). The board has no worktree state today.
- `scripts/board.mjs`: CLI, honours `FACTORY_ROOT`, never runs git today.
- `factory/config.json`: has no `parallel` key. `.gitignore`: has no worktree entry.
- `claude-setup/agents/builder.md`, `code-reviewer.md`, `security-reviewer.md`, `ux-reviewer.md`, `ui-design-reviewer.md`, `approver.md`: all assume the code under review is in the current checkout and the job folder is the relative path `factory/jobs/<id>/`.
- `tests/skill.test.mjs` pins SKILL.md wording. `tests/cli.test.mjs` runs the CLI against a temp root and already uses git (bare repo at line 144).
- README.md: Limitations line 104 ("One job at a time") and Roadmap line 110 (git worktrees).

## Decisions
1. **Where worktrees live.** New key `parallel.worktreeDir`, default `".worktrees"`. A relative value resolves against the repo root. Each worktree is `<worktreeDir>/<job-id>`, using the 16-character id rather than the branch slug to keep Windows paths short. Add `.worktrees/` to `.gitignore`. *Why:* nothing is written outside the repo. `npm test` only globs `tests/**`, so the copies inside `.worktrees/` are never picked up. If a user picks a dir that git does not ignore, the preflight check (point 6) reports it. Worktrees are used for **every** job, even at `maxJobs: 1`, so there is one code path, and SKILL.md never runs `git switch` in the main checkout again.
2. **Single source of truth.** `factory/board.json` and `factory/jobs/<id>/` live only in the main checkout. The orchestrator runs every `board.mjs` command from the main checkout. Every agent prompt gives two absolute paths: the job folder in the main checkout and the job's worktree. Agents write their output file to that absolute job-folder path, never to the stale `factory/` copy inside the worktree. The builder commits in the worktree with `git -C <worktree>`. *Why:* the board keeps a single writer, and the worktree's tracked `factory/` copy can never fork from the real one.
3. **Lifecycle.** At step 3: `git worktree add -b <branch> <worktree> <mainBranch>`. The orchestrator runs the test command inside `<worktree>`. When the job ends `merged` or `failed`, step 7 runs `git worktree remove <worktree>` (never `--force`). If that fails, tell the user and leave the worktree in place. The worktree stays while a job is `needs-human`. `approve` merges the branch ref from the main checkout, with no switch. `rework` works inside the existing worktree. If that worktree is missing (for example a job parked before this change), recreate it first with `git worktree add <worktree> <branch>`. The worktree path is **derived** from config and id, not stored on the board. *Why:* no new board fields, no migration, and nothing that `validate` can find out of sync.
4. **Concurrency.** New key `parallel.maxJobs`, default `1`. The stages `queued, spec, spec-approval, build, review, rework, approve` count as active and use a slot. `needs-human` uses no slot, which matches today, where `/factory next` can run while another job is parked. Two ways to start jobs: `/factory next [<n>]` takes `min(n, free slots)` backlog items, and `/factory <feature>` starts one job if a slot is free. The orchestrator runs jobs in **lockstep rounds**. In each round it spawns every agent due across all active jobs in one message, then handles each job's results (board, git, tests) one job at a time in id order. One orchestrator session at a time. *Why:* this is the smallest scheduler that gives real parallelism, and it keeps all git work serial without locks.
5. **Merging stays serialized.** Merges only happen in the one-job-at-a-time results phase. The main checkout is always on main: `git merge --no-ff <branch>`, then the test command on main, then the existing `reset --keep ORIG_HEAD` rollback. If the merge conflicts: `git merge --abort`, then `stage <id> needs-human --note "conflicts with <mainBranch>"`, then steps 7 and 6. *Why:* this is the same "do not resolve conflicts yourself" rule `rework` already follows, and no merge happens without supervision. Breakage that merges cleanly is still caught by tests on main. To recover, a human runs `/factory rework`, which merges main into the branch inside the worktree. If that conflicts, it runs `git -C <worktree> merge --abort` and tells the user.
6. **Records.** Step 7 keeps `git add factory/board.json factory/backlog.md factory/jobs/<id>` unchanged. The commit therefore holds the whole board snapshot, including other jobs' in-flight stages, which is valid. Other jobs' folders stay uncommitted until their own step 7. Step 7.2 (the switch) is removed. The pre-flight clean-tree check becomes `node scripts/board.mjs preflight`. It tolerates only `factory/board.json`, `factory/backlog.md` and `factory/jobs/<id>/**` for ids that are active (point 4), and only when at least one job is active. Any other dirty or untracked path is an error. The orchestrator also runs preflight after each builder returns, which catches a builder that wrote into the main checkout.
7. **board.mjs.** The stages and transitions stay as they are, and the board shape is unchanged. New pure functions in the lib and three new CLI commands (see criteria). `validate` also reports a bad `parallel.maxJobs`.
8. **Docs.** Update SKILL.md (`claude-setup/` only), the builder, the four reviewers and the approver (they need the absolute job folder and the worktree), README Usage/Limitations/Roadmap/Install, `.gitignore` and `factory/config.json`. `spec-writer.md` stays as it is: specs are written against main before any worktree exists.

## Acceptance criteria
- [ ] `factory/config.json` has `"parallel": { "maxJobs": 1, "worktreeDir": ".worktrees" }`. `.gitignore` contains `.worktrees/`.
- [ ] `scripts/lib/board.mjs` exports these pure functions:
  - `ACTIVE_STAGES`: the 7 stages from Decision 4.
  - `worktreeDir(config, root)`: `path.resolve(root, config.parallel?.worktreeDir || ".worktrees")`.
  - `worktreePath(config, root, id)`: `path.join(worktreeDir(...), id)`.
  - `maxJobs(config)`: returns 1 when unset. Throws when the value is not an integer >= 1.
  - `capacity(board, config)`: returns `{ active: [ids oldest first], max, free }`, with `free` clamped at 0.
  - `preflightErrors(dirtyPaths, board)`: returns the offending paths per Decision 6. It accepts `\` and `/` separators.
- [ ] `validateBoard` adds the error `config.parallel.maxJobs must be an integer >= 1` when the value is invalid. Configs without `parallel` stay valid.
- [ ] New CLI commands, each listed in `USAGE`, all honouring `FACTORY_ROOT`:
  - `worktree <id>` prints the absolute worktree path. An unknown id exits 1.
  - `slots` prints exactly `active <n>/<max>: <ids comma-separated or none>; free <k>`.
  - `preflight` runs `git status --porcelain=v1 -z --untracked-files=all` in root and feeds both paths of rename entries to `preflightErrors`. On success it prints `Clean apart from in-flight factory records.` and exits 0. Otherwise it lists offending paths as `- <path>` and exits 1.
- [ ] SKILL.md has no `git switch` and no `worktree remove --force`, and no longer contains "One job at a time in this version". Its steps follow Decisions 1-6:
  - Step 3 uses `git worktree add -b <branch> <worktree> <mainBranch>`, where `<worktree>` is the output of `node scripts/board.mjs worktree <id>`.
  - Tests run in `<worktree>`.
  - Step 5 merges without switching and handles conflicts with `git merge --abort` + needs-human.
  - Step 7 drops the switch and adds `git worktree remove <worktree>` for `merged`/`failed`, with "If `git worktree remove` fails, stop and tell the user".
  - `approve`/`rework` work without switching the main checkout.
  - "Before the first job" uses `node scripts/board.mjs preflight` and `node scripts/board.mjs slots`.
  - The Commands table shows `/factory next [<n>]`.
  - A short "Running several jobs" section describes lockstep rounds and serial merges, and refers to `parallel.maxJobs`.
- [ ] SKILL.md step 6 tells the user the work is on `<branch>` in `<worktree>`. It still checks `git branch --show-current` on the main checkout, still names `<mainBranch>` and `<branch>`, and still says "three lines or fewer".
- [ ] `builder.md` tells the builder to:
  - edit, test and commit only inside the worktree path it is given (`git -C <worktree> branch --show-current` as step 1)
  - write `build.md` to the absolute job-folder path.
  It keeps the existing `factory/` prohibitions word for word.
- [ ] The four reviewer files and `approver.md` each say to read code and run tests in the given worktree and to write their file at the absolute job-folder path. Their VERDICT/RISK/DECISION format is unchanged.
- [ ] README: Usage and Commands show `/factory next [<n>]` and `parallel.*`. Install mentions gitignoring the worktree dir. The Limitations "one job at a time" line now describes the lockstep, single-session model. The Roadmap worktree item is removed.
- [ ] `npm test` passes. `.claude/` is not modified by the diff.

## Out of scope
- Any change to `STAGES`, `TRANSITIONS`, board `version`, `dashboard/`, `scripts/setup.mjs`, `scripts/serve.mjs`, or `.claude/`.
- Enforcing the cap inside `createJob`/`setStage`. The cap is checked by the orchestrator via `slots`. See Assumptions.
- **Follow-up jobs (flag, do not build):**
  - (a) `parallel.setupCommand` to install dependencies in a new worktree (needed for repos with `node_modules`; this repo has none)
  - (b) dashboard column or badge for worktree and slots
  - (c) background, non-lockstep scheduling
  - (d) deleting merged job branches
  - (e) letting the builder resolve merge conflicts on rework.

## Tests
- `tests/board.test.mjs`:
  - `worktreeDir`/`worktreePath`: default, relative, absolute, Windows-style config value.
  - `maxJobs`: unset, 3, 0, "2", 1.5.
  - `capacity`: active vs `needs-human` vs terminal, `free` clamped when active > max.
  - `preflightErrors`: in-flight folder ok, terminal job's folder flagged, board.json flagged when nothing active, `src/x.js` flagged, `.worktrees/` flagged, backslash paths.
  - `validateBoard` with a bad `maxJobs`.
- `tests/cli.test.mjs`:
  - `worktree <id>` (path ends with `<id>` under `.worktrees`), unknown id exits 1.
  - `slots` exact output.
  - `preflight` in a temp git repo: exits 0 with an in-flight job folder untracked, exits 1 and names `src/a.js` when that is dirty.
  - An end-to-end check that `git worktree add -b <branch> <printed path> main` succeeds and `preflight` still exits 0, given `.worktrees/` in that repo's `.gitignore`.
- `tests/skill.test.mjs`:
  - Test 2 drops `"If the switch fails, stop and tell the user"` and adds `"If \`git worktree remove\` fails, stop and tell the user"`.
  - New test: SKILL.md contains `git worktree add -b <branch> <worktree> <mainBranch>`, `node scripts/board.mjs preflight`, `node scripts/board.mjs slots`, `parallel.maxJobs`, and does not contain `git switch`, `worktree remove --force` or `One job at a time in this version`.
  - Builder test also asserts `builder.md` contains `worktree`.
  - New test: each reviewer in config plus `approver.md` contains `worktree`.
  - Tests 1, 3 and 4 stay as they are.

## Risks
- **Config / orchestrator behaviour:** this rewrites the git flow of every job, even at `maxJobs: 1`. A mistake strands branches or loses records. Mitigations: preflight after each builder returns, no `--force` anywhere, and the `reset --keep` rollback kept unchanged.
- The diff touches `claude-setup/**` and `factory/config.json`, which are in `risk.alwaysEscalatePaths`, so this job will escalate to a human. That is intended.
- **Agents writing to the wrong copy:** the worktree holds a stale tracked `factory/`. A relative-path write lands there. Mitigation: absolute paths in prompts, plus the after-build preflight and a clean-worktree check.
- **Windows:** `git worktree` path length is fine for this repo. Deep target repos may need `core.longpaths`; say so in the README.
- `git worktree add -b` fails if the branch already exists, for example on a rerun. The SKILL.md step should say to use `git worktree add <worktree> <branch>` in that case.

## Assumptions
- "Default 1 so behaviour is unchanged" means one job at a time. It does not mean keeping `git switch`. Worktrees are always used.
- Jobs left active by an earlier crashed session count against the cap. `slots` names them, and the user can fail them with `stage <id> failed`.
- The cap is advisory at the CLI level (the orchestrator checks `slots`), because the existing tests create several unfinished jobs.
- `pr` mode needs no change beyond dropping the switch: `git push -u origin <branch>` works on a branch that is checked out in a worktree.
- This job itself runs under the old single-checkout flow. The new flow applies from the next job onward.
