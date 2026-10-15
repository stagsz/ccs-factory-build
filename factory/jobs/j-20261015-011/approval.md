# Approval: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Branch: factory/j-20261015-011-export-approved-jobs-to-an-obsidian-vaul
- Rework cycles: 0

## What changed
This adds `node scripts/board.mjs export [<id>]`. It copies a merged job's records (request, spec, build, reviews, approval) into a new folder inside `export.obsidianDir` and writes an index note with frontmatter, verdicts, history and `[[links]]`. The naming, collision and rendering logic is pure code in `scripts/lib/board.mjs`. `factory/config.json` gets the new `export.obsidianDir` key, and `SKILL.md` gets a `/factory approved [<id>]` command, which is separate from `/factory approve <id>`. The diff touches 7 files. `npm test` passes 101/101, up from 72.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
The work is clean, but the risk floor requires escalation:
- The diff touches `factory/config.json` and `claude-setup/skills/factory/SKILL.md`. Both are in `alwaysEscalatePaths`, and the spec expected this.
- The feature writes outside the repo, into the user's vault. It never deletes, and it is read-only toward the factory (tested).

What a human should check before merging:
1. **`SKILL.md` dispatch wording.** `approve` merges a job and `approved` only exports one. Check that the exact-first-word rule is clear enough for the orchestrator. The UX reviewer noted that a feature request starting with "approved ..." would be read as the export command.
2. **Personal path in the committed config.** `factory/config.json` now holds `C:\Users\staff\ObsidianVaults\CCS Factory build`, which includes your Windows username. If the factory is installed into another repo, that path goes with it. There it fails safely ("does not exist") because the CLI never creates the vault root. Decide whether you want that path committed.
3. **Test isolation.** In `tests/cli.test.mjs`, `setup()` forces `obsidianDir` to `null`, and every export test calls `setVault` with a temp dir first. The real vault was still empty after the test run.
4. **Things the reviewers left as optional, for later.** The folder check does not resolve symlinks or junctions. Some Windows reserved device names are not covered (`COM¹`-`COM³`, `CONIN$`). Copied records render as-is, so a Dataview JS block in them would run if that plugin is on.
5. **After merging,** run `npm run setup -- --force` so `.claude/` picks up the new `approved` command.

Three changes go beyond the spec, and all are tested: `_` goes on the stem of reserved names, titles `Spec`/`Request`/`Build`/`Approval` get a `_`, and the command refuses to write into a foreign `base (<id>)` folder. Each one makes the feature safer.

RISK: high
DECISION: escalate
