# UX reviewer review: Add a history command to the board CLI

- Job: j-20261015-008
- Round: 1

## Summary
I ran `history` against this job, with no id, and with an unknown id. Output is readable and matches the spec. The USAGE line and both error messages are clear and consistent with the other commands.

## Findings
- **note** `scripts/lib/board.mjs:333`: Timestamps are printed as full ISO strings (24 characters), which makes the AT column wide. This is what the spec asks for and keeps the output exact and greppable. Fix: none needed.

## Checked
- `node scripts/board.mjs history j-20261015-008`: id and title on line 1, branch on line 2, blank line, then an aligned `AT  STAGE  NOTE` header and rows. Rows are oldest first. Empty notes leave no trailing whitespace.
- `history` with no id: stderr is `error: history needs a job id. Usage: node scripts/board.mjs history <id>`, exit 1. The message says what is missing and gives the fix.
- `history nope`: stderr is `error: No job with id nope.`, exit 1. This is the same wording as `show`.
- USAGE line `history <id>` sits after `list`, and its description is aligned with the other descriptions.
- Empty and missing history print `No history.`, which is a clear empty state.
- The command is read-only and has no interactive flow, so there is no accessibility surface beyond plain text output.

VERDICT: pass
