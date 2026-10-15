# Spec: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Branch: factory/j-20261015-011-export-approved-jobs-to-an-obsidian-vaul

## Goal
Let the user save a finished (merged) factory job's records to their Obsidian vault as one folder per job, named after the job's title, with an index note that links everything. They run it with `/factory approved [<id>]` or `node scripts/board.mjs export [<id>]`.

## Context
- `scripts/board.mjs`: CLI. `commands` object, `USAGE` string, `FACTORY_ROOT`/`B.paths(root)`, errors thrown inside a command go to stderr and exit 1. `history`/`list` show the split: pure formatting in lib, IO in CLI.
- `scripts/lib/board.mjs`: pure logic (`formatJobHistory`, `findJob`, `loadConfig`, `STAGES`, `TERMINAL`). Job shape: `id, title, stage, branch, risk ({level, reasons} | null), verdicts ({reviewer: verdict}), history ([{stage, at, note}])`.
- `factory/config.json`: no `export` key today.
- `claude-setup/skills/factory/SKILL.md`: Commands table (line 14-20), argument dispatch sentence (line 22), "Human commands" section. `/factory approve <id>` merges a `needs-human` job.
- `tests/cli.test.mjs`: `setup()` copies the **real** `factory/config.json` into a temp root. `tests/skill.test.mjs` asserts SKILL.md text.

## Acceptance criteria
Config
- [ ] `factory/config.json` gains `"export": { "obsidianDir": "C:\\Users\\staff\\ObsidianVaults\\CCS Factory build" }`. No vault path appears in any `.mjs` file.
- [ ] `export` absent, `export.obsidianDir` absent, `null` or empty string means the feature is off. A relative `obsidianDir` resolves against the repo root (`FACTORY_ROOT`); an absolute one is used as is.

Pure logic in `scripts/lib/board.mjs` (exported, no fs access)
- [ ] `exportFolderName(title, id)`: removes `< > : " / \ | ? *`, control chars (U+0000-U+001F, U+007F) and the Obsidian link breakers `# ^ [ ]`; collapses runs of whitespace to one space; trims; caps at 100 chars; then trims trailing dots and spaces. Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9`, case-insensitive, also with an extension like `con.txt`) get a `_` appended. An empty result falls back to `id`.
- [ ] `chooseExportFolder(base, id, owners)`: `owners` is a `Map` of existing folder name to the job id that owns it (or `null` if the folder exists but is not a factory export). Returns `base` when `base` is not in `owners` or is owned by `id`; otherwise returns `` `${base} (${id})` ``.
- [ ] `parseExportOwner(text)`: returns the value of the `factory-job:` line in the note's leading YAML frontmatter, or `null`.
- [ ] `latestMergedJob(board)`: among jobs with `stage === "merged"`, returns the one whose latest history entry with `stage: "merged"` has the greatest `at`; `null` when none.
- [ ] `renderExportIndex(job, folder, files)` returns markdown with: frontmatter (`factory-job`, `title`, `stage`, `branch`, `risk`); a `# <title>` heading; id, title, stage, branch; risk as level plus reasons (or `not assessed` when `risk` is null); one line per verdict (or `none`); the stage history as a table `| At | Stage | Note |`, oldest first, with `|` in notes escaped as `\|` and newlines replaced by spaces; a Files section with one `[[<folder>/<file without .md>|<label>]]` link per entry in `files` (posix relative paths, e.g. `reviews/code-reviewer.md`), in the order given. Pure: does not mutate `job`.

CLI `node scripts/board.mjs export [<id>]`
- [ ] With no id, exports `latestMergedJob(board)`; if none, exits 1 with `No merged job to export.`
- [ ] Unknown id exits 1 with the existing `No job with id <id>.` message.
- [ ] A job not in `merged` exits 1 with a message naming the job, its current stage and that only merged jobs can be exported. Nothing is written.
- [ ] Missing/empty `export.obsidianDir` exits 1 with a message naming `export.obsidianDir` and `factory/config.json`. An `obsidianDir` that does not exist exits 1 naming the path; the CLI never creates the vault root itself.
- [ ] On success, creates `<obsidianDir>/<folder>/` (folder from `chooseExportFolder`, ownership read via `parseExportOwner` from each candidate folder's `<name>.md`), copies whichever of `request.md`, `spec.md`, `build.md`, `reviews/*.md`, `approval.md` exist (reviews into a `reviews/` subfolder, sorted by name), writes the index note as `<folder>/<folder>.md`, and prints the absolute export folder path. Exits 0.
- [ ] Re-exporting the same job writes into the same folder and overwrites the copied files and index note. It never deletes files in the vault.
- [ ] Export is read-only for the factory: `board.json` and `factory/jobs/<id>/` are byte-identical after the command.
- [ ] All paths built with `node:path`; only `node:fs`/`node:path` used. `USAGE` has a line `export [<id>]` describing it (export a merged job, default most recently merged, to `export.obsidianDir`).

Skill
- [ ] SKILL.md Commands table has a row for `/factory approved [<job-id>]`: "Export a merged job (default: the most recently merged) to the Obsidian vault in `export.obsidianDir`".
- [ ] The dispatch sentence lists `approved` and states that `approved` and `approve` are different commands matched on the exact first word (`approve` merges a `needs-human` job; `approved` exports a `merged` job).
- [ ] "Human commands" has a `/factory approved [<id>]` entry: run `node scripts/board.mjs export <id>` (or `export` with no id), report the printed folder path, and on a non-zero exit relay the error to the user without changing the board or git state. No commit is made for an export.

## Out of scope
- `.claude/` (generated; do not edit or regenerate), `dashboard/`, `README.md`, agent files, `STAGES`/`TRANSITIONS`.
- Exporting automatically at merge time; exporting non-merged or failed jobs; deleting or pruning vault files.
- Any change to existing command behaviour or output.

## Tests
- `tests/board.test.mjs`: `exportFolderName` (each forbidden char, control chars, `#^[]`, trailing dots/spaces, reserved names incl. `con.txt`, 100-char cap, empty -> id); `chooseExportFolder` (free, owned by same id, owned by other id, foreign folder with `null` owner); `parseExportOwner` (present, absent, no frontmatter); `latestMergedJob` (none, several merged with out-of-order history, ignores non-merged); `renderExportIndex` (fields, `not assessed`, `none` verdicts, history order, `|` escaping, links only for given files, input not mutated).
- `tests/cli.test.mjs`: every export test rewrites the temp root's `factory/config.json` so `export.obsidianDir` points at a fresh `fs.mkdtempSync` dir (or `null` for the off case) **before** calling `export`. Cover: merged job export (files + reviews copied, index note links, path printed); no-id picks most recently merged; non-merged job exits 1, vault dir still empty; obsidianDir null exits 1; obsidianDir missing on disk exits 1; collision with another job's folder gets ` (<id>)` suffix; re-export overwrites the same folder and keeps a user-added file; board.json unchanged after export; `help` output contains `export [<id>]`.
- `tests/skill.test.mjs`: new test asserting SKILL.md contains `/factory approved [<job-id>]`, `node scripts/board.mjs export`, and still contains `/factory approve <job-id>`.

## Risks
- Config and skill: touches `factory/config.json` and `claude-setup/**`, both in `alwaysEscalatePaths`, so the risk floor will route this job to `needs-human`. Expected.
- Writes outside the repo (the user's vault). Tests copy the real config, which will now hold the real vault path: a test that forgets to override `obsidianDir` would write into `C:\Users\staff\ObsidianVaults\CCS Factory build`. Reviewers should check every export test overrides it.
- Path safety: the folder name comes from a user-supplied title; sanitising must make `..` or separators impossible to escape `obsidianDir`. Builder should assert `path.resolve(target)` starts with `path.resolve(obsidianDir) + path.sep`.
- Orchestrator parsing: `approve` vs `approved` mix-up would merge or export the wrong thing; the SKILL.md wording must make the exact-word match explicit.

## Assumptions
- `export` without an id is added to the CLI (request only names `export <id>`) so "most recently merged" is decided deterministically in lib code, not by the orchestrator. "Most recently merged" = latest `at` of a `merged` history entry.
- Folder ownership is recorded in the index note's frontmatter (`factory-job: <id>`); the index note is named `<folder>.md` (Obsidian folder-note convention).
- Re-export overwrites but never deletes, so notes the user added in Obsidian survive.
- A missing `obsidianDir` on disk is an error rather than auto-created, to catch typos in config.
- Links use `[[<folder>/<file>|label]]` so they resolve to this export, not to same-named notes from other exports.
