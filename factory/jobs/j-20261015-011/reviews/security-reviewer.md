# Security reviewer review: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Round: 1

## Summary
I reviewed `git diff main...factory/j-20261015-011-export-approved-jobs-to-an-obsidian-vaul` against the spec. I focused on the new write path outside the repo. A job title cannot escape `export.obsidianDir`. Separators, `:` (ADS) and control characters are stripped, and `.`/`..` collapse to the job id. A lexical containment check on the resolved target backs this up. Folders owned by another job or by the user are never written into. Tests cannot reach the real vault. I found nothing the builder must fix. The notes below are hardening ideas and residual risks the human should know about.

## Findings
- **note** `scripts/lib/board.mjs:350`: `WINDOWS_RESERVED` covers the set the spec lists. It does not cover `COM¹`-`COM³`/`LPT¹`-`LPT³` (superscript digits, which Windows also reserves) or `CONIN$`/`CONOUT$`. I probed these and they pass through unchanged. The worst case is a failed `mkdirSync` or a write to a device. Neither escapes the vault or exposes data. Fix (optional, a later job): extend the regex to `/^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/i` and add tests.
- **note** `scripts/board.mjs:183-189`: the containment check is lexical (`path.resolve`), not `fs.realpathSync`. Suppose `<vault>/<folder>` or `<vault>/<folder>/reviews` is a symlink or junction that points outside the vault. If it carries this job's `factory-job:` index, writes follow it out of the vault. Only someone who can already write to the user's vault could set this up, so it does not cross a trust boundary. Fix (optional): compare `fs.realpathSync(target)` against `fs.realpathSync(vault)` after `mkdirSync`, or refuse when `fs.lstatSync(target).isSymbolicLink()`.
- **note** `scripts/board.mjs:211`: job records are copied into the vault verbatim. If the vault has Obsidian plugins that run code on render (Dataview with JS queries, some Templater setups), a `dataviewjs` block in an agent-written spec, build or review would run when the note is opened. This is inherent to "copy the records" and the spec asks for it. The human should know about it before enabling such plugins on this vault.
- **note** `factory/config.json:23`: the committed config now holds an absolute personal path, which includes the Windows username. The spec asks for this. Per CLAUDE.md, installing the factory into another repo copies `factory/`, so the path goes with it. There it fails safely with "does not exist", because the CLI never creates the vault root.
- **note** `scripts/board.mjs:179`, `scripts/lib/board.mjs:50`: job ids from `board.json` are used as path segments (fallback folder name, `(<id>)` suffix, `P.job(id)`) without a format check. `board.json` is written only by the CLI, which generates `j-YYYYMMDD-NNN` ids. The containment check would also stop a crafted id escaping the vault. No action needed.

## Checked
- Path traversal through the title: I probed `..`, `...`, `. .`, `../../etc/passwd`, `..\..\Windows`, `C:\x`, `a:b` (ADS), NUL/control characters, `#^[]`, trailing dots/spaces/U+3000 and the 100-char cap. Every result is one safe segment or falls back to the id. `con.txt` becomes `con_.txt`, and `spec`/`Spec` get `_` so the index cannot overwrite a copied record.
- Containment check `scripts/board.mjs:183-189`: it handles a drive-root vault and rejects target == vault.
- Overwrite protection: a folder owned by another job, or a foreign folder with no index, gets the `(<id>)` suffix. If the suffixed folder exists and is not owned by this job, the command exits 1 (`scripts/board.mjs:190-192`). Re-export never deletes. A user-added file survives (test).
- `parseExportOwner` output is only compared with `job.id`, never used as a path.
- Review filenames come from `readdirSync` with `isFile()`, which skips symlinks and directories, and only `.md` files are taken. Names cannot contain separators.
- The factory side is read-only: no writes under the repo. The byte-identical test covers `board.json` and the job folder.
- Test isolation: `setup()` sets `export.obsidianDir` to `null` before any CLI call (`tests/cli.test.mjs:20`). Every export test calls `setVault` with a fresh `mkdtempSync` dir, `null`, `""` or a missing path. No other test file spawns the CLI. The real vault `C:\Users\staff\ObsidianVaults\CCS Factory build` is still empty.
- No vault path in any `.mjs` file (grep).
- Frontmatter injection: `title`/`branch` are JSON-quoted, and newlines are flattened in the heading, list and table cells.
- Secrets/credentials: none added. No new dependencies. Only `node:fs`/`node:path`. No eval or dynamic import.
- Error messages show only the user's own configured path and the job id/stage. No stack traces or other internals.
- Authorization/scope: `/factory approved` only reads merged jobs and writes to the configured vault. No board or git changes, and no commit. The SKILL.md wording keeps `approve` (merge) and `approved` (export) apart by exact first-word match, so an export cannot trigger a merge. This matches the spec.

VERDICT: pass
