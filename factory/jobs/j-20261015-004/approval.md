# Approval: Pin line endings for factory files

- Job: j-20261015-004
- Branch: factory/j-20261015-004-pin-line-endings-for-factory-files
- Rework cycles: 0

## What changed
One new file, a root `.gitattributes` (6 lines: a comment, `* text=auto`, and `text eol=lf` for `*.md`, `*.json`, `*.mjs`, `*.html`). It stops git's "LF will be replaced by CRLF" warnings on Windows and pins those file types to LF on checkout. Every tracked file was already LF in the index, so no stored content changes.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- Diff is exactly one file and one commit (cbd18e7), and it matches the spec's rules and order. I confirmed the committed blob has no CR bytes and that `git check-attr` gives the expected results (`text: set`/`eol: lf` for the pinned types, `text: auto`/`eol: unspecified` for `.gitignore`).
- It sets only `text`/`eol`. There is no `filter`, `diff`, `merge` or other driver that could run commands. It touches no auth, payments, migrations, CI, dependencies or factory config. `.gitattributes` is not in `alwaysEscalatePaths`, and 1 file is well under `maxFilesForLowRisk` (15).
- `npm test` passes 34/34. No new test was added, and the spec explains why: the change is git configuration with no JS behaviour, and a test would have to spawn git. The `check-attr` and `ls-files --eol` output recorded in build.md covers the new behaviour instead. The parsers already split on `/\r?\n/`, so LF checkouts cannot break verdict or risk parsing.
- It is repo-wide git config, but the effect is limited to line endings, a problem would show up at once as phantom diffs in `git status`, and deleting one file reverts it. No phantom diffs appear on the branch now.
- Note for contributors: 4 working-tree files (`scripts/board.mjs`, `scripts/lib/board.mjs`, `tests/board.test.mjs`, `tests/cli.test.mjs`) stay CRLF on disk until git next rewrites them. Their index content is already LF. This is expected and out of scope.

RISK: low
DECISION: merge
