# Test the dashboard server's job-file confinement

- Job: j-20261015-009
- Branch: factory/j-20261015-009-test-the-dashboard-server-s-job-file-con
- Source: backlog
- Created: 2026-10-15T19:36:10.029Z

## Request

scripts/serve.mjs serves `/jobs/<id>/<file>.md` and confines it to factory/jobs with an inline `path.resolve` + `startsWith` check that has no tests. Move that resolution into a pure, exported function (in scripts/lib/board.mjs or a new scripts/lib/serve.mjs) that takes the root and the URL pathname and returns the file path or null, and use it from serve.mjs. Add tests covering a normal job file, `..` traversal, percent-encoded traversal (`%2e%2e`, `%2f`), a non-.md file, a path to factory/jobs itself, and a malformed percent-encoding (which must return null, not throw). Behaviour for valid paths must not change.
