# UX reviewer review: Guard dashboard stages against drift

- Job: j-20261015-010
- Round: 1

## Summary
The change is developer-facing only: a drift test and a swap of two entries in `STAGES`. I checked failure-message clarity, the one user-visible ordering effect, and whether the dashboard columns are affected. All of it is fine. `npm test` passes (72 of 72).

## Findings
- **note** `scripts/lib/board.mjs:140`: The reorder changes only the order of names in the `Unknown stage ... Stages:` error text. It now reads `... approve, needs-human, merged, failed`, which matches the dashboard column order and puts the terminal stages last. `STAGES` is used only at lines 140 and 305, and 305 checks membership only. No CLI listing such as `show` depends on this order. Fix: none needed.
- **note** `tests/dashboard.test.mjs:34`: The drift failure message names both files and prints both arrays, so a developer can see what to change without opening a diff. Extractor errors all contain `STAGES in dashboard/index.html` plus a specific reason (missing, duplicate, non-literal with the offending body shown). Fix: none needed.
- **note** `tests/dashboard.test.mjs:42`: The negative tests depend on exact whitespace in `index.html` (`'"queued", "spec",'`, `'"rework", '`). If someone reformats the dashboard line, they get the clear "test setup: replace did not change the dashboard text" message instead of a silent pass. This is acceptable. Fix: none needed.

## Checked
- The diff against the spec's acceptance criteria. Only `board.mjs` and `tests/dashboard.test.mjs` changed, and the `board.mjs` change is a pure swap with comments kept.
- The dashboard `STAGES` at `dashboard/index.html:68` matches the new `board.mjs` order. Column order in `render()` is unchanged for users.
- Error copy and jargon in the extractor and assertion messages.
- Ran `npm test`: 72 pass, 0 fail.

VERDICT: pass
