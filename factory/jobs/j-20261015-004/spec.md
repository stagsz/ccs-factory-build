# Spec: Pin line endings for factory files

- Job: j-20261015-004
- Branch: factory/j-20261015-004-pin-line-endings-for-factory-files

## Goal
Add a root `.gitattributes` so `*.md`, `*.json`, `*.mjs` and `*.html` files are always stored and checked out with LF, whatever a contributor's `core.autocrlf` is set to. Git then stops warning "LF will be replaced by CRLF" when factory job files are staged on Windows.

## Context
- No `.gitattributes` exists today. System git config sets `core.autocrlf=true`, which converts LF to CRLF on checkout and causes the warning.
- Measured on main: `git ls-files --eol` reports 55 files `i/lf w/lf`, 4 files `i/lf w/crlf`, and 1 file `i/none` (the empty `factory/jobs/.gitkeep`). Every tracked text file is already LF in the index, so the new attributes change no stored content.
- Tracked file types: `.md` (agents, skill, templates, README, CLAUDE.md, job files), `.json` (`package.json`, `factory/config.json`, `factory/board.json`), `.mjs` (`scripts/`, `tests/`), `.html` (`dashboard/index.html`), plus `.gitignore` and `.gitkeep`.
- The code already handles both line endings. `scripts/lib/board.mjs` splits on `/\r?\n/` (lines 257, 270) and keeps the backlog's existing EOL (line 269). `tests/board.test.mjs:163` builds its CRLF fixture in memory. Nothing reads files from disk in a way that depends on their line endings.

## Acceptance criteria
- [ ] A new file `.gitattributes` exists at the repo root, uses LF line endings, and contains exactly these rules in this order. Comments are allowed.
  ```
  * text=auto
  *.md   text eol=lf
  *.json text eol=lf
  *.mjs  text eol=lf
  *.html text eol=lf
  ```
- [ ] The branch's diff against main changes one file, `.gitattributes`. No other tracked file is added, modified or renormalised.
- [ ] `git check-attr text eol -- README.md package.json scripts/board.mjs dashboard/index.html factory/jobs/x/spec.md` reports `text: set` and `eol: lf` for every path. The last path does not exist; `check-attr` matches it by pattern alone.
- [ ] `git check-attr text eol -- .gitignore` reports `text: auto` and `eol: unspecified`.
- [ ] After the commit, `git ls-files --eol` shows `i/lf` (or `i/none` for the empty `.gitkeep`) for every tracked file, and shows `attr/text eol=lf` for every `.md`, `.json`, `.mjs` and `.html` file.
- [ ] `npm test` passes.
- [ ] `build.md` records the output of the `git check-attr` and `git ls-files --eol` commands above, or a faithful summary of it, as the verification evidence.

## Out of scope
- Running `git add --renormalize .`, `git add -A` or `git add .`. The working tree has uncommitted changes to `factory/board.json`, `factory/backlog.md` and `factory/jobs/`, and the builder must never stage those. Stage `.gitattributes` by name only.
- Converting the 4 working-tree files that are `w/crlf` to LF, or re-checking out files to rewrite them. Their index content is already LF, and they will come out as LF on the next checkout.
- Changing `core.autocrlf` or any other git config, the `.editorconfig`, `scripts/setup.mjs`, README install steps, or `factory/config.json`.
- Adding patterns for file types the request does not name, such as `*.js`, `*.css`, `*.sh` or `*.ps1`.

## Tests
- No new test in `tests/`. Verification is by the git commands above, recorded in `build.md`. Reasons:
  - The change is git configuration with no JS behaviour.
  - A test would have to spawn `git` and would fail when `npm test` runs outside a git checkout.
  - A test that only reads `.gitattributes` as text would just repeat the diff.
- Run the existing suite with `npm test` to confirm nothing depends on CRLF.

## Risks
- Config (low): `.gitattributes` changes how git converts line endings for every contributor. All tracked files are already `i/lf`, so stored content does not change. On a fresh Windows checkout, `.md`/`.json`/`.mjs`/`.html` files will be LF instead of CRLF. Node and the existing parsers handle both.
- `.gitattributes` is not in `alwaysEscalatePaths`, so the approver's risk floor will not catch it automatically. A reviewer should confirm that the diff is exactly one file.

## Assumptions
- `* text=auto` is included as the default so that other text files (`.gitignore`, future files) are also normalised to LF in the index, regardless of anyone's `core.autocrlf`. It changes no stored content today because every file is already `i/lf`. It sets no checkout EOL for those files, so they keep following the local `core.autocrlf`. Only the four named types are pinned to LF on checkout.
- "Do not renormalise unrelated files" means the commit contains only `.gitattributes`. The measured `i/lf` state shows that no renormalisation commit is needed.
- The empty `factory/jobs/.gitkeep` (`i/none`) needs no handling.
