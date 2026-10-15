# Build report: Close backlog items when a job ends

- Job: j-20261015-007
- Branch: factory/j-20261015-007-close-backlog-items-when-a-job-ends
- Last commit: 23fe3bf

## Files changed
- `scripts/lib/board.mjs`: new pure export `closeBacklogItem(markdown, jobId, mark)`; marker legend (`[ ]`, `[~]`, `[x]`, `[!]`) added to the comment above `nextBacklogItem`. `nextBacklogItem` regex unchanged.
- `scripts/board.mjs`: `stage` command, after `saveBoard`, closes the backlog line when the job is terminal and `job.source === "backlog"` and `factory/backlog.md` exists; writes only if the content changed. Stdout unchanged.
- `tests/board.test.mjs`: 7 new unit tests for `closeBacklogItem` and `nextBacklogItem` skipping `[!]`.
- `tests/cli.test.mjs`: full-line test now asserts the `[x]` line and exact stdout after `stage merged`; 3 new tests (backlog job -> failed gives `[!]`, cli job -> failed leaves backlog byte-identical, missing backlog.md -> exit 0 and no file created).
- `README.md`: marker legend on the `/factory next` row of the Commands table.

## Acceptance criteria
- [x] Pure `closeBacklogItem(markdown, jobId, mark)` exported; mark other than `"x"`/`"!"` throws: explicit check at the top of the function; tested with `"[x]"`, `"X"`, `"~"`, `" "`, `""`, `undefined`.
- [x] Only `^\s*[-*]\s+\[~\]` lines whose trimmed end is exactly `(<jobId>)` change, and only the checkbox: the regex captures the prefix, the line is rebuilt as prefix + `[mark]` + the untouched rest; `trimEnd().endsWith("(" + jobId + ")")` means `(j-1)` never matches `j-11` and vice versa (tested both ways, plus `(xj-1)`).
- [x] No match returns the input (`===`): a `changed` flag; when false the original string is returned. Tested for unknown id, `[ ]` line, `[x]`/`[!]` lines, empty string.
- [x] CRLF stays CRLF, LF stays LF, trailing newline kept: same EOL detection and split/join as `markBacklogItem`; tests compare full strings for both.
- [x] `nextBacklogItem` picks only `[ ]` lines: regex untouched; new test with `[!]`, `[x]`, `[~]` before a `[ ]` line, and an all-`[!]` file returning null.
- [x] `stage <id> merged` -> `[x]`, `stage <id> failed` -> `[!]`, only for `source: "backlog"`, after the board is saved, write only on change: see `scripts/board.mjs` `stage`; CLI tests cover both marks.
- [x] Other stages and cli-source jobs leave backlog.md untouched: guarded by `B.TERMINAL.has(job.stage) && job.source === "backlog"`; CLI tests assert the `[~]` line after `stage spec` and byte-identity for a cli job (even with a lookalike `[~] ... (<id>)` line).
- [x] Missing backlog.md: `fs.existsSync` guard; CLI test asserts exit 0, stdout, board stage `failed`, and no file created.
- [x] `stage` stdout still exactly `<id> -> <stage>`: asserted in all new CLI tests and the full-line test.
- [x] Markers documented in the `nextBacklogItem` comment and in README (`/factory next` row).
- [x] `npm test` passes.

## Tests
- Command: `npm test`
- Result: passed, 48 tests, 0 failures
- Added or changed: `tests/board.test.mjs`, `tests/cli.test.mjs`

## Notes
- If several `[~]` lines end with the same `(<jobId>)` (should not happen, ids are unique), all of them are closed.
- The `job.stage === "merged" ? "x" : "!"` mapping is inline in the CLI since it sits behind the `TERMINAL` check; no extra library export was added beyond what the spec names.
- If the backlog write throws after the board is saved, the error goes to stderr with exit 1 (the existing CLI catch) and the success line is not printed; the board is still correct.
- Git prints "CRLF will be replaced by LF" warnings for the CRLF working-copy files; this is the repo's existing autocrlf behaviour, not introduced here. Working-copy line endings were preserved.
- Nothing under `factory/` was staged or committed; `factory/backlog.md` was not edited.
