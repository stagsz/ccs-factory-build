# Close backlog items when a job ends

- Job: j-20261015-007
- Branch: factory/j-20261015-007-close-backlog-items-when-a-job-ends
- Source: backlog
- Created: 2026-10-15T19:19:41.765Z

## Request

Backlog items stay `[~]` forever, even after their job merges. When `node scripts/board.mjs stage <id> merged` runs for a job whose source is "backlog", change that job's backlog line (the one ending in `(<id>)`) from `[~]` to `[x]`; on `stage <id> failed`, change it to `[!]`. Put the line rewrite in scripts/lib/board.mjs as a pure function (e.g. `closeBacklogItem(markdown, jobId, mark)`) that preserves CRLF/LF like `markBacklogItem`, and leaves the markdown unchanged when no line matches. `nextBacklogItem` must still pick only `[ ]` lines. Unit tests in tests/board.test.mjs, a CLI test in tests/cli.test.mjs, and update the format note at the top of backlog.md.
