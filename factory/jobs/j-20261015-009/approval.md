# Approval: Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Branch: factory/j-20261015-009-test-the-dashboard-server-s-job-file-con
- Rework cycles: 0

## What changed
The dashboard server's `/jobs/<id>/<file>.md` path check moved out of `scripts/serve.mjs` into a pure, exported `resolveJobFile(root, pathname)` in the new `scripts/lib/serve.mjs`, with 11 tests in `tests/serve.test.mjs`. It also fixes a crash: a malformed URL such as `/jobs/%ZZ` used to throw an uncaught `URIError` and kill the server. It now returns a 404.

## Review outcome
- security-reviewer: pass
- ux-reviewer: pass
- ui-design-reviewer: pass
- code-reviewer: pass

## Why this risk rating
- All four reviewers passed in round 1, with no rework.
- The diff is 3 files (+93/-5) and is only one commit, `7f1283e`. The stray auto-commits that the security review flagged (`ec3bd2f`, `b762348`) are no longer on the branch. I checked this with `git log main..HEAD`.
- No changed file matches `alwaysEscalatePaths`. There are no dependency, CI, config, auth, payments or migration changes, and the change is well under `maxFilesForLowRisk` (15).
- `npm test` passes, 65/65, which I re-ran for this approval. The new tests cover each case the spec listed: normal and encoded-valid paths, `..` traversal, percent-encoded traversal, backslash traversal, sibling-prefix escape, non-`.md` files, the jobs directory itself, wrong prefix, and malformed encoding.
- The containment rule (`jobsDir + path.sep` plus a case-sensitive `.md`) has not changed. The security reviewer sent about 50 hostile pathnames to the function and 18 raw requests to a running server, and none of them escaped factory/jobs.
- There is one documented deviation from the spec: `\` is treated as a path separator on every platform. The spec's own test (`..%5c..%5cx.md` must return null on every platform) requires it. It changes nothing on Windows and only makes Linux stricter. All reviewers accepted it.
- If this merge goes wrong, it will be easy to see, because dashboard job links would 404, and easy to fix: revert one commit with a single call site.

Notes for follow-up, not blocking this merge:
- `scripts/serve.mjs` has no `'error'` listener on the read stream. A directory named `*.md`, or a file removed after the existence check, could still crash the server. This was out of scope.
- There is no realpath/symlink check. This was out of scope.
- An untracked `.github/` directory sits in the working tree. It is not part of this job, and someone should make sure it does not get swept into a commit by mistake.

RISK: low
DECISION: merge
