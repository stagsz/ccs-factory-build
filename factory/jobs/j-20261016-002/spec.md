# Spec: Show the slot count on the dashboard

- Job: j-20261016-002
- Branch: factory/j-20261016-002-show-the-slot-count-on-the-dashboard

## Goal
The dashboard header shows how many parallel job slots are in use, as "Active n/max". n is the number of jobs holding a slot and max is `config.parallel.maxJobs`. A drift guard test keeps the dashboard's list of active stages in sync with `ACTIVE_STAGES` in `scripts/lib/board.mjs`.

## Context
- `dashboard/index.html`:
  - The header (lines 58-62) holds `<h1>`, `<div class="counts" id="counts">` and `<div class="meta" id="meta">`.
  - `render()` (lines 76-95) fills `#counts` with three `<span><b>N</b> label</span>` items: in progress, need you, merged.
  - `load()` fetches `/board.json` and `/config.json`. If the config fetch fails, `config` stays at its default `{ reviewers: [] }`.
  - The page declares `const STAGES = [...]` at line 68.
- `scripts/lib/board.mjs`:
  - Line 324: `export const ACTIVE_STAGES = ["queued", "spec", "spec-approval", "build", "review", "rework", "approve"];`
  - `maxJobs(config)` (lines 339-344) returns 1 when `config.parallel.maxJobs` is `undefined` or `null`, returns the value when `Number.isInteger(v) && v >= 1`, and throws otherwise.
  - `capacity()` counts jobs with `ACTIVE_STAGES.includes(j.stage)`.
- `tests/dashboard.test.mjs`:
  - `extractStages(html)` pulls the `const STAGES = [...];` literal out of the HTML with regexes. It rejects a missing declaration, a duplicate declaration and anything other than plain string literals.
  - The first test asserts that the extracted list `deepStrictEqual`s `STAGES`. Further tests cover the extractor itself.
- `factory/config.json` currently has `parallel.maxJobs: 3`.

## Acceptance criteria
- [ ] `dashboard/index.html` declares exactly one `const ACTIVE_STAGES = ["queued", "spec", "spec-approval", "build", "review", "rework", "approve"];` as a plain array literal, next to `const STAGES`.
- [ ] `render()` computes n as `board.jobs.filter((j) => ACTIVE_STAGES.includes(j.stage)).length`. There is no second inline stage list for this count.
- [ ] `render()` computes max with the same rule as `maxJobs()`, except that it never throws:
  - Let `v = config?.parallel?.maxJobs`.
  - max = `v` when `Number.isInteger(v) && v >= 1`.
  - max = `1` in every other case: unset, null, not an integer, below 1, `parallel` missing, or config.json failing to load.
- [ ] The indicator is a fourth `<span>` appended after "merged" inside the existing `#counts` element. Its exact markup is `<span title="Jobs holding a slot (parallel.maxJobs)">Active <b>${n}/${max}</b></span>`, which renders as, for example, "Active 2/3". It uses the existing `.counts` / `.counts b` styles. No new CSS rules, classes, elements outside `#counts`, or dependencies.
- [ ] The indicator updates on every 3 s refresh, along with the other counts.
- [ ] Jobs in `needs-human`, `merged` and `failed` do not count toward n.
- [ ] If n is greater than max (for example, after the config was lowered), the indicator shows the raw values (such as "Active 4/3") without clamping or erroring.
- [ ] The existing STAGES drift guard and the extractor tests still pass unchanged in behavior. `npm test` passes.

## Out of scope
- Any file other than `dashboard/index.html` and `tests/dashboard.test.mjs`. In particular:
  - `scripts/lib/board.mjs`, `scripts/board.mjs`, `scripts/serve.mjs` and `factory/config.json`.
  - `tests/cli.test.mjs`, which is changed by j-20261016-003.
  - `claude-setup/skills/factory/SKILL.md`, which is changed by j-20261016-001.
- Changing the existing "in progress / need you / merged" counts, the column layout or the card rendering.
- Showing a config validation error on the dashboard for an invalid `maxJobs`.

## Tests
In `tests/dashboard.test.mjs`:
- Generalize `extractStages` into `extractArray(html, name)`:
  - The declaration regex is `\bconst\s+${name}\s*=`. Use the same shape checks as today.
  - Error messages name the constant: `` `${name} in dashboard/index.html: ...` ``.
  - Keep `extractStages = (html) => extractArray(html, "STAGES")` so that the existing tests keep working without edits.
  - Check that the `STAGES` regex does not match `const ACTIVE_STAGES` because of the word boundary.
- Import `ACTIVE_STAGES` from `../scripts/lib/board.mjs`. Then add these tests:
  - "dashboard/index.html ACTIVE_STAGES matches ACTIVE_STAGES exported from scripts/lib/board.mjs": `deepStrictEqual`, with a message that shows both lists, mirroring the STAGES test.
  - Mutation test: remove `"approve"` from the dashboard's ACTIVE_STAGES text. Assert that the replace changed the text, and that the extracted list no longer equals `ACTIVE_STAGES`.
  - The page uses the constant: the HTML contains `ACTIVE_STAGES.includes(`.
  - `extractArray(html, "STAGES")` still returns the full 10-stage list once the page declares both constants. The existing STAGES test already proves this; it must still pass.

## Risks
- Config: the dashboard reads `parallel.maxJobs` read-only. Nothing writes config. Low risk.
- Parallel jobs: none of the three jobs touch the same files, so no overlap is expected.

## Assumptions
- "1 when unset" also covers invalid values and a failed config fetch. The dashboard is a viewer and must not throw, so it falls back to 1 instead of mirroring `maxJobs()`'s throw. `preflight` already reports invalid config elsewhere.
- Placement: the request does not say where in the header the indicator goes, so it is the last item in `#counts`. This reuses the header's existing count style without adding new markup to the header.
- The tooltip text is a small addition that explains the difference from "in progress", which also counts needs-human. It adds no styling.
