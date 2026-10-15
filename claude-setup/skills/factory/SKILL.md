---
name: factory
description: Run the CCS Factory Build software factory. Takes a feature request from idea to merged code through spec, build, parallel review and approval. Use when the user types /factory, asks to send a feature through the factory, or wants the next backlog item built.
---

# /factory - the orchestrator

The Claude Code session that runs this skill becomes the **orchestrator**. You run the loop, spawn every agent, and you are the **only writer of `factory/board.json`**. You never write board.json by hand: every board change goes through `node scripts/board.mjs`, which enforces the stage rules.

You do not write specs, code, reviews or approvals yourself. Each agent has one job and writes one file. Your job is to move work between them and keep the board honest.

## Commands

| Command | What it does |
|---|---|
| `/factory <feature>` | Create a job from the request and run it through the line (only if a slot is free) |
| `/factory next [<n>]` | Take the next `<n>` (default 1) `- [ ]` items from `factory/backlog.md`, up to the free slots, and run them |
| `/factory approve <job-id>` | Human approves a `needs-human` job: merge it |
| `/factory rework <job-id> <note>` | Human sends a job back to the builder with a note |
| `/factory status [<job-id>]` | Show the board, or one job's history |
| `/factory approved [<job-id>]` | Export a merged job (default: the most recently merged) to the Obsidian vault in `export.obsidianDir` |

Read the argument the user gave after `/factory` and pick the matching command by its exact first word. Anything that is not `next`, `approve`, `approved`, `rework` or `status` is a feature request. `approve` and `approved` are different commands, matched on the exact first word: `approve` merges a `needs-human` job; `approved` exports a `merged` job. Never treat one as the other.

## Before the first job

1. Read `factory/config.json` (models, reviewers, rework budget, risk rules, test command, `parallel.maxJobs`, `parallel.worktreeDir`).
2. Read `CLAUDE.md` and inspect the repo once so you can tell agents its language, test command and conventions. Put what you learn in each agent's prompt; agents do not share your conversation.
3. Run `node scripts/board.mjs init`.
4. Run `node scripts/board.mjs preflight`. It passes when the tree is clean apart from the uncommitted records of in-flight jobs. If it exits 1, stop and tell the user the paths it lists.
5. Check the main checkout is on main: `git branch --show-current` must print `<mainBranch>`. If it does not, stop and tell the user. The main checkout never leaves `<mainBranch>`; jobs build in their own worktrees.
6. Run `node scripts/board.mjs slots`, here and again before every `/factory <feature>` or `/factory next <n>` later in the session. `/factory <feature>` needs one free slot; `/factory next <n>` takes `min(<n>, free)` items. Jobs left active by an earlier session count against the cap.
   - If it reports `free 0`, create no job and tell the user: `No free slot (active: <ids>). Wait for one to finish, or end one with node scripts/board.mjs stage <id> failed. Resuming jobs left by an earlier session is not supported yet.`
   - If `/factory next <n>` starts fewer than `<n>` jobs (fewer free slots, or `next` prints `Backlog is empty.`), run the ones you started and tell the user: `Started <k> of <n>: <ids>. <Only <free> slot(s) free | The backlog has no more "- [ ]" items>.`

## The line

Every job has two places, both absolute paths you pass to every agent:

- `<jobdir>`: the job folder `factory/jobs/<job-id>/` **in the main checkout**. All job records live here, and only here.
- `<worktree>`: the job's git worktree, the output of `node scripts/board.mjs worktree <id>` (`<parallel.worktreeDir>/<id>`). All code work happens here, on the job branch.

When you put `<worktree>` or `<jobdir>` into a shell command, wrap the path in double quotes (`git -C "<worktree>" ...`): Git Bash strips the backslashes from unquoted Windows paths.

The worktree holds its own tracked copy of `factory/`; it is stale and nobody writes to it. You run every `node scripts/board.mjs` command and every `git merge` from the main checkout. Agents read earlier files from `<jobdir>` and write only their own:

```
request.md            created by board.mjs
spec.md               spec-writer
build.md              builder (report: what changed, how it was tested)
reviews/<name>.md     one per reviewer, ends with VERDICT: pass|changes|block
approval.md           approver, carries RISK: low|high and DECISION: merge|escalate
```

### 1. Create the job
- Feature: `node scripts/board.mjs new "<short title>" --request "<full request>"`
- Next: `node scripts/board.mjs next` (once per item for `/factory next <n>`)
The command prints the job id. Use it everywhere below as `<id>`. Read the branch name with `node scripts/board.mjs show <id>`.

### 2. Spec
- `node scripts/board.mjs stage <id> spec`
- Spawn the **spec-writer** agent. Prompt: the absolute job folder path, repo conventions, and "write spec.md". Specs are written against main in the main checkout; no worktree exists yet.
- When it returns, confirm `spec.md` exists.
- If `humanGates.approveSpec` is true: `stage <id> spec-approval`, show the user the spec summary and stop this job only: it leaves the round but keeps its slot while it waits, and the other jobs carry on. Continue only when the user approves (then `stage <id> build`) or asks for changes (then `stage <id> spec` and respawn the spec-writer with their notes).

### 3. Build
- `node scripts/board.mjs stage <id> build`
- Get the path: `<worktree>` is the output of `node scripts/board.mjs worktree <id>`.
- Create the worktree and branch from main: `git worktree add -b <branch> <worktree> <mainBranch>`. If it fails because `<branch>` already exists (a rerun), use `git worktree add <worktree> <branch>`. If that fails too: `stage <id> failed --note "<git error>"`, run step 7, then stop.
- Spawn the **builder** agent. Prompt: absolute job folder, absolute worktree path, branch name, main branch, test command, "implement spec.md in the worktree, commit there on the branch, write build.md to the absolute job folder".
- When it returns (here and after every rework), check its work:
  1. `node scripts/board.mjs preflight` in the main checkout. If it exits 1, the builder wrote into the main checkout: stop and tell the user the paths it lists; do not clean them up yourself.
  2. `git -C <worktree> status --porcelain` must print nothing (the builder commits all its work).
  3. Run the test command with `<worktree>` as the working directory.
  If check 2 or 3 fails, respawn the builder once with the output. If it still fails: `stage <id> failed --note "<reason>"`, run step 7, then stop.

### 4. Review (parallel)
- `node scripts/board.mjs stage <id> review`
- Get the diff once: `git diff <mainBranch>...<branch> --stat` and the list of changed files `git diff --name-only <mainBranch>...<branch>`. Branches are shared, so this works from the main checkout.
- Spawn **all reviewers from `config.reviewers` in a single message** so they run in parallel. Each prompt: absolute job folder, absolute worktree path, branch, main branch, test command, "review the diff against spec.md, read code and run tests in the worktree, write reviews/<your-name>.md in the job folder".
- For each reviewer: `node scripts/board.mjs verdict <id> <reviewer>`
- Then `node scripts/board.mjs decide-review <id>` and act on the answer:
  - `approve` -> step 5
  - `rework` -> `node scripts/board.mjs rework <id> --note "<one line summary of requested changes>"`. If the output says the job moved to `needs-human`, run step 7, then step 6. Otherwise resume the **builder** in the same worktree with every review file that is not `pass` as input, run the checks from step 3, then back to step 4.
  - `needs-human` -> `stage <id> needs-human --note "<why>"`, run step 7, then step 6.

Rework budget: `maxReworkCycles` (default 2). The board enforces it, you do not count by hand.

### 5. Approve
- `node scripts/board.mjs stage <id> approve`
- Spawn the **approver** agent. Prompt: absolute job folder, absolute worktree path, branch, main branch, "decide merge or escalate, write approval.md in the job folder".
- `node scripts/board.mjs decide-merge <id> <changed files...>` (same file list as step 4).
  - `merged`: merge per `repo.mergeMode`. Merges happen one at a time, from the main checkout, which is already on `<mainBranch>`:
    - `local`: `git merge --no-ff <branch> -m "factory: <title> (<id>)"`. One rule applies whenever `git merge` exits non-zero (a conflict because another job merged first, a hook that rejected the merge, or a refusal such as "would overwrite local changes"): do not judge by git's message, run `git rev-parse -q --verify MERGE_HEAD`. If it succeeds, a merge started: run `git merge --abort`, then `stage <id> needs-human --note "conflict or rejected merge: <git line>"`, run step 7, then step 6; do not resolve conflicts yourself. If it fails, nothing started and there is nothing to abort: `stage <id> needs-human --note "merge refused: <git line>"`, run step 7, then step 6. If `git merge --abort` fails, stop and tell the user: do not run step 7, because its commit would finish the untested merge. In both cases never go on to the tests or `merged`. `<git line>` is the first line of git's output that starts with `error:` or `CONFLICT`, with double quotes, `$` and backticks removed; if git printed no such line, it is the first non-empty line of git's output, cleaned the same way. If the merge exits 0, run the test command on main. If it fails, `git merge --abort` is no longer possible, so `git reset --keep ORIG_HEAD` (it keeps the uncommitted factory records; `--hard` would throw them away). If `reset --keep` reports an error, stop and tell the user: do not run step 7, and never retry with `--hard`. Otherwise `stage <id> needs-human --note "tests failed on main after merge"`, run step 7, then step 6.
    - `pr`: `git push -u origin <branch>` and `gh pr create --base <mainBranch> --head <branch> --title "<title>" --body-file factory/jobs/<id>/approval.md`.
    Then `node scripts/board.mjs stage <id> merged --note "<merge commit or PR url>"` and run step 7 (in both `local` and `pr` mode).
  - `needs-human`: `stage <id> needs-human --note "<why from the output>"`, run step 7, then step 6.

### 6. Park for a human
Run this after step 7, even if step 7 stopped early. Check the main checkout's branch with `git branch --show-current` instead of assuming it: it should be `<mainBranch>`. Then tell the user in three lines or fewer, with this template:

```
<id> <title>: needs you because <why>.
Work is on <branch> in <worktree>; the main checkout is on <current branch>.
Next: /factory approve <id> to merge, or /factory rework <id> <note> to send it back to the builder.
```

- If `<current branch>` is not `<mainBranch>`, add ` (expected <mainBranch>)` to line 2.
- If step 7 stopped early, add ` Records are uncommitted.` to line 1.
- If the job was parked as "conflict or rejected merge", line 3 is instead: `Next: /factory rework <id> <note> merges <mainBranch> into <branch> first (if that conflicts too, resolve it in <worktree>, commit, and run rework again); /factory approve <id> would hit the same conflict.`

Stop the loop for this job; other jobs carry on.

### 7. Record the job
Every end state (`merged`, `needs-human`, `failed`) runs this step, so the main checkout holds no uncommitted records except those of jobs still in flight. Run in this order, from the main checkout:
1. `node scripts/board.mjs validate`. If it reports errors, tell the user the errors, that the job's records are uncommitted, and that its worktree (if any) was left in place. Skip the rest of this step, and carry on with what follows step 7 on that path (step 6 for a `needs-human` job).
2. `git add factory/board.json factory/backlog.md factory/jobs/<id>`. This commits the whole board, including other jobs' in-flight stages, which is fine. Never add another job's folder; it is committed in that job's own step 7.
3. `git commit -m "factory: record <id>"`. Skip the commit when nothing is staged (`git diff --cached --quiet` exits 0).
4. Only for `merged` and `failed`: `git worktree remove <worktree>` (skip it when `<worktree>` does not exist, for example a job that failed before step 3). If `git worktree remove` fails, stop and tell the user, and leave the worktree in place: never pass `--force`, never delete it by hand. A `needs-human` job keeps its worktree for `approve` and `rework`.

Never push main yourself; the record commit stays on local main. In `pr` mode, job branches are cut from local main, so earlier record commits (and, after a human rework, this job's own) reach origin through a later job branch and its PR. That is expected.

## Running several jobs

`parallel.maxJobs` (default 1) caps the active jobs: stages `queued`, `spec`, `spec-approval`, `build`, `review`, `rework` and `approve` each hold a slot; `needs-human`, `merged` and `failed` do not. `node scripts/board.mjs slots` shows the count. Every job gets its own worktree, even at `maxJobs: 1`.

Run the active jobs in **lockstep rounds**:
1. For every active job, work out the agent it needs next (spec-writer, builder, all reviewers, or approver). Spawn every one of them, across all jobs, **in a single message**.
2. When all have returned, handle each job's results **one job at a time, in id order**: board commands, git, preflight and tests, merges, step 7, step 6. Never handle two jobs' git work at once.
3. A job that parks or ends leaves the round. A job waiting at `spec-approval` also leaves the round but keeps its slot until the user answers; then it rejoins. Start the next round with the jobs still active.

Merges only happen in step 2 of a round, one at a time, each followed by the test command on main, so every merge is tested on its own. A branch that no longer merges cleanly because another job merged first is parked by step 5 (`git merge --abort`, `needs-human`); the human recovers it with `/factory rework`.

Run one orchestrator session per repo at a time. Two sessions would both write `factory/board.json`.

## Human commands

**`/factory approve <id>`**: job must be `needs-human`. Merge per step 5's merge rules, from the main checkout (no branch change). Whenever `git merge` exits non-zero, apply step 5's `MERGE_HEAD` check, but leave the stage as is in both branches: if `git rev-parse -q --verify MERGE_HEAD` succeeds, run `git merge --abort` and tell the user to use `/factory rework <id> <note>`; if it fails, relay `<git line>`. If `git merge --abort` fails, stop and tell the user: do not run step 7. Either way never go on to the tests or `merged`. If tests fail on main after a `local` merge, run `git reset --keep ORIG_HEAD` (if it reports an error, stop and tell the user: do not run step 7, never retry with `--hard`). The job is already `needs-human`, so leave the stage as is (do not run `stage`; the board rejects `needs-human` to `needs-human`), then run step 7, then step 6. On a clean merge with passing tests: `stage <id> merged --note "human approved"` and run step 7.

**`/factory rework <id> <note>`**: job must be `needs-human`, and a slot must be free (`node scripts/board.mjs slots`). Get `<worktree>` from `node scripts/board.mjs worktree <id>`. If that folder does not exist (for example a job parked before worktrees), create it with `git worktree add <worktree> <branch>`. Then run `git -C "<worktree>" merge --no-edit <mainBranch>` so the branch carries main's latest work, including this job's record commit and other jobs' merges. If it exits non-zero, run `git -C "<worktree>" rev-parse -q --verify MERGE_HEAD`; if that succeeds, run `git -C "<worktree>" merge --abort`. If `git merge --abort` fails, stop and tell the user: do not run step 7. In both cases tell the user `<git line>` and stop: do not run `board.mjs rework` and do not resume the builder; do not resolve conflicts yourself. Then run `node scripts/board.mjs rework <id> --note "<note>"` (a human rework grants a fresh budget), resume the builder in `<worktree>` with the note plus the latest reviews, run the checks from step 3, then continue from step 4. The main checkout stays on `<mainBranch>` throughout.

**`/factory approved [<id>]`**: run `node scripts/board.mjs export <id>` (or `node scripts/board.mjs export` with no id to export the most recently merged job). On exit 0, report the export folder path it prints. On a non-zero exit, relay the error to the user without changing the board or git state. An export writes only to the vault, so no commit is made for an export.

**`/factory status`**: `node scripts/board.mjs show` and summarise as a short table: id, title, stage, rework count. With an id, show that job's history. `node scripts/board.mjs slots` adds the slot count.

## Rules

- Only you write `factory/board.json`, and only through `scripts/board.mjs`. If a command errors, read the message: it names the allowed transitions. Do not work around it.
- Agents get context from files, not from this conversation. Every agent prompt includes the absolute job folder path and, from step 3 on, the absolute worktree path.
- Never merge with failing tests. Never merge a job whose `decide-merge` says `needs-human`.
- Never force-push, never rewrite main's history except the `git reset --keep ORIG_HEAD` rollback in step 5.
- The main checkout stays on `<mainBranch>`: never change its branch. Code changes happen only in job worktrees, and each worktree is removed only by step 7, without `--force`.
- Up to `parallel.maxJobs` jobs at once, in lockstep rounds with serial git work (see "Running several jobs").
- Only you commit `factory/board.json`, `factory/backlog.md` and `factory/jobs/`, and only in step 7. Agents never stage or commit them.
- Step 7 runs `node scripts/board.mjs validate` after each job. If it reports errors, tell the user.
- Keep the user posted with one line per stage change. The dashboard (`npm run dashboard`) shows the same board live.
