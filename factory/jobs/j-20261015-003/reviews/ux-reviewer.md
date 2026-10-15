# UX reviewer review: Add a list command to the board CLI

- Job: j-20261015-003
- Round: 1

## Summary
The user here is a developer or the /factory orchestrator running a CLI. I ran `node scripts/board.mjs list` on the branch and read the diff against spec.md. The output is an aligned table with a header, no trailing whitespace and oldest-first order. The empty-board message, the usage line and the exit codes all match the spec and the rest of the CLI.

## Findings
- **note** `scripts/board.mjs:145`: `list extra` ignores extra arguments and exits 0. `show` and the other commands behave the same way, so this is consistent. The spec puts filters out of scope. Fix: none needed.
- **note** `scripts/lib/board.mjs:300`: Titles are printed as stored, so a title containing a newline would split a row. Titles come from `new "<title>"`, and the spec explicitly says no escaping. Fix: none needed.

## Checked
- Real output: three jobs line up under ID, STAGE, REWORK and TITLE with two-space gaps. The `list` run exits 0.
- Flow: `list` needs no init, config or arguments, so there is no dead end. The empty and missing-board state prints `No jobs.` (covered by a CLI test). There is no loading or error state because the command is read-only.
- Copy: the header labels are plain. The USAGE line sits next to `show`, matches the column alignment, and describes what the command does. `list` appears in the unknown-command hint and in `help`.
- Consistency: `list` follows the `show` pattern (`out(...)` over `loadBoard`). Unknown commands still exit 2 with the usage text.
- Accessibility: plain text output with no color, so contrast and keyboard access do not apply.
- Tests: the `list` entry in `allCommands` and the CLI tests assert the empty-board message and a read-only run.

VERDICT: pass
