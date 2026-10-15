# UX reviewer review: Close backlog items when a job ends

- Job: j-20261015-007
- Round: 1

## Summary
I checked the marker convention in the README and code comments, the `stage` CLI output, and its error behaviour against spec.md and build.md. The marker set is clear and consistent: `[ ]` queued, `[~]` taken, `[x]` merged, `[!]` failed. The CLI output stays exactly as before, as the spec requires. I found only minor notes and no problems that block the change.

## Findings
- **note** `README.md:77`: The `/factory next` table cell now holds the command description, the whole legend and the automatic-close behaviour in one sentence run. It is readable but dense. Fix (optional): move the legend to a short "Backlog markers" list under the Commands table, and keep the table row short.
- **note** `scripts/board.mjs:92-96`: If the backlog write fails after `saveBoard`, the board is already updated but the user sees only an error and no `<id> -> <stage>` line. The error text says nothing about the board having changed. This follows the spec's accepted risk. Fix (optional): catch the backlog write separately and print "board updated, backlog.md not updated: <reason>" to stderr.
- **note** `scripts/board.mjs:92-96`: When the job is backlog-sourced and no `[~]` line matches (for example a hand-edited line), the close is silent. The spec requires this, and stdout must stay unchanged. A one-line stderr warning would help, but it is not needed.
- **note** `README.md`: The README says the board CLI closes the line, but the older `[~]` lines for j-20261015-003 to 006 stay open because retro-closing is out of scope. A human reading backlog.md will see stale `[~]` markers until someone closes them by hand. The orchestrator should handle that, and also the format note in backlog.md.

## Checked
- Marker legend wording in the README table and the comment above `nextBacklogItem`. Both use the same four markers with the same meaning.
- `stage` stdout: the line is unchanged and is printed after the backlog close. A missing backlog.md produces no error and no new file.
- Error behaviour: the mark validation message names the bad value via `JSON.stringify`. The terminal-stage guard prevents unexpected writes for cli-source jobs.
- Scope: no edits under `factory/`, the README change is limited to one row, and the legend is not duplicated elsewhere.

VERDICT: pass
