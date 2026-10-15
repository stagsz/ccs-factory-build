# Security reviewer review: Guard dashboard stages against drift

- Job: j-20261015-010
- Round: 1

## Summary
I checked the two-file diff (`scripts/lib/board.mjs`, `tests/dashboard.test.mjs`) against spec.md for secrets, code execution, injection, path handling, authorization changes and dependencies. The `board.mjs` change only reorders two entries in `STAGES`. The new test reads a fixed repo file and parses it with regexes. It never runs page code. I found no security issues.

## Findings
None.

## Checked
- Secrets: none added. The fixtures are inline strings with dummy stage names.
- Code execution: `extractStages` has no `eval`, `Function`, `vm`, dynamic `import()` or `require`. It only uses `String.match`/`matchAll` and a `RegExp` built from constant fragments, so no untrusted input reaches the pattern. This meets the spec's acceptance criterion.
- Path handling: `dashboardFile` is built with `path.join` from `import.meta.url` plus constant segments. It takes no user input, has no traversal surface and works on Windows and Linux. The test only reads files and never writes to the real dashboard. The negative cases use in-memory `String.replace` copies.
- ReDoS: the literal and shape regexes are anchored and use quote-delimited literals that cannot overlap. The only backtracking risk is a run of whitespace next to `\s*,?\s*`, which is quadratic at worst. The input is a trusted repo file read inside a test, so this does not matter.
- Authorization and behaviour: `STAGES` order is used only in the `Unknown stage` error text (`scripts/lib/board.mjs:140`). Line 305 checks membership only. `TRANSITIONS`, `TERMINAL`, the risk floor and `alwaysEscalatePaths` are untouched. No permission or escalation path changes. The reorder now matches `dashboard/index.html:68`.
- Error messages: the new errors appear only in tests and show only the extracted array body from a repo file. They expose nothing sensitive.
- Dependencies: none added. The test uses only `node:` built-ins, so the zero-runtime-dependency rule holds.
- Logging of personal data or credentials: none.
- Scope: the diff touches only the two files the spec allows. `dashboard/index.html`, `claude-setup/`, `.claude/` and `factory/` are not in the diff.

VERDICT: pass
