# UX reviewer review: Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Round: 1

## Summary
The change is a small refactor of the dashboard server's job-file path check, and it fixes a crash. Dashboard users still get valid job-file links, and malformed URLs such as `/jobs/%ZZ` now return a plain 404 instead of killing the server. I read the diff and the build report. I did not run the server myself. I rely on the build report's live check of `/jobs/%ZZ` (404, process still up).

## Findings
- **note** `scripts/lib/serve.mjs:21`: Backslashes are converted to `/` before resolving. On Windows this changes nothing. On Linux, a job file whose name contains a literal backslash would no longer be served. The dashboard builds links from `encodeURIComponent(j.id)` plus fixed file names, so no user-visible link is affected. Fix: none needed. The behaviour is pinned by a test and explained in build.md.
- **note** `scripts/serve.mjs`: A bad request gets a bare `text/plain` 404. This is unchanged from before and the spec puts it out of scope, so it is not a problem here.

## Checked
- Valid links: `/jobs/<id>/<file>.md` resolves to the same path as before. This covers percent-encoded names such as `my%20notes.md`, and ids encoded with `encodeURIComponent`.
- Failure handling: malformed encoding returns `null`, which `serve.mjs` turns into the existing 404. Traversal, sibling-prefix, non-`.md`, directory and wrong-prefix requests also 404.
- The `routes` lookup still runs first, so the dashboard page and `board.json` are unaffected. The 404 and 200 handling is unchanged.
- The containment check still uses `jobsDir + path.sep` and a case-sensitive `.md` suffix.
- Tests in `tests/serve.test.mjs` cover every case in the spec, using `path.join` and no hard-coded separators.
- No new UI, copy, accessibility or consistency surface. This is a server-side change only.

VERDICT: pass
