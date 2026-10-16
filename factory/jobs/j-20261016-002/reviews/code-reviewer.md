# Code reviewer review: Show the slot count on the dashboard

- Job: j-20261016-002
- Round: 1

## Summary
The diff touches only `dashboard/index.html` and `tests/dashboard.test.mjs`. The dashboard's `ACTIVE_STAGES` and its `maxJobs` fallback match `scripts/lib/board.mjs`. The drift guard fails when the list drifts, and the `extractStages` to `extractArray` refactor keeps the old guard's behaviour. I ran `npm test` in the worktree: 127 pass, 0 fail.

## Findings
None.

## Checked
- Acceptance criteria:
  - Single `const ACTIVE_STAGES = [...]` plain literal next to `STAGES`, at html line 69: met. It equals board.mjs line 324 exactly.
  - n computed as `board.jobs.filter((j) => ACTIVE_STAGES.includes(j.stage)).length`, with no second inline stage list: met.
  - max: `v = config?.parallel?.maxJobs; Number.isInteger(v) && v >= 1 ? v : 1`: met. This is the `maxJobs()` rule except it falls back to 1 instead of throwing. It handles unset, null, non-integer, below 1, missing `parallel` and the default `{ reviewers: [] }` config, because `config?.` covers all of them.
  - Fourth span appended after "merged" inside `#counts`, with the exact markup and tooltip from the spec, and no new CSS or elements: met.
  - Updates every 3 s because it lives in `render()`: met.
  - needs-human, merged and failed are not in `ACTIVE_STAGES`, so they do not count: met.
  - n > max shows raw values with no clamping: met.
  - Existing STAGES guard and extractor tests pass unchanged, and `npm test` passes: met.
- Drift guard: it does a `deepStrictEqual` against the exported `ACTIVE_STAGES`, with a message showing both lists. The mutation test asserts the replace changed the text and that the extracted list differs. It also asserts `STAGES` is untouched, so it would fail if the guard stopped detecting drift.
- Refactor: the regex shapes, error branches and messages are identical to the old `extractStages` except that the name is parameterized. `\bconst\s+STAGES` cannot match `const ACTIVE_STAGES` (no word boundary between `_` and `S`), and a test covers this. The old tests still pass through the `extractStages` wrapper. The existing STAGES mutation tests still hit STAGES because `replace` takes the first occurrence and STAGES is declared first.
- `name` is interpolated into a RegExp. Callers pass only plain identifiers, and the comment says so, so this is acceptable.
- Scope: `git diff --stat` shows only the two allowed files. There is no debug output, commented-out code or new dependency. The style is ESM with `node:test`, as in the repo.
- Did not start a server.

VERDICT: pass
