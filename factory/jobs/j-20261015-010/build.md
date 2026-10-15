# Build report: Guard dashboard stages against drift

- Job: j-20261015-010
- Branch: factory/j-20261015-010-guard-dashboard-stages-against-drift
- Last commit: 43a3ca3

## Files changed
- `tests/dashboard.test.mjs`: new. A local `extractStages(html)` helper, a test that the real dashboard STAGES equals the board.mjs export, and the negative extractor tests.
- `scripts/lib/board.mjs`: swapped the `"merged"` and `"needs-human"` entries in `STAGES` (each keeps its comment) so the order matches the dashboard. No other line changed.

## Acceptance criteria
- [x] New `tests/dashboard.test.mjs` reads the dashboard through a path built from `import.meta.url` (`fileURLToPath` + `path.join`) and runs `assert.deepStrictEqual(extracted, STAGES)` against `../scripts/lib/board.mjs`. The failure message names `dashboard/index.html` and `scripts/lib/board.mjs` and prints both arrays. I confirmed this by stashing the board.mjs change and running the test. It failed with the message `STAGES in dashboard/index.html [...] does not match STAGES exported from scripts/lib/board.mjs [...]`.
- [x] `extractStages` is local to the test file and has no `eval`, `Function` or `vm`. It counts `\bconst\s+STAGES\s*=` declarations and requires exactly one. It matches `const\s+STAGES\s*=\s*\[([\s\S]*?)\]\s*;`, so CRLF, LF and multi-line arrays all match. It then checks the bracket body against a strict shape regex: zero or more single- or double-quoted literals separated by commas, with whitespace allowed and an optional trailing comma. Only after that does it read the literal values.
- [x] It throws an Error containing `STAGES` and `dashboard/index.html` when there is no declaration, when there is more than one, when the value is not an array literal, or when the brackets hold anything else. The tested "anything else" cases are a variable, a spread, a template string, an empty slot (`,,`), a missing comma and a comment. The tests assert both substrings through a validation function.
- [x] Negative tests use in-memory strings only: (a) the real HTML with `queued`/`spec` swapped through `String.replace` is `notDeepStrictEqual`; (b) the real HTML with `"rework", ` removed is one shorter and `notDeepStrictEqual`; (c) input without STAGES throws; (d) CRLF multi-line, LF multi-line with no spaces, and single-quoted or mixed-quote input all extract correctly. Tests (a) and (b) first assert that the replace actually changed the text, so a no-op replace cannot pass by accident.
- [x] `board.mjs` STAGES now reads `... "approve", "needs-human", "merged", "failed"`. Each entry keeps its comment.
- [x] `npm test` passes. The commit diff lists only `scripts/lib/board.mjs` (1 line swapped) and `tests/dashboard.test.mjs`.

## Tests
- Command: `npm test`
- Result: passed, 72/72 (7 new)
- Added or changed: `tests/dashboard.test.mjs`

## Notes
- The declaration count matches `const STAGES =` whatever follows it. A second declaration that is not an array (for example `const STAGES = OTHER;`) still counts as a duplicate, and a lone non-array declaration gets its own "not a plain array literal" error.
- `dashboard/index.html`, `claude-setup/`, `.claude/` and `factory/` were not edited by the commit. This build.md is left unstaged for the orchestrator.
