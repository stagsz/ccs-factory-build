# UX reviewer review: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Round: 1

## Summary
I read spec.md and the diff for the CLI, USAGE, SKILL.md and the generated index note. The feature meets the request. Error messages name the cause and the fix, exit codes are consistent (1 for every failure), and SKILL.md makes `approve` vs `approved` explicit. I found only small polish items, none blocking.

## Findings
- **note** `scripts/lib/board.mjs` (renderExportIndex): The index note shows the title twice, as the `# <title>` heading and again as a `- Title:` bullet. This is required by the spec, so it is harmless, but it reads as redundant in Obsidian. Fix (optional): leave as is, or drop the bullet in a later spec.
- **note** `scripts/board.mjs` (export): The vault check runs before the job lookup. With export off or the vault missing, a user who typed an unknown id sees the config error first and the `No job with id` error only after fixing the config. Both messages are clear and actionable, so this is acceptable. Fix (optional): look up the job first so the cheaper, more specific mistake is reported first.
- **note** `scripts/board.mjs` (USAGE): The new `export [<id>]` line is the longest in USAGE (it names `export.obsidianDir` in full), so it wraps in narrow terminals. Fix (optional): shorten to "export a merged job (default: latest) to export.obsidianDir".
- **note** `claude-setup/skills/factory/SKILL.md:22`: Dispatch is on the exact first word, so a feature request that happens to start with "approved" (for example "approved users should see ...") would be taken as the export command. Low likelihood, and the wording is clear. Fix (optional): add "when the rest of the line is empty or a job id" to the `approved` rule.
- **note** `scripts/lib/board.mjs` (exportFolderName): Reserved names become `con_` and `con_.txt`, so the `_` goes on the stem. A folder named after a record (`spec`, `request`, `build`, `approval`) also gets a `_`. This is sensible and invisible to most users.

## Checked
- Flow: no-id export of the latest merged job; unknown id; non-merged job (message names job, stage and the merged-only rule); export off; vault directory missing (message names the path and both fixes); collision folder gets the ` (<id>)` suffix and a clear error if that is also foreign.
- Copy: messages are plain, name `export.obsidianDir` and `factory/config.json`, and avoid internal jargon. The success output is the absolute folder path, which is easy to copy.
- Index note: frontmatter, `not assessed` and `none` fallbacks, history table (oldest first, `|` escaped, newlines flattened), and `[[folder/file|Label]]` links. Folder names cannot contain `# ^ [ ] |`, so the links cannot break. Full-path links resolve whether `obsidianDir` is the vault root or a subfolder (Obsidian falls back to path-suffix matching). Labels (Request, Spec, Build report, `Review: <name>`, Approval) are readable.
- SKILL.md: table row, dispatch sentence and Human commands entry match the spec. The entry says to relay errors without touching the board or git, and that no commit is made.
- Accessibility and visual design: no UI surface beyond CLI text and markdown.

VERDICT: pass
