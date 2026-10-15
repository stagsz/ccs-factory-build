# UI design reviewer review: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Round: 1

## Summary
The diff has no change to `dashboard/index.html`, so there is no screen UI to judge. The only visual surface is the generated Obsidian index note (`renderExportIndex` in `scripts/lib/board.mjs`). I compared its structure with the factory templates in `factory/templates/`. It fits: the same `# title` then metadata bullets then `## Section` shape, plain bullets, and a standard markdown table for history.

## Findings
- **note** `scripts/lib/board.mjs` (`renderExportIndex`): the metadata bullets use `- Id:`, where the templates use `- Job:`. The spec lists "id" without naming the label, so this is acceptable. `- Job:` would match `factory/templates/review.md` and `build.md` more closely, but changing it is optional.
- **note** `scripts/lib/board.mjs` (`renderExportIndex`): the `# <title>` heading is followed by a `- Title:` bullet that repeats it. The spec asks for both, so it is intentional. It is a little redundant to read but harmless.
- **note** `scripts/lib/board.mjs` (`renderExportIndex`): the Risk section prints a bare `- not assessed` when `risk` is null, and `- Level:` / `- Reason:` lines otherwise. The label style is consistent with the other bullets, but the null case has no `Level:` label. Optional: `- Level: not assessed`.

## Checked
- Heading hierarchy: one H1, then H2 sections (Risk, Verdicts, History, Files). This matches the templates.
- The history table has a header row and separator, escapes `|` and flattens newlines, so it renders correctly in Obsidian and GitHub.
- Frontmatter values for title and branch are JSON-quoted, which is valid YAML. Obsidian shows them in Properties without breakage.
- Link format `[[folder/file|Label]]` with human labels (Request, Spec, Build report, Approval, `Review: <name>`) is readable, and links stay scoped to this export.
- Empty states (`none`) are present for verdicts and files.
- `dashboard/`, the design tokens, and light and dark themes are untouched. Responsive layout is not applicable.
- The SKILL.md table row and the Human commands entry follow the existing wording and formatting of the neighbouring rows.

VERDICT: pass
