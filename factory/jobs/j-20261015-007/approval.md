# Approval: Close backlog items when a job ends

- Job: j-20261015-007
- Branch: factory/j-20261015-007-close-backlog-items-when-a-job-ends
- Rework cycles: 0

## What changed
Added a new pure function, `closeBacklogItem(markdown, jobId, mark)`, to `scripts/lib/board.mjs`. When a backlog-sourced job's `stage` command moves it to `merged`, the function rewrites the job's `[~]` line in `factory/backlog.md` to `[x]`. When the job moves to `failed`, the line becomes `[!]`. The function matches the id exactly, keeps CRLF/LF line endings, and returns the same string when no line matches. The board CLI writes the result only when the content changed, and only if backlog.md exists. The marker legend is now documented in the code comment and in the README `/factory next` row. 7 unit tests and 3 CLI tests were added, and the full-line CLI test was extended.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- All four reviewers passed in round 1 with no rework. Their findings are notes only.
- The diff matches the spec. It touches 5 files (README.md, scripts/board.mjs, scripts/lib/board.mjs, tests/board.test.mjs, tests/cli.test.mjs), which is well under the 15-file limit. No alwaysEscalatePaths file changed: no auth, payments, migrations, CI, `.claude/`, `claude-setup/`, `factory/config.json` or package files.
- The request's "update the format note in backlog.md" was moved to the orchestrator in the spec on purpose. The builder correctly left `factory/` alone.
- I re-ran `npm test`: 48 pass, 0 fail. The tests cover both marks, both EOL styles, the id-prefix collision (`j-1`/`j-11`), already-closed lines, an invalid mark, cli-source jobs (byte-identical), and a missing backlog.md.
- The blast radius is small. The only new side effect is a checkbox rewrite on `[~]` lines that end in the exact `(<id>)`. It runs after the board is saved, and a revert is one commit.
- Follow-up for the orchestrator (not a blocker): retro-close the stale `[~]` lines for j-20261015-003 to 006, and update the format note at the top of backlog.md.

RISK: low
DECISION: merge
