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
| `/factory <feature>` | Create a job from the request and run it through the line |
| `/factory next` | Take the next `- [ ]` item from `factory/backlog.md` and run it |
| `/factory approve <job-id>` | Human approves a `needs-human` job: merge it |
| `/factory rework <job-id> <note>` | Human sends a job back to the builder with a note |
| `/factory status [<job-id>]` | Show the board, or one job's history |
| `/factory approved [<job-id>]` | Export a merged job (default: the most recently merged) to the Obsidian vault in `export.obsidianDir` |

Read the argument the user gave after `/factory` and pick the matching command by its exact first word. Anything that is not `next`, `approve`, `approved`, `rework` or `status` is a feature request. `approve` and `approved` are different commands, matched on the exact first word: `approve` merges a `needs-human` job; `approved` exports a `merged` job. Never treat one as the other.

## Before the first job

1. Read `factory/config.json` (models, reviewers, rework budget, risk rules, test command).
2. Read `CLAUDE.md` and inspect the repo once so you can tell agents its language, test command and conventions. Put what you learn in each agent's prompt; agents do not share your conversation.
3. Run `node scripts/board.mjs init`.
4. Check the working tree is clean (`git status --porcelain`). If it is not, stop and tell the user.

## The line

Every job lives in `factory/jobs/<job-id>/`. Agents read earlier files from that folder and write only their own:

```
request.md            created by board.mjs
spec.md               spec-writer
build.md              builder (report: what changed, how it was tested)
reviews/<name>.md     one per reviewer, ends with VERDICT: pass|changes|block
approval.md           approver, carries RISK: low|high and DECISION: merge|escalate
```

### 1. Create the job
- Feature: `node scripts/board.mjs new "<short title>" --request "<full request>"`
- Next: `node scripts/board.mjs next`
The command prints the job id. Use it everywhere below as `<id>`. Read the branch name with `node scripts/board.mjs show <id>`.

### 2. Spec
- `node scripts/board.mjs stage <id> spec`
- Spawn the **spec-writer** agent. Prompt: the job folder path, repo conventions, and "write spec.md".
- When it returns, confirm `spec.md` exists.
- If `humanGates.approveSpec` is true: `stage <id> spec-approval`, show the user the spec summary and stop. Continue only when the user approves (then `stage <id> build`) or asks for changes (then `stage <id> spec` and respawn the spec-writer with their notes).

### 3. Build
- `node scripts/board.mjs stage <id> build`
- Create the branch from main: `git switch -c <branch> <mainBranch>`
- Spawn the **builder** agent. Prompt: job folder, branch name, test command, "implement spec.md, commit on the branch, write build.md".
- When it returns, run the test command yourself. If tests fail, respawn the builder once with the failure output. If they still fail: `stage <id> failed --note "<reason>"`, run step 7, then stop.

### 4. Review (parallel)
- `node scripts/board.mjs stage <id> review`
- Get the diff once: `git diff <mainBranch>...<branch> --stat` and the list of changed files `git diff --name-only <mainBranch>...<branch>`.
- Spawn **all reviewers from `config.reviewers` in a single message** so they run in parallel. Each prompt: job folder, branch, main branch, "review the diff against spec.md, write reviews/<your-name>.md".
- For each reviewer: `node scripts/board.mjs verdict <id> <reviewer>`
- Then `node scripts/board.mjs decide-review <id>` and act on the answer:
  - `approve` -> step 5
  - `rework` -> `node scripts/board.mjs rework <id> --note "<one line summary of requested changes>"`. If the output says the job moved to `needs-human`, run step 7, then step 6. Otherwise resume the **builder** with every review file that is not `pass` as input, then back to step 4.
  - `needs-human` -> `stage <id> needs-human --note "<why>"`, run step 7, then step 6.

Rework budget: `maxReworkCycles` (default 2). The board enforces it, you do not count by hand.

### 5. Approve
- `node scripts/board.mjs stage <id> approve`
- Spawn the **approver** agent. Prompt: job folder, branch, "decide merge or escalate, write approval.md".
- `node scripts/board.mjs decide-merge <id> <changed files...>` (same file list as step 4).
  - `merged`: merge per `repo.mergeMode`:
    - `local`: `git switch <mainBranch> && git merge --no-ff <branch> -m "factory: <title> (<id>)"`, then run the test command on main. If it fails, `git merge --abort` is no longer possible, so `git reset --keep ORIG_HEAD` (it keeps the uncommitted factory records; `--hard` would throw them away). If `reset --keep` reports an error, stop and tell the user: do not run step 7, and never retry with `--hard`. Otherwise `stage <id> needs-human --note "tests failed on main after merge"`, run step 7, then step 6.
    - `pr`: `git push -u origin <branch>` and `gh pr create --base <mainBranch> --head <branch> --title "<title>" --body-file factory/jobs/<id>/approval.md`.
    Then `node scripts/board.mjs stage <id> merged --note "<merge commit or PR url>"` and run step 7 (in both `local` and `pr` mode).
  - `needs-human`: `stage <id> needs-human --note "<why from the output>"`, run step 7, then step 6.

### 6. Park for a human
Run this after step 7, even if step 7 stopped early (then also say the job's records are uncommitted). Tell the user, in three lines or fewer: job id, title, why it needs them, the branch the repo is actually on and that the work is on `<branch>`, and the two commands they can use (`/factory approve <id>` or `/factory rework <id> <note>`). Check the current branch with `git branch --show-current` instead of assuming it: it is `<mainBranch>` once step 7 has switched (or the repo was already on main, as on the rollback paths), and `<branch>` when step 7 stopped before switching away from the job branch (validate errors or a failed switch). Stop the loop for this job.

### 7. Record the job
Every end state (`merged`, `needs-human`, `failed`) runs this step, so the tree is clean for the next `/factory` run. Run in this order:
1. `node scripts/board.mjs validate`. If it reports errors, tell the user the errors and that the job's records are uncommitted, skip the rest of this step, and carry on with what follows step 7 on that path (step 6 for a `needs-human` job).
2. `git switch <mainBranch>` (skip if already on main). The job's factory records are uncommitted, so they come along. If the switch fails, stop and tell the user (with the step 6 message for a `needs-human` job); do not use `git stash` or `--force`.
3. `git add factory/board.json factory/backlog.md factory/jobs/<id>`
4. `git commit -m "factory: record <id>"`. Skip the commit when nothing is staged (`git diff --cached --quiet` exits 0).

Never push main yourself; the record commit stays on local main. In `pr` mode, job branches are cut from local main, so earlier record commits (and, after a human rework, this job's own) reach origin through a later job branch and its PR. That is expected.

## Human commands

**`/factory approve <id>`**: job must be `needs-human`. Merge per step 5's merge rules, then `stage <id> merged --note "human approved"` and run step 7. If tests fail on main after a `local` merge, run `git reset --keep ORIG_HEAD` (if it reports an error, stop and tell the user: do not run step 7, never retry with `--hard`). The job is already `needs-human`, so leave the stage as is (do not run `stage`; the board rejects `needs-human` to `needs-human`), then run step 7, then step 6.

**`/factory rework <id> <note>`**: job must be `needs-human`. Switch to the job branch and run `git merge --no-edit <mainBranch>` so the branch carries the job's record commit from step 7 (without it the switch drops `factory/jobs/<id>/` and the current board). If the merge reports conflicts, run `git merge --abort`, switch back to `<mainBranch>` and tell the user; do not resolve conflicts yourself. Then run `node scripts/board.mjs rework <id> --note "<note>"` (a human rework grants a fresh budget), resume the builder with the note plus the latest reviews, then continue from step 4.

**`/factory approved [<id>]`**: run `node scripts/board.mjs export <id>` (or `node scripts/board.mjs export` with no id to export the most recently merged job). On exit 0, report the export folder path it prints. On a non-zero exit, relay the error to the user without changing the board or git state. An export writes only to the vault, so no commit is made for an export.

**`/factory status`**: `node scripts/board.mjs show` and summarise as a short table: id, title, stage, rework count. With an id, show that job's history.

## Rules

- Only you write `factory/board.json`, and only through `scripts/board.mjs`. If a command errors, read the message: it names the allowed transitions. Do not work around it.
- Agents get context from files, not from this conversation. Every agent prompt includes the job folder path.
- Never merge with failing tests. Never merge a job whose `decide-merge` says `needs-human`.
- Never force-push, never rewrite main's history except the `git reset --keep ORIG_HEAD` rollback in step 5.
- One job at a time in this version. Parallel jobs need git worktrees (see README roadmap).
- Only you commit `factory/board.json`, `factory/backlog.md` and `factory/jobs/`, and only in step 7. Agents never stage or commit them.
- Step 7 runs `node scripts/board.mjs validate` after each job. If it reports errors, tell the user.
- Keep the user posted with one line per stage change. The dashboard (`npm run dashboard`) shows the same board live.
