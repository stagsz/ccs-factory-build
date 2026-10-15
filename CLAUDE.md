# CCS Factory Build

This repo contains an agentic software factory for Claude Code. One skill, `/factory`, turns any Claude Code session into the orchestrator. Seven single-purpose agents do the work. All state lives in files.

## Project map
- `claude-setup/skills/factory/SKILL.md`: the orchestrator loop and commands (source)
- `claude-setup/agents/`: spec-writer, builder, four reviewers, approver (source)
- `.claude/`: where Claude Code loads them from. Created by `npm run setup`; edit the source in `claude-setup/` and re-run `npm run setup -- --force`
- `factory/config.json`: models, reviewers, rework budget, risk rules, test command, merge mode
- `factory/board.json`: job states. Written only by the orchestrator, only through `scripts/board.mjs`
- `factory/backlog.md`: queue for `/factory next`
- `factory/jobs/<id>/`: one folder per job; each agent writes one file there
- `factory/templates/`: the format each agent's file must follow
- `scripts/lib/board.mjs`: deterministic core (state machine, verdicts, risk floor). Pure functions, fully tested
- `dashboard/`: live view of board.json (`npm run dashboard`)

## Rules for working on this repo
- Node 22+, ES modules, zero runtime dependencies. Keep it that way unless there is a strong reason.
- Business logic goes in `scripts/lib/board.mjs` as pure functions with tests in `tests/`. The CLI only does IO.
- Run `npm test` before every commit.
- Changing stage names or transitions means updating `STAGES`/`TRANSITIONS`, the SKILL.md steps, the dashboard columns and the tests together.
- Agent files: one job per agent, one output file per agent. If an agent needs to write a second file, that is a new agent.
- Reviewer output must end with `VERDICT: pass|changes|block`. Approver output must contain `RISK:` and `DECISION:` lines. The CLI parses these; do not change the format without changing the parser.
- Paths must work on Windows and Linux: use `node:path`, never hard-coded `/`.

## Installing the factory into another repo
Copy `claude-setup/`, `factory/`, `scripts/` and `dashboard/` into the target repo, run `npm run setup` there (or `node scripts/setup.mjs --target <repo>` from here), then set `repo.testCommand`, `repo.mainBranch` and the risk paths in `factory/config.json`.
