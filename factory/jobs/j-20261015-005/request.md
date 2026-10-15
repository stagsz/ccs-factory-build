# Commit factory records after each job

- Job: j-20261015-005
- Branch: factory/j-20261015-005-commit-factory-records-after-each-job
- Source: backlog
- Created: 2026-10-15T17:47:52.525Z

## Request

The orchestrator leaves factory/board.json and factory/jobs/<id>/ uncommitted after a job, so the next job fails the clean-tree check. Add a final step to claude-setup/skills/factory/SKILL.md: after `stage <id> merged` (and after parking a job as needs-human or failed), commit factory/board.json, factory/backlog.md and factory/jobs/<id>/ on main with message "factory: record <id>". Keep agents forbidden from touching these files.
