# Code reviewer review: Guard dashboard stages against drift

- Job: j-20261015-010
- Round: 1

## Summary
I checked the diff against every acceptance criterion in spec.md and ran `npm test` (72 pass, 0 fail). All criteria are met. The extractor is strict, never runs page code, and the negative tests would fail if the guard broke. The `board.mjs` change is a one-line swap with comments kept.

## Findings
- **note** `tests/dashboard.test.mjs:15`: the lazy `[\s\S]*?\]\s*;` stops at the first `];`. A literal with `]` inside a string would fail the shape check and throw, which is the safe direction. Fix: none needed.
- **note** `tests/dashboard.test.mjs:41`: the reorder and removal tests depend on the exact text `"queued", "spec",` and `"rework", ` in `index.html`. The `assert.notEqual` setup guard turns a future formatting change into a loud failure instead of a silent pass. Fix: none needed.

## Checked
- AC1: path built with `fileURLToPath` and `path.join`. `deepStrictEqual(extracted, STAGES)` message names both files and prints both arrays.
- AC2: no `eval`, `Function` or `vm`. It counts declarations and requires exactly one. The regex uses `\s*`. The shape regex allows only quoted literals, commas, whitespace and an optional trailing comma. CRLF, LF, multi-line and single quotes are all tested.
- AC3: errors contain `STAGES` and `dashboard/index.html`. Tested cases are no declaration, duplicate, variable, spread, template string, `,,`, a missing comma, a comment and a non-array value.
- AC4: tests (a) to (d) use in-memory strings only and never write files.
- AC5: `board.mjs` now reads `approve, needs-human, merged, failed`, which matches `dashboard/index.html:68`. Only those two lines changed.
- AC6: `git diff --stat main...branch` lists only `scripts/lib/board.mjs` and `tests/dashboard.test.mjs`. 72 tests pass.
- Order dependence: `STAGES` is referenced only in `scripts/lib/board.mjs` and the new test. It is not used in `claude-setup/`. `TRANSITIONS` is keyed by name, so the reorder has no effect on it. Only the `Unknown stage` error text changes, and no existing test asserts that order.
- No dead code, debug output or commented-out blocks. Style matches `tests/skill.test.mjs`.

VERDICT: pass
