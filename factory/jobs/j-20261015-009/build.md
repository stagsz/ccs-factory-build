# Build report: Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Branch: factory/j-20261015-009-test-the-dashboard-server-s-job-file-con
- Last commit: 7f1283e

## Files changed
- `scripts/lib/serve.mjs` (new): exports pure `resolveJobFile(root, pathname)`. Imports only `node:path`. It wraps `decodeURIComponent` in try/catch and keeps the existing `jobsDir + path.sep` / `.md` containment rules.
- `scripts/serve.mjs`: imports `resolveJobFile` and replaces the inline block (old lines 27-31) with `if (!file) file = resolveJobFile(root, url.pathname);`. The `routes` lookup still runs first. The 404/200 handling is unchanged.
- `tests/serve.test.mjs` (new): 11 node:test cases covering everything listed under the spec's Tests section, plus one case that documents the backslash behaviour (see Notes).

## Acceptance criteria
- [x] `scripts/lib/serve.mjs` exports `resolveJobFile(root, pathname)`, pure, imports only `node:path`, returns an absolute path or `null`. No fs or IO.
- [x] `root` is the repo root. The function computes `path.join(root, "factory", "jobs")` itself.
- [x] Returns `null` when `pathname` does not start with `/jobs/`. Tested with `/jobs`, `/board.json` and `/jobsx/a.md`.
- [x] Returns `null` and does not throw when decoding fails. `decodeURIComponent` is in a try/catch. `/jobs/%ZZ` and `/jobs/j-1/%E0%A4%A.md` are tested inside `assert.doesNotThrow`.
- [x] Returns `null` unless the resolved path starts with `jobsDir + path.sep` and ends with `.md`. The check is unchanged and case-sensitive. Valid paths resolve as before, with one deviation for backslashes on POSIX (see Notes).
- [x] `scripts/serve.mjs` uses `resolveJobFile` in place of the inline block. The routes lookup still runs first, and the 404/200 code is untouched.
- [x] `/jobs/%ZZ` against the running server returns 404 and the process stays up. Checked by starting `scripts/serve.mjs` with `PORT=4399` and fetching. Results: `/jobs/%ZZ` returned 404, `/jobs/j-1/%E0%A4%A.md` 404, `/jobs/j-20261015-009/spec.md` 200, `/board.json` 200, `/jobs/..%5c..%5cpackage.json` 404. After the requests the process was still alive with empty stderr. It was then killed (SIGTERM), and port 4399 was confirmed free.
- [x] `npm test` passes. On Windows it was run directly. For Linux, the tests use only `path.join`/`path.resolve` with no hard-coded separators, and the backslash case was checked with a `path.posix` simulation (see Notes).

## Tests
- Command: `npm test`
- Result: passed, 65/65 (0 fail, 0 skipped)
- Added or changed: `tests/serve.test.mjs`

## Notes
- Deviation (backslashes): with today's exact rules, the spec's test "`/jobs/..%5c..%5cx.md` returns `null` on every platform" fails on Linux. On POSIX, `\` is an ordinary filename character, so `path.resolve(jobsDir, "./..\\..\\x.md")` gives `<jobsDir>/..\..\x.md`, which passes the containment check. I confirmed this with `path.posix`: old result `/r/factory/jobs/..\..\x.md` (accepted), new result `/r/x.md` (rejected). To meet the criterion, the function converts `\` to `/` before resolving. On Windows this changes nothing, because `\` is already a separator. On Linux, a URL with an encoded backslash now resolves the same way it does on Windows. A legitimate file whose name contains a literal backslash could no longer be served on Linux. Job ids and job file names never contain one, and the dashboard builds links with `encodeURIComponent(j.id)` plus fixed file names. The extra test `/jobs/j-1%5cspec.md -> jobs/j-1/spec.md` pins this behaviour. The alternative was to reject any decoded path containing `\`, which is stricter but would change resolution on Windows. Reviewers can ask for that instead.
- When nothing matches, `file` is now `null` rather than `undefined`. Both are falsy, so the `!file` 404 check is unaffected.
- The containment check still uses `jobsDir + path.sep`, not `jobsDir` alone. `/jobs/../jobs-evil/x.md` is tested.
- No pre-existing failures.
