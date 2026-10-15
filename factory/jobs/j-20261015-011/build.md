# Build report: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Branch: factory/j-20261015-011-export-approved-jobs-to-an-obsidian-vaul
- Last commit: 5bfd3d0

## Files changed
- `factory/config.json`: new `"export": { "obsidianDir": "C:\\Users\\staff\\ObsidianVaults\\CCS Factory build" }`.
- `scripts/lib/board.mjs`: new "export" section with pure, exported functions: `exportDir(config, root)`, `exportFolderName(title, id)`, `chooseExportFolder(base, id, owners)`, `parseExportOwner(text)`, `latestMergedJob(board)`, `renderExportIndex(job, folder, files)`. None of them touch fs.
- `scripts/board.mjs`: new `export [<id>]` command and a `USAGE` line for it. Only `node:fs`/`node:path`; IO only.
- `claude-setup/skills/factory/SKILL.md`: Commands table row, dispatch sentence (exact first-word match, `approve` vs `approved`), "Human commands" entry for `/factory approved [<id>]`.
- `tests/board.test.mjs`: unit tests for all six lib functions.
- `tests/cli.test.mjs`: `setup()` now sets `export.obsidianDir` to `null` in the copied config, so no test can reach the real vault. New `setVault()` helper. Every export test points it at a fresh `fs.mkdtempSync` dir (or `null`/`""`/a missing path) before calling `export`. Added `export` to the help drift list and 12 export tests.
- `tests/skill.test.mjs`: one new test for the `approved` command wording.

## Acceptance criteria
Config
- [x] `export.obsidianDir` in config.json; no vault path in any `.mjs` file (checked with grep; the only matches are the project name "CCS Factory Build" in header comments).
- [x] Off when `export`, `obsidianDir` is absent, `null` or blank: `exportDir` returns `null`. A relative path resolves against the CLI root (`FACTORY_ROOT` or cwd) via `path.resolve(root, dir)`. An absolute path is used as is. Unit test plus a CLI test with relative `"vault"`.

Pure logic
- [x] `exportFolderName`: strips `< > : " / \ | ? *`, U+0000-U+001F, U+007F, `# ^ [ ]`; collapses whitespace; trims; caps at 100; trims trailing dots/spaces; reserved Windows names get `_`; empty falls back to `id`. `..` and `../../etc` cannot escape: separators are removed, and `..` alone becomes the id. See Notes for two decisions.
- [x] `chooseExportFolder`: returns `base` when it is free or owned by `id`, otherwise `` `${base} (${id})` ``.
- [x] `parseExportOwner`: reads `factory-job:` only inside leading `---` frontmatter (LF or CRLF, optional BOM, strips surrounding quotes); `null` otherwise.
- [x] `latestMergedJob`: only `stage === "merged"` jobs; compares the max `at` of each job's `merged` history entries; `null` when none.
- [x] `renderExportIndex`: frontmatter (`factory-job`, `title`, `stage`, `branch`, `risk`), `# <title>`, id/title/stage/branch list, risk level plus reasons or `not assessed`, one line per verdict or `none`, `| At | Stage | Note |` table sorted oldest first on a copy with `|` escaped and newlines flattened, Files section with `[[<folder>/<file without .md>|<label>]]` in the given order. Title and branch are JSON-quoted in frontmatter so `:` or quotes in a title cannot break the YAML. Unit test checks the job is not mutated.

CLI
- [x] No id: `latestMergedJob`; none gives `No merged job to export.` and exit 1.
- [x] Unknown id: `findJob` throws `No job with id <id>.`, exit 1.
- [x] Not merged: `Job <id> is in "<stage>". Only merged jobs can be exported.`, exit 1, vault untouched (test checks the vault dir is still empty).
- [x] Off: `Export is off: set export.obsidianDir in factory/config.json to your Obsidian vault folder.`, exit 1. Missing dir: `Export folder <path> does not exist. Create it, or fix export.obsidianDir in factory/config.json.`, exit 1, and the dir is not created.
- [x] Success: ownership is read from `<candidate>/<candidate>.md` for `base` and `base (<id>)`, folder picked by `chooseExportFolder`, records copied (`request.md`, `spec.md`, `build.md`, sorted `reviews/*.md` into `reviews/`, `approval.md`, only those that exist), index written as `<folder>/<folder>.md`, absolute folder path printed, exit 0.
- [x] Re-export writes into the same folder (it owns it through the index frontmatter), overwrites copies and the index, and never deletes. The test keeps a user-added `my notes.md`.
- [x] Read-only for the factory: only `loadConfig`, `loadBoard`, `readFileSync`, `copyFileSync` (source side) touch the repo. A test snapshots board.json and every file in the job folder before and after two exports.
- [x] Paths via `node:path` only. A path-safety assertion checks `path.resolve(vault, folder)` starts with the resolved vault plus `path.sep` (and handles a drive-root vault). `USAGE` line: `export [<id>]  export a merged job (default: the most recently merged) to export.obsidianDir`.

Skill
- [x] Commands table row for `/factory approved [<job-id>]` with the spec's wording.
- [x] Dispatch sentence lists `approved` and says `approve` and `approved` are different commands matched on the exact first word (`approve` merges `needs-human`, `approved` exports `merged`).
- [x] "Human commands" entry: run `node scripts/board.mjs export <id>` (or no id), report the printed path, on a non-zero exit relay the error without changing board or git state, no commit for an export.

## Tests
- Command: `npm test`
- Result: passed, 101/101 (72 before this job).
- Added or changed: `tests/board.test.mjs`, `tests/cli.test.mjs`, `tests/skill.test.mjs`.
- The real vault `C:\Users\staff\ObsidianVaults\CCS Factory build` exists and was still empty after the test run.

## Notes
- Reserved names with an extension: the spec says reserved names "get a `_` appended". On Windows, `con.txt_` still has the reserved stem `con` and is as unusable as `con.txt`. So the `_` goes on the stem: `CON` becomes `CON_` and `con.txt` becomes `con_.txt`. Tests cover both.
- Something the spec does not cover: the index note is `<folder>/<folder>.md`. A job titled `Spec`, `Request`, `Build` or `Approval` (any case) would therefore write its index over the copied record of the same name, and the link would point at the index. `exportFolderName` appends `_` to those four names (`Spec` becomes `Spec_`). Tested.
- Second safety check, also not in the spec: if `base` is taken and `base (<id>)` also exists but is not this job's export (no index or another `factory-job`), the CLI exits 1 (`... already exists and is not this job's export ...`) rather than writing into a folder it does not own. Tested.
- Check order in the CLI: the config/vault-dir checks run before the job lookup, so with export switched off every invocation reports the config problem first.
- Link labels: `Request`, `Spec`, `Build report`, `Approval`, `Review: <name>`.
- A merged job with no `merged` history entry is still eligible for `latestMergedJob` (it sorts as oldest), so `export` with no id never reports "No merged job" while a merged job exists.
- `.claude/` was not regenerated, as the spec requires. Run `npm run setup -- --force` after the merge for the `approved` command to reach the live skill.
- No pre-existing failures.
