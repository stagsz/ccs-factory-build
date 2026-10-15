# Code reviewer review: Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Round: 1

## Summary
I checked the diff against every acceptance criterion and ran `npm test` (65/65 pass). `resolveJobFile` is pure, imports only `node:path`, returns `null` on bad encoding, and keeps the `jobsDir + path.sep` containment check. serve.mjs delegates to it after the `routes` lookup. The one out-of-spec change, treating `\` as a separator on all platforms, is justified.

## Findings
- **note** `scripts/lib/serve.mjs:20`: The `replaceAll("\\", "/")` normalisation is a deviation from "no change to how valid paths resolve". It is needed to satisfy the spec's own test that `/jobs/..%5c..%5cx.md` returns `null` on every platform. Without it, that path stays inside jobsDir on POSIX because `\` is an ordinary filename character. It changes nothing on Windows. On Linux it only affects file names containing a literal backslash, which job files never have. It is documented in the JSDoc and build.md, and the extra test `j-1%5cspec.md` pins it. The change is justified and strictly tightens the boundary. Fix: none.
- **note** `scripts/lib/serve.mjs:12`: The `typeof pathname !== "string"` guard is a small addition beyond the spec. It is harmless. Fix: none.
- **note** `tests/serve.test.mjs:30`: The `%5c` tests assert behaviour that depends on the normalisation above. On Linux they pass only because of it. I did not run Linux, but the logic is platform-neutral (`path.resolve` and `path.join` only, no hard-coded separators). Fix: none.

## Checked
- AC pure function: no fs or IO, only `import path from "node:path"`, no new dependencies.
- AC `root` handling: `jobsDir = path.join(root, "factory", "jobs")` is computed inside the function.
- AC prefix: returns `null` for `/jobs`, `/board.json` and `/jobsx/a.md`. These are covered by tests.
- AC bad encoding: `decodeURIComponent` is in try/catch and returns `null`. The test uses `assert.doesNotThrow`.
- AC containment: still `jobsDir + path.sep` and a case-sensitive `.md` suffix. The sibling-prefix, `/jobs/` and `/jobs/.` cases resolve to jobsDir or outside it and return `null`.
- AC serve.mjs: the `routes` lookup is first, `if (!file) file = resolveJobFile(...)`, and the 404/200 handling is untouched. `null` instead of `undefined` is fine because the check is `!file`.
- AC running server: the builder's manual 404 check for `/jobs/%ZZ` is plausible from the code. The decode error can no longer escape the handler. I did not re-run the server.
- Tests: all spec cases are present and assert exact `path.join` results, so they would fail if the check or the decode handling broke. No skips, debug output or dead code.
- Scope: only the three listed files changed. The `factory/` changes in the working tree are orchestrator bookkeeping, not part of the diff.
- Conventions: ES modules, zero dependencies, pure logic in `scripts/lib/` with tests in `tests/`.

VERDICT: pass
