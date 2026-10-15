# Factory backlog

`/factory next` takes the first unchecked item, creates a job and marks it `[~]` with the job id.
Format: `- [ ] Short title :: optional longer request for the spec writer`

- [~] Add a list command to the board CLI :: Add `node scripts/board.mjs list` that prints one line per job (id, stage, rework count, title) as an aligned plain-text table, newest last, and "No jobs." when the board is empty. Read-only. Put the row formatting in scripts/lib/board.mjs as a pure function with unit tests in tests/board.test.mjs, add a CLI test in tests/cli.test.mjs, and add the command to USAGE. (j-20261015-003)
- [~] Pin line endings for factory files :: Add a .gitattributes so *.md, *.json, *.mjs and *.html are stored and checked out with LF. Git currently warns "LF will be replaced by CRLF" for every factory/jobs file on Windows. Do not renormalise unrelated files beyond what the attributes require; npm test must still pass. (j-20261015-004)
- [~] Commit factory records after each job :: The orchestrator leaves factory/board.json and factory/jobs/<id>/ uncommitted after a job, so the next job fails the clean-tree check. Add a final step to claude-setup/skills/factory/SKILL.md: after `stage <id> merged` (and after parking a job as needs-human or failed), commit factory/board.json, factory/backlog.md and factory/jobs/<id>/ on main with message "factory: record <id>". Keep agents forbidden from touching these files. (j-20261015-005)
