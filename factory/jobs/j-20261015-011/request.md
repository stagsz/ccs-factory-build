# Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Branch: factory/j-20261015-011-export-approved-jobs-to-an-obsidian-vaul
- Source: cli
- Created: 2026-10-15T20:14:21.599Z

## Request

Add a way to save finished factory jobs to the user's Obsidian vault. (1) New config key in factory/config.json, e.g. "export": { "obsidianDir": "C:\Users\staff\ObsidianVaults\CCS Factory build" } (null/absent = feature off; never hard-code the path in code, since the factory is installed into other repos). (2) New CLI command `node scripts/board.mjs export <id>` that copies the job's records (request.md, spec.md, build.md, reviews/*.md, approval.md, whichever exist) into a NEW folder inside obsidianDir named after the job's title (the build name), sanitised for Windows and Linux filenames (strip <>:"/\|?* and control chars, trim trailing dots/spaces). If that folder already exists for a different job, suffix it with the job id; re-exporting the same job overwrites its own folder. Also write an index note in that folder (e.g. README.md or <title>.md) with id, title, stage, branch, risk, verdicts and the stage history, plus Obsidian [[links]] to the copied files. Only jobs in stage merged may be exported; others exit non-zero with a clear message. Missing obsidianDir config exits non-zero with a clear message. Pure logic (folder-name sanitising, collision choice, index-note rendering) goes in scripts/lib/board.mjs with unit tests in tests/board.test.mjs; CLI tests in tests/cli.test.mjs using a temp dir as obsidianDir. USAGE line for the new command. (3) In claude-setup/skills/factory/SKILL.md add a human command `/factory approved [<id>]` (distinct from the existing `/factory approve <id>`): with an id, export that merged job; without one, export the most recently merged job. Add it to the Commands table. Update tests/skill.test.mjs if it asserts the command list. Zero runtime dependencies, node:path/node:fs only.
