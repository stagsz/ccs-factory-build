# Spec: Guard dashboard stages against drift

- Job: j-20261015-010
- Branch: factory/j-20261015-010-guard-dashboard-stages-against-drift

## Goal
`npm test` fails, with a clear message, whenever the `STAGES` array hard-coded in `dashboard/index.html` stops matching the `STAGES` exported from `scripts/lib/board.mjs`, in content or order.

## Context
- `scripts/lib/board.mjs:9-20` exports `STAGES` as a multi-line array with trailing comments. Today's order is `queued, spec, spec-approval, build, review, rework, approve, merged, needs-human, failed`.
- `dashboard/index.html:68` has `const STAGES = ["queued", "spec", "spec-approval", "build", "review", "rework", "approve", "needs-human", "merged", "failed"];` on one line. This is the order the dashboard columns are drawn in (`render()`, line 78).
- **The two have already drifted.** They hold the same names, but `merged` and `needs-human` are swapped. An exact-order test written against the current tree fails.
- In `board.mjs`, `STAGES` order only shows up in the `Unknown stage` error text (line 140). Line 305 checks membership only. No test asserts that order, and no other code under `scripts/`, `tests/` or `claude-setup/` reads it.
- Test conventions are in `tests/skill.test.mjs`: `node:test`, `node:assert/strict`, and paths built from `import.meta.url` with `fileURLToPath` and `path.join`.

## Acceptance criteria
- [ ] New file `tests/dashboard.test.mjs` reads `dashboard/index.html` through a path built from `import.meta.url`, extracts the `STAGES` literal and runs `assert.deepStrictEqual(extracted, STAGES)` against the export from `../scripts/lib/board.mjs`. The failure message names both files.
- [ ] The extractor is a local helper, `extractStages(html)`, and it never runs page code: no `eval`, no `Function`, no `vm`. It finds exactly one `const STAGES = [ ... ];` with a regex that uses `\s*` around tokens, so CRLF, LF and multi-line arrays all work. It reads the string literals inside the brackets (single or double quotes) and checks that nothing else is left except commas, whitespace and an optional trailing comma.
- [ ] `extractStages` throws an Error that contains `STAGES` and `dashboard/index.html` in each of these cases: no declaration, more than one declaration, or the brackets contain anything other than plain string literals (for example a variable, a spread or a template string).
- [ ] Negative tests on the extractor prove that drift is caught. They use inline strings and never write to the real dashboard: (a) a reordered copy of the real `index.html` text, built in memory with `String.replace`, extracts to an array that is `notDeepStrictEqual` to `STAGES`; (b) a copy with one stage removed fails the same way; (c) input with no `STAGES` throws; (d) CRLF, multi-line and single-quoted input extract correctly.
- [ ] To clear the drift that already exists, swap `"merged"` and `"needs-human"` in `scripts/lib/board.mjs` `STAGES`, so the array reads `... "approve", "needs-human", "merged", "failed"`. Keep each entry's comment. Do not change any other line in `board.mjs`.
- [ ] `npm test` passes, and `git diff --stat` lists only `tests/dashboard.test.mjs` and `scripts/lib/board.mjs`.

## Out of scope
- `dashboard/index.html` (no edits at all), `claude-setup/`, `.claude/`, everything under `factory/`, `README.md`, `CLAUDE.md`.
- `TRANSITIONS`, `TERMINAL`, stage names, or any other logic in `board.mjs`.
- Moving the dashboard to import `STAGES` or to fetch it from the server.

## Tests
- Add `tests/dashboard.test.mjs` with the real-file equality test and the extractor tests (a)-(d) above.
- Leave existing tests as they are. All of them must still pass after the reorder.

## Risks
- The `board.mjs` edit touches the deterministic core, but it changes order only. The single visible effect is the order of names in the `Unknown stage ... Stages:` error text. No path in `alwaysEscalatePaths` is touched.

## Assumptions
- The request asks for the order to match and says not to restructure the dashboard. The orchestrator also rules out edits to `dashboard/index.html`. That leaves two options: weaken the test to ignore order, or change the order in `board.mjs`. This spec changes `board.mjs`, because its order has no behavioural effect, while the dashboard order is the column order users see. Ending with `needs-human, merged, failed` also puts the two terminal stages last.
- `extractStages` stays inside the test file and is not exported from `board.mjs`. The rule that business logic lives in `board.mjs` covers runtime logic, not test helpers.
