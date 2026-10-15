# Spec: Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Branch: factory/j-20261015-009-test-the-dashboard-server-s-job-file-con

## Goal
Move the dashboard server's `/jobs/<id>/<file>.md` path check into a pure, tested function, so job files can only be served from inside factory/jobs and a malformed URL gets a 404 instead of crashing the server.

## Context
- `scripts/serve.mjs` lines 27-31: for paths starting with `/jobs/`, it builds `jobsDir = path.join(root, "factory", "jobs")`, resolves `path.resolve(jobsDir, "." + decodeURIComponent(url.pathname.slice(5)))`, and serves the file only if it `startsWith(jobsDir + path.sep)` and `endsWith(".md")`. No tests cover this.
- Crash bug (confirmed by reading the code): `decodeURIComponent` is not wrapped in try/catch. `/jobs/%ZZ` throws `URIError` synchronously inside the `http.createServer` request listener. Nothing catches it: no try/catch in the handler and no `process.on("uncaughtException")`. The error reaches the top level and Node exits the process.
- `new URL(...)` in serve.mjs already collapses literal `..` and `%2e%2e` segments before the check runs, so in production the function is a second line of defense. Tests must call the function with raw pathname strings so the function itself is what gets tested.
- Where the function goes: a new `scripts/lib/serve.mjs`. `scripts/lib/board.mjs` is the board's state machine and verdict logic, and HTTP path resolution doesn't belong there. Nothing else has to change for a new file: `scripts/setup.mjs` only copies `claude-setup/` into `.claude/`, `tests/setup.test.mjs` only imports `install`, and neither one lists `scripts/lib/`.

## Acceptance criteria
- [ ] `scripts/lib/serve.mjs` exports `resolveJobFile(root, pathname)`. It is pure: no fs or IO, imports only `node:path`. It returns an absolute file path string or `null`.
- [ ] `root` is the repo root, and the function computes `path.join(root, "factory", "jobs")` itself.
- [ ] It returns `null` when `pathname` does not start with `/jobs/`.
- [ ] It returns `null`, and does not throw, when `decodeURIComponent` throws (for example `/jobs/%ZZ` or `/jobs/abc/%E0%A4%A.md`).
- [ ] It returns `null` unless the resolved path starts with `jobsDir + path.sep` and ends with `.md`. These are the same rules as today: case-sensitive `.md`, and no change to how valid paths resolve.
- [ ] `scripts/serve.mjs` imports `resolveJobFile` and uses it in place of the inline block at lines 27-31. The `routes` lookup still runs first. The 404 and 200 handling is unchanged.
- [ ] Requesting `/jobs/%ZZ` against the running server returns 404, and the process stays up.
- [ ] `npm test` passes on Windows and Linux.

## Out of scope
- `claude-setup/`, `.claude/`, `dashboard/`, and everything under `factory/`.
- `scripts/lib/board.mjs`, `scripts/board.mjs`, `scripts/setup.mjs`.
- Any other change to serve.mjs: routes, content types, headers, port, adding a global error handler.
- Symlink checks (realpath), null-byte handling, case-insensitive extension matching.

## Tests
New file `tests/serve.test.mjs` (node:test + node:assert). Use a fixed `root` such as `path.resolve("repo-root")` and build every expected path with `path.join(root, "factory", "jobs", ...)`. No hard-coded separators.
- Normal: `/jobs/j-1/spec.md` returns `path.join(jobsDir, "j-1", "spec.md")`.
- Encoded but valid: `/jobs/j-1/my%20notes.md` returns `path.join(jobsDir, "j-1", "my notes.md")`.
- `..` traversal: `/jobs/../board.json`, `/jobs/../../package.json`, `/jobs/j-1/../../../x.md` all return `null`.
- Sibling-prefix escape: `/jobs/../jobs-evil/x.md` returns `null`.
- Percent-encoded traversal: `/jobs/%2e%2e/%2e%2e/x.md`, `/jobs/..%2f..%2fx.md`, `/jobs/%2e%2e%2f%2e%2e%2fx.md` all return `null`.
- Backslash-encoded traversal: `/jobs/..%5c..%5cx.md` returns `null` on every platform. On Windows, `\` is a path separator, so this would escape factory/jobs if the containment check were wrong.
- Non-.md file: `/jobs/j-1/notes.txt` and `/jobs/j-1/spec.md.bak` return `null`.
- The jobs directory itself: `/jobs/` and `/jobs/.` return `null`.
- Wrong prefix: `/jobs`, `/board.json`, `/jobsx/a.md` return `null`.
- Malformed encoding: `/jobs/%ZZ` and `/jobs/j-1/%E0%A4%A.md` return `null`, wrapped in `assert.doesNotThrow`.

## Risks
- Security boundary: this function is the only thing stopping a request from reading arbitrary local files through the dashboard. The server binds to 127.0.0.1 only, which limits exposure. Reviewers should confirm the containment check still uses `jobsDir + path.sep`, not `jobsDir` alone.
- No public API, config, or data changes.

## Assumptions
- I read "the root" in the request as the repo root, matching the `root` that serve.mjs already has, not the jobs directory.
- The function name `resolveJobFile` and the new file `scripts/lib/serve.mjs` are my choices. The request allowed either location.
- The crash fix comes from the function returning `null` on a decode error, which serve.mjs already turns into a 404. No other error handling is added.
