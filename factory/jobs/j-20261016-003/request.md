# Friendly preflight error outside a git repo

- Job: j-20261016-003
- Branch: factory/j-20261016-003-friendly-preflight-error-outside-a-git-r
- Source: backlog
- Created: 2026-10-16T09:59:18.682Z

## Request

`node scripts/board.mjs preflight` shells out to `git status` and, when FACTORY_ROOT (or cwd) is not inside a git work tree, prints git's raw "fatal: not a git repository" output. Catch that case in scripts/board.mjs and print one clear line instead, e.g. "error: preflight needs a git repository at <root>", exiting 1 as before; other git failures keep their current behaviour. Add a CLI test in tests/cli.test.mjs that runs preflight in a plain temp dir (no git init) and checks the message and exit code. Only scripts/board.mjs and tests/cli.test.mjs should change.
