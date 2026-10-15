# CCS Factory Build

An agentic software factory for Claude Code. A team of single-purpose AI agents takes a feature from idea to merged code: write the spec, build it, review it in parallel, approve it. One skill runs the loop; all state lives in files you can read, diff and audit.

```
trigger -> spec -> build -> 4 parallel reviews -> approve -> merge
                     ^              |                  |
                     +-- rework ----+ (max 2)          +-- escalate -> needs human
```

## The line

| Stage | Agent | Model | Writes |
|---|---|---|---|
| Spec | `spec-writer` | Opus | `spec.md` |
| Build | `builder` | Opus | code on the feature branch + `build.md` |
| Review | `security-reviewer` | Opus | `reviews/security-reviewer.md` |
| | `ux-reviewer` | Sonnet | `reviews/ux-reviewer.md` |
| | `ui-design-reviewer` | Sonnet | `reviews/ui-design-reviewer.md` |
| | `code-reviewer` | Sonnet | `reviews/code-reviewer.md` |
| Approve | `approver` | Opus | `approval.md` |

The Claude Code session that runs `/factory` becomes the **orchestrator**: it runs the loop, spawns every agent, and is the only writer of `factory/board.json`.

## Design principles

1. **Files hold the state.** Agents get context from files in `factory/jobs/<id>/`, not from the conversation. Each agent writes only its own file.
2. **Deterministic stages around unstructured work.** Agents do the judgement. `scripts/lib/board.mjs` enforces stage transitions, counts rework cycles, parses verdicts and applies a risk floor. That code is pure and tested.
3. **Two human gates.** Optional spec approval before code exists (`humanGates.approveSpec`), and merge approval whenever risk is high.
4. **Risk floor over approver judgement.** Touching auth, payments, migrations, CI, dependencies or factory config always escalates, whatever the approver says. Configure in `factory/config.json`.
5. **Audit trail.** Every job keeps its request, spec, build report, every review round and the approval, plus a timestamped stage history in the board.

## Repository layout

```
claude-setup/                 source for .claude/ (installed by npm run setup)
  skills/factory/SKILL.md     the orchestrator loop and commands
  agents/                     the seven agents (frontmatter sets model and tools)
factory/
  config.json                 models, reviewers, rework budget, risk rules, test command, merge mode
  board.json                  job states (orchestrator writes it via scripts/board.mjs only)
  backlog.md                  queue for /factory next
  templates/                  required format for spec, build, review, approval files
  jobs/<id>/                  one folder per job
scripts/
  lib/board.mjs               state machine, verdict and approval parsing, risk floor, backlog
  board.mjs                   CLI the orchestrator calls
  serve.mjs                   local dashboard server
  setup.mjs                   installs claude-setup/ into .claude/
dashboard/index.html          live board: cards move across the stages
tests/                        node:test suite for the library and the CLI
CLAUDE.md                     rules for working on this repo
```

## Quick start

Requirements: Claude Code, Node 22+, git.

```bash
npm run setup                 # install the /factory skill and agents into .claude/
npm test                      # no dependencies to install
npm run board -- init         # create the board
npm run dashboard             # http://localhost:4317
```

Commit the generated `.claude/` folder so the factory travels with the repo. Then in Claude Code, inside the repo:

```
/factory add a health check endpoint that returns {"status":"ok"}
```

## Commands

| Command | What it does |
|---|---|
| `/factory <feature>` | New job from the request, run through the line |
| `/factory next` | Next `- [ ]` item in `factory/backlog.md` |
| `/factory approve <job-id>` | Merge a job parked as needs-human |
| `/factory rework <job-id> <note>` | Send a job back to the builder with a note |
| `/factory status [<job-id>]` | Board summary, or one job's history |

The board CLI is also usable by hand: `npm run board -- show`, `npm run board -- validate`.

## Install into an existing repo

1. Copy `claude-setup/`, `factory/`, `scripts/` and `dashboard/` into the target repo and run `npm run setup` there, or from this repo run `node scripts/setup.mjs --target <path-to-repo>`. Existing `.claude/` files are kept unless you pass `--force`.
2. Edit `factory/config.json`:
   - `repo.testCommand`, `repo.mainBranch`, optional `lintCommand` and `buildCommand`
   - `repo.mergeMode`: `local` merges with `--no-ff`; `pr` pushes the branch and opens a PR with `gh`
   - `risk.alwaysEscalatePaths`: the paths in this repo that must never auto-merge
   - `agents.*.model` if you want different models (also update the agent's frontmatter `model:` in `claude-setup/agents/` and re-run `npm run setup -- --force`)
3. Add a line to the target repo's `CLAUDE.md` pointing at `/factory`.
4. Commit, then run `/factory` on something small first.

## Adapting the factory

- **Add a reviewer**: create `claude-setup/agents/<name>.md` (then `npm run setup`) writing `reviews/<name>.md` and ending with a `VERDICT:` line, then add `<name>` to `config.reviewers`. The orchestrator, board and dashboard pick it up.
- **Remove a reviewer**: delete it from `config.reviewers` (UI reviewers are often unneeded for backend repos).
- **Change the rework budget**: `maxReworkCycles`.
- **Change stages**: update `STAGES` and `TRANSITIONS` in `scripts/lib/board.mjs`, the steps in SKILL.md, the dashboard's `STAGES`, and the tests, together.

## Limitations

- One job at a time. Agents share the working tree.
- Resuming the builder with its earlier context only works within one Claude Code session; across sessions it restarts from the files.
- The approver judges from the diff and reports; it does not run the app.

## Roadmap

- **Git worktrees** so several jobs run in parallel, one worktree per job
- **GitHub issues as intake**: label an issue, the factory picks it up
- **Agent teams** for direct reviewer-to-builder conversation instead of file round trips
- **Diagnostics on intake**: pull stack traces and logs (e.g. Sentry over MCP) into `request.md` for bug jobs
- **Browser verification**: a reviewer that drives a real browser against a preview build
- **Cleaner state tracking**: record agent session ids and token use per stage in the board

## Credits

The line structure follows the agentic software factory pattern described in ZazenCodes' "Build Your Own AI Software Factory with Claude Code".
