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

Read the argument the user gave after `/factory` and pick the matching command. Anything that is not `next`, `approve`, `rework` or `status` is a feature request.

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
- When it returns, run the test command yourself. If tests fail, respawn the builder once with the failure output. If they still fail: `stage <id> failed --note "<reason>"` and stop.

### 4. Review (parallel)
- `node scripts/board.mjs stage <id> review`
- Get the diff once: `git diff <mainBranch>...<branch> --stat` and the list of changed files `git diff --name-only <mainBranch>...<branch>`.
- Spawn **all reviewers from `config.reviewers` in a single message** so they run in parallel. Each prompt: job folder, branch, main branch, "review the diff against spec.md, write reviews/<your-name>.md".
- For each reviewer: `node scripts/board.mjs verdict <id> <reviewer>`
- Then `node scripts/board.mjs decide-review <id>` and act on the answer:
  - `approve` -> step 5
  - `rework` -> `node scripts/board.mjs rework <id> --note "<one line summary of requested changes>"`. If the output says the job moved to `needs-human`, go to step 6. Otherwise resume the **builder** with every review file that is not `pass` as input, then back to step 4.
  - `needs-human` -> `stage <id> needs-human --note "<why>"`, go to step 6.

Rework budget: `maxReworkCycles` (default 2). The board enforces it, you do not count by hand.

### 5. Approve
- `node scripts/board.mjs stage <id> approve`
- Spawn the **approver** agent. Prompt: job folder, branch, "decide merge or escalate, write approval.md".
- `node scripts/board.mjs decide-merge <id> <changed files...>` (same file list as step 4).
  - `merged`: merge per `repo.mergeMode`:
    - `local`: `git switch <mainBranch> && git merge --no-ff <branch> -m "factory: <title> (<id>)"`, then run the test command on main. If it fails, `git merge --abort` is no longer possible, so `git reset --hard ORIG_HEAD`, then `stage <id> needs-human --note "tests failed on main after merge"`.
    - `pr`: `git push -u origin <branch>` and `gh pr create --base <mainBranch> --head <branch> --title "<title>" --body-file factory/jobs/<id>/approval.md`.
    Then `node scripts/board.mjs stage <id> merged --note "<merge commit or PR url>"`.
  - `needs-human`: `stage <id> needs-human --note "<why from the output>"`, go to step 6.

### 6. Park for a human
Tell the user, in three lines or fewer: job id, title, why it needs them, and the two commands they can use (`/factory approve <id>` or `/factory rework <id> <note>`). Stop the loop for this job.

## Human commands

**`/factory approve <id>`**: job must be `needs-human`. Merge per step 5's merge rules, then `stage <id> merged --note "human approved"`.

**`/factory rework <id> <note>`**: job must be `needs-human`. Run `node scripts/board.mjs rework <id> --note "<note>"` (a human rework grants a fresh budget), switch to the job branch, resume the builder with the note plus the latest reviews, then continue from step 4.

**`/factory status`**: `node scripts/board.mjs show` and summarise as a short table: id, title, stage, rework count. With an id, show that job's history.

## Rules

- Only you write `factory/board.json`, and only through `scripts/board.mjs`. If a command errors, read the message: it names the allowed transitions. Do not work around it.
- Agents get context from files, not from this conversation. Every agent prompt includes the job folder path.
- Never merge with failing tests. Never merge a job whose `decide-merge` says `needs-human`.
- Never force-push, never rewrite main's history except the `ORIG_HEAD` rollback described above.
- One job at a time in this version. Parallel jobs need git worktrees (see README roadmap).
- Run `node scripts/board.mjs validate` after each job. If it reports errors, tell the user.
- Keep the user posted with one line per stage change. The dashboard (`npm run dashboard`) shows the same board live.
