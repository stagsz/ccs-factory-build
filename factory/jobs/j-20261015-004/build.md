# Build report: Pin line endings for factory files

- Job: j-20261015-004
- Branch: factory/j-20261015-004-pin-line-endings-for-factory-files
- Last commit: cbd18e7

## Files changed
- `.gitattributes` (new, repo root): one comment line plus the five required rules in the required order (`* text=auto`, then `*.md`, `*.json`, `*.mjs`, `*.html` with `text eol=lf`). The file was written with LF line endings. It was staged by name only.

## Acceptance criteria
- [x] `.gitattributes` exists at root, LF, exact rules in order: the content is the five spec lines in order, preceded by one `#` comment. `git ls-files --eol .gitattributes` reports `i/lf    w/lf    attr/text=auto`.
- [x] Diff against main changes one file: `git diff --name-status main..HEAD` gives only `A	.gitattributes`. No `git add -A`, `git add .` or `--renormalize` was run. The orchestrator's uncommitted `factory/board.json`, `factory/backlog.md` and `factory/jobs/j-20261015-004/` stay unstaged.
- [x] `check-attr` for named paths reports `text: set` / `eol: lf`:
  ```
  README.md: text: set
  README.md: eol: lf
  package.json: text: set
  package.json: eol: lf
  scripts/board.mjs: text: set
  scripts/board.mjs: eol: lf
  dashboard/index.html: text: set
  dashboard/index.html: eol: lf
  factory/jobs/x/spec.md: text: set
  factory/jobs/x/spec.md: eol: lf
  ```
- [x] `git check-attr text eol -- .gitignore`:
  ```
  .gitignore: text: auto
  .gitignore: eol: unspecified
  ```
- [x] `git ls-files --eol` after commit: 61 tracked files. Index column: 60 `i/lf` and 1 `i/none` (`factory/jobs/.gitkeep`, which is empty). Every `.md`, `.json`, `.mjs` and `.html` file shows `attr/text eol=lf`. The three files of other types (`.gitattributes`, `.gitignore`, `.gitkeep`) show `attr/text=auto`. Working-tree column: 56 `w/lf`, 1 `w/none` and 4 `w/crlf`. The 4 `w/crlf` files are the ones the spec expected and puts out of scope:
  ```
  i/lf    w/crlf  attr/text eol=lf      	scripts/board.mjs
  i/lf    w/crlf  attr/text eol=lf      	scripts/lib/board.mjs
  i/lf    w/crlf  attr/text eol=lf      	tests/board.test.mjs
  i/lf    w/crlf  attr/text eol=lf      	tests/cli.test.mjs
  ```
- [x] `npm test` passes: 34/34.
- [x] build.md records the verification evidence: see the outputs above.

## Tests
- Command: `npm test`
- Result: passed. 34 tests, 34 pass, 0 fail, 0 skipped.
- Added or changed: none. The spec says to verify with the git commands only.

## Notes
- The 4 `w/crlf` working-tree files were left as they are, as the spec requires. Their index content is LF, so they will check out as LF next time git rewrites them.
- Staging `.gitattributes` printed git's "LF will be replaced by CRLF the next time Git touches it" warning. Git checked attributes before the new file was in place, so it applied `core.autocrlf=true` to `.gitattributes` itself. That file matches only `* text=auto` (no `eol`), so on checkout it still follows the local `core.autocrlf`, as the spec's Assumptions section describes. Its index copy is LF.
- No pre-existing test failures.
