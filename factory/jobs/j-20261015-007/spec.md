# Spec: Close backlog items when a job ends

- Job: j-20261015-007
- Branch: factory/j-20261015-007-close-backlog-items-when-a-job-ends

## Goal
When a backlog-sourced job reaches `merged` or `failed`, its `[~]` line in `factory/backlog.md` is automatically closed as `[x]` (merged) or `[!]` (failed), so the backlog shows what is finished.

## Context
- `scripts/lib/board.mjs` (lines 253-273): `nextBacklogItem` matches only `- [ ]` lines; `markBacklogItem` turns `[ ]` into `[~]`, appends ` (<jobId>)` and keeps CRLF/LF (detects `\r\n`, splits on `/\r?\n/`, rejoins with the same EOL). `createJob` (line 106) stores `job.source` (`"cli"` or `"backlog"`). `TERMINAL` = `merged`, `failed`.
- `scripts/board.mjs` `stage` command (lines 87-93): `setStage` + `saveBoard`, prints `<id> -> <stage>`. `next` (lines 74-85) shows the IO pattern for backlog.md via `P.backlog`.
- Tests: `tests/board.test.mjs` line 162 (backlog unit test), `tests/cli.test.mjs` `setup()` (line 14) creates a temp root with a one-item backlog.md.

## Acceptance criteria
- [ ] `scripts/lib/board.mjs` exports a pure `closeBacklogItem(markdown, jobId, mark)`, where `mark` is `"x"` or `"!"`. Any other mark throws an Error.
- [ ] It rewrites only a line that matches `^\s*[-*]\s+\[~\]` AND whose trimmed end is exactly `(<jobId>)`. Only the leading `[~]` checkbox changes; the rest of the line stays byte-identical. `(j-1)` must not match a job id of `j-11`, and the reverse also holds.
- [ ] When no line matches (no line for the id, or the line is already `[x]`/`[!]`/`[ ]`), it returns the input string unchanged (`===`).
- [ ] CRLF input stays CRLF and LF input stays LF, the same way `markBacklogItem` handles it. A trailing newline is kept.
- [ ] `nextBacklogItem` still picks only `[ ]` lines and skips `[x]`, `[~]` and `[!]`. Its regex does not change.
- [ ] `node scripts/board.mjs stage <id> merged` closes the line with `[x]` and `stage <id> failed` closes it with `[!]`, but only when `job.source === "backlog"`. This runs after the board is saved. The file is written only when its content changed.
- [ ] `stage` to any other stage, and `stage` for a job with `source: "cli"`, leaves backlog.md untouched.
- [ ] If `factory/backlog.md` is missing, `stage ... merged|failed` still succeeds (exit 0, board updated) and creates no backlog file.
- [ ] `stage` stdout is still exactly `<id> -> <stage>`.
- [ ] The `[ ]` / `[~]` / `[x]` / `[!]` markers are documented in the comment above `nextBacklogItem` in `scripts/lib/board.mjs` and in `README.md`, either on the `backlog.md` line of the project map (~line 42) or next to the `/factory next` row (~line 77).
- [ ] `npm test` passes.

## Out of scope
- `factory/backlog.md` itself, including its format note. The file is owned by the orchestrator, and the builder must not edit, stage or commit anything under `factory/`. The orchestrator updates the note separately.
- Closing existing `[~]` lines for jobs that already merged (j-20261015-003 to 006). This job does not retro-close them.
- `claude-setup/`, `.claude/`, SKILL.md, the dashboard, `STAGES`/`TRANSITIONS`, and the `next` command's behaviour.

## Tests
- `tests/board.test.mjs`: unit tests for `closeBacklogItem`:
  - `x` and `!` on LF and on CRLF input
  - the other lines stay unchanged
  - no match returns the same string
  - an id-prefix collision (`j-1` vs `j-11`) changes nothing
  - an already-closed line changes nothing
  - an invalid mark throws
  - `nextBacklogItem` skips a `[!]` line
- `tests/cli.test.mjs`:
  - Extend the full-line test (or add a new one) to assert that backlog.md shows `- [x] Health check ... (<id>)` after `stage <id> merged`.
  - Add a test where a backlog job goes `stage spec` then `stage failed`, and assert `[!]`.
  - Add a test for a `new` (cli-source) job reaching `failed`, and assert backlog.md is byte-identical.
  - Add a test that deletes backlog.md before `stage failed`: the command exits 0 and no file is created.

## Risks
- Low. The CLI gains a write to `factory/backlog.md` on terminal stages. Because it only rewrites `[~]` lines that end in the exact `(<id>)`, it cannot touch queued items. If the write fails after the board is saved, the board is still correct, and the error goes to stderr with exit 1 like other CLI errors.

## Assumptions
- `mark` is the single character `"x"` or `"!"`, not a full `"[x]"` token.
- The close triggers on any transition into `merged`/`failed`, including `needs-human -> merged`.
- `job.source` is the only signal for backlog jobs. Jobs from `new` are never matched, even if a backlog line happens to end with their id.
