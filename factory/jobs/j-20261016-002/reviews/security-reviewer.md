# Security reviewer review: Show the slot count on the dashboard

- Job: j-20261016-002
- Round: 1

## Summary
I checked the diff (`dashboard/index.html`, `tests/dashboard.test.mjs`) for injection through the new "Active n/max" indicator and for how it handles hostile or malformed `/config.json` and `/board.json` values. The indicator goes through `innerHTML`, as the spec's exact markup requires. Both interpolated values are always numbers, so nothing from the data files reaches the HTML. The change adds no new trust boundary, dependency, secret or logging. `npm test` passes in the worktree (127/127).

## Findings
- **note** `dashboard/index.html:97`: the new span is written with `innerHTML`, not `textContent`. This is safe. `n` is an `Array.prototype.filter(...).length`, always a non-negative integer. `max` is either `v`, after `Number.isInteger(v)` has proven it is a number primitive, or the literal `1`. A string like `"<img onerror=...>"`, an object, an array, `null`, `NaN`, a float, `0` or a negative value all fail the guard and fall back to `1`. The worst a hostile integer can do is render as `1e+300`, which is harmless text. The `title` attribute is a static literal. `ACTIVE_STAGES.includes(j.stage)` is a strict-equality comparison and never renders `j.stage`. Fix: none needed. Switching to `textContent` would break the `<b>` markup the spec requires.
- **note** `dashboard/index.html:96`: `config?.parallel?.maxJobs` handles a missing or `null` config, a missing `parallel`, and a non-object config (a string, number or array) without throwing. If config.json fails to load, the default `{ reviewers: [] }` gives `1`. Fix: none needed.
- **note** `dashboard/index.html:85`, `:87` (existing code, not in this diff): `${j.rework}`, `${config.maxReworkCycles ?? "?"}` and `${LABEL[stage] ?? stage}` go into `innerHTML` without `esc()`. Of these, `stage` comes from the hard-coded `STAGES`. The other two come from local repo files the factory writes, so the risk is low, and changing them is out of scope for this job. Fix (optional follow-up job): wrap `j.rework` and `config.maxReworkCycles` in `esc()`.
- **note** `tests/dashboard.test.mjs:15-20`: `extractArray` builds a `RegExp` from `name` without escaping it. It is test-only code, every caller passes a hard-coded identifier, and the comment states that `name` must be a plain identifier. Fix: none needed.

## Checked
- Full diff `main...HEAD`: 2 files, both in spec scope. No other files touched.
- New indicator: interpolated values, type guarantees, `innerHTML` sink, static `title` attribute.
- Malformed config inputs: `null`/non-object config, missing `parallel`, string/float/zero/negative/`NaN`/huge `maxJobs`, failed config fetch.
- Malformed board input: `j.stage` with non-string values (strict `includes`, never rendered). A non-array `board.jobs` or a `null` job already throws in the earlier existing filters, and `load()`'s catch handles it. No new failure mode.
- No secrets, tokens, new dependencies, `eval`, dynamic imports, network calls or logging added. No change to `scripts/serve.mjs` or to what the server exposes.
- Error messages: the new test error strings name only the constant and file. No change to the page's error text.
- Tests: `npm test` in the worktree, 127 pass, 0 fail.

VERDICT: pass
