# Build report: Show the slot count on the dashboard

- Job: j-20261016-002
- Branch: factory/j-20261016-002-show-the-slot-count-on-the-dashboard
- Last commit: 8edd905

## Files changed
- `dashboard/index.html`: added `const ACTIVE_STAGES = [...]` on the line after `const STAGES`. In `render()`, compute `n` from `ACTIVE_STAGES.includes(j.stage)` and `max` from `config?.parallel?.maxJobs` with a never-throw fallback to 1. Append the "Active n/max" span to `#counts`.
- `tests/dashboard.test.mjs`: generalized `extractStages` into `extractArray(html, name)`. Kept `extractStages = (html) => extractArray(html, "STAGES")` and imported `ACTIVE_STAGES`. Added 5 tests.

## Acceptance criteria
- [x] Exactly one `const ACTIVE_STAGES = ["queued", "spec", "spec-approval", "build", "review", "rework", "approve"];`, a plain array literal next to `const STAGES`: added at dashboard/index.html line 69. The drift guard test checks that it is declared exactly once, is a plain literal and equals the export from board.mjs.
- [x] n = `board.jobs.filter((j) => ACTIVE_STAGES.includes(j.stage)).length`, with no second inline stage list: the expression is used exactly as written.
- [x] max uses the `maxJobs()` rule but never throws: `const v = config?.parallel?.maxJobs; const max = Number.isInteger(v) && v >= 1 ? v : 1;`. A stubbed-DOM run (scratch only, not committed) gives 3 for `{maxJobs: 3}`. It gives 1 when `parallel` is missing, and for `null`, `2.5`, `0`, `"3"` and a `null` config.
- [x] Fourth `<span>` after "merged" inside `#counts`, with markup exactly `<span title="Jobs holding a slot (parallel.maxJobs)">Active <b>${n}/${max}</b></span>`. No new CSS, classes, elements or dependencies.
- [x] Updates on every 3 s refresh: the span is built in `render()`, which `load()` calls on every `setInterval(load, 3000)` tick.
- [x] needs-human, merged and failed jobs do not count: they are not in `ACTIVE_STAGES`. In the stubbed run, one job in each of the 10 stages gave n = 7.
- [x] n > max shows raw values: there is no clamping. The stubbed run showed "Active 7/3".
- [x] The existing STAGES drift guard and extractor tests are unchanged and pass. `npm test` passes.

## Tests
- Command: `npm test`
- Result: passed, 127/127 (0 fail). `tests/dashboard.test.mjs` passes 12/12: the 7 existing tests plus 5 new ones.
- Added or changed: `tests/dashboard.test.mjs`. New tests:
  - "extractStages does not count a const ACTIVE_STAGES declaration as STAGES" (the word-boundary check)
  - "extractArray names the constant in its errors"
  - "dashboard/index.html ACTIVE_STAGES matches ACTIVE_STAGES exported from scripts/lib/board.mjs"
  - "extractArray catches a dashboard ACTIVE_STAGES with a stage removed": the mutation removes `"approve"` only inside the ACTIVE_STAGES literal. The test asserts that the text changed, that the list no longer equals the export, and that STAGES is untouched.
  - "dashboard/index.html counts slot holders with ACTIVE_STAGES": checks that the page contains `ACTIVE_STAGES.includes(`.

## Notes
- The existing mutation tests for STAGES (`'"queued", "spec",'` and `'"rework", '`) still target STAGES, because `String.replace` hits the first occurrence and STAGES is declared before ACTIVE_STAGES.
- The existing "full 10-stage list" STAGES test still passes now that the page declares both constants.
- I did not start a dashboard server. I checked behavior by running the page script against a stub `document` in a one-off node process. Nothing from that check was committed.
- No pre-existing failures.
