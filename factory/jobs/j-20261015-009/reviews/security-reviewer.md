# Security reviewer review: Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Round: 1

## Summary
I reviewed `scripts/lib/serve.mjs`, the call site in `scripts/serve.mjs` and `tests/serve.test.mjs`. I probed the function directly with about 50 hostile pathnames and ran the server on port 4391 to send 18 raw requests. Containment still uses `jobsDir + path.sep`. Decoding happens exactly once, and the result is checked after `path.resolve`, so nothing I tried escaped factory/jobs. The malformed-encoding crash is fixed: the server returned 404 and stayed up. The extra rule in build.md that turns `\` into a separator only adds separators before the resolve and containment check, so it cannot create an escape. It makes Linux behave like Windows, which is the stricter choice. I found no security issues in the code. One process note about an unexpected commit on the branch is below.

## Findings
- **note** branch commit `ec3bd2f`: the branch has a second commit after the builder's `7f1283e`, titled "test: implement job-file confinement for the dashboard server". It contains only `factory/board.json`, `factory/backlog.md` and `factory/jobs/j-20261015-009/{request,spec,build}.md`, and none of the code. It was made at 21:41:59, about 35 s after the job entered `review`, and build.md does not mention it. Its contents are harmless (no secrets, and it matches the working tree), so this is not a security finding. But the spec puts `factory/` out of scope, agents must not commit factory files, and committing board.json on the job branch can conflict with the "factory: record" commit on main. So `git diff main...<branch>` is wider than the changed-files list the orchestrator gave. Fix: the orchestrator or a human should find out what made this commit (probably a hook or auto-commit tool) and drop it from the branch before merge (for example by resetting the branch to `7f1283e`), leaving factory records to the main-branch record step.
- **note** `scripts/serve.mjs:30-38` (existing, out of scope): `existsSync` followed by `createReadStream(file).pipe(res)` has no `'error'` listener. A directory whose name ends in `.md` inside factory/jobs, or a file removed or locked between the check and the open, would raise an unhandled stream error and stop the process. A remote client cannot create such paths, and the spec rules out error-handling changes. Possible follow-up job: add `.on("error", ...)` to send a 404 or 500.
- **note** `scripts/lib/serve.mjs:21` (out of scope by spec): there is no realpath check, so a symlink or junction placed inside factory/jobs would be followed. Only agents and the orchestrator write there, so the risk is low. Recorded so a later job can pick it up if needed.

## Checked
- Containment check: `candidate.startsWith(jobsDir + path.sep) && candidate.endsWith(".md")` is unchanged. The sibling-prefix cases `/jobs/../jobs-evil/x.md` and `/jobs/..%5cjobs-evil%5cx.md` return null.
- Raw `..` traversal, both directly and over HTTP with `curl --path-as-is`. `new URL` collapses it to a non-`/jobs/` path, and the server returns 404.
- Percent-encoded traversal (`%2e%2e`, `..%2f`, `%2e%2e%2f`, `.%2e`): null, and 404 over HTTP.
- Double-encoded (`%252e%252e%252f`): decoded once to a literal directory name `%2e%2e%2f` inside jobs, which does not exist, so 404. Neither the server nor the function decodes a second time.
- Backslash traversal (raw `\` and `%5c`, alone and mixed with `%2f`, nested under `j-1/`): null on Windows. The POSIX reasoning holds because `\` is turned into `/` before `path.resolve` and the check runs on the final path. The `\` to `/` change can only add separators, so it cannot widen access.
- Overlong UTF-8 (`%C0%AE`): `decodeURIComponent` throws, so null. Fullwidth dots (`%EF%BC%8E`): a literal name inside jobs, which does not exist.
- Windows quirks, checked against a scratch tree that had decoy `x.md` files in its root and in its `factory/` folder: `...`, `.. ` (trailing space), `....`, `C:\` mid-path, `\\?\`, UNC `\\server\share`, `::$DATA`, `CON.md`/`AUX.md`/`NUL.md`/`COM1.md`. All of them either resolve inside jobs and do not exist, or return null. No decoy file was ever reached.
- Null byte (`x%00.md`): the function returns a path inside jobs, `fs.existsSync` returns false, so 404 with no crash. `spec.md%00.txt` returns null.
- Case: a case-sensitive prefix on Windows can only reject more, never accept more. Mixed-case file names inside jobs (`SPEC.md`, `J-1`) are served, which is the same as before and stays inside jobs.
- Malformed encoding: `/jobs/%ZZ` and `/jobs/j-1/%E0%A4%A.md` return 404 over HTTP, the process kept serving `/board.json` with 200 afterwards, and stderr was empty. The server on port 4391 was stopped and the port confirmed free.
- Directory requests (`/jobs/<id>`, `/jobs/<id>/reviews`): 404 because they do not end in `.md`.
- Routes lookup still runs first, and the 404/200 handling and headers are unchanged. Returning `null` instead of `undefined` does not change the `!file` check.
- Purity: `scripts/lib/serve.mjs` imports only `node:path` and does no IO. It has no eval, no dynamic import and no deserialization.
- No secrets, tokens or credentials in the diff. No logging of request data. Error responses are a fixed "Not found" with no internal detail.
- No new dependencies. `package.json` is unchanged.
- `npm test`: 65/65 pass on Windows.

VERDICT: pass
