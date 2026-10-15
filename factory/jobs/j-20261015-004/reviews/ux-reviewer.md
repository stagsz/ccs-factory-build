# UX reviewer review: Pin line endings for factory files

- Job: j-20261015-004
- Round: 1

## Summary
No UI surface. The user is a developer on Windows with `core.autocrlf=true`. I checked that the one-file `.gitattributes` delivers the spec's claim: no "LF will be replaced by CRLF" warnings when staging `.md`, `.json`, `.mjs` and `.html` files, and no stored content change. The change is minimal and matches the spec exactly.

## Findings
- **note** `.gitattributes:1`: The comment line is accurate and helps contributors who open the file. No change needed.
- **note** `.gitattributes`: Existing `w/crlf` working-tree files (4 of them) stay CRLF until re-checked out. Staging them should not warn once the attributes apply, but they will look different in editors until then. The spec puts this out of scope. Fix: none needed. A one-line mention in the final summary would help the developer.

## Checked
- Diff against main changes exactly one file, `.gitattributes`, with 6 added lines. The rules match the spec's list and order, plus one comment.
- The file has no CR bytes, so it is LF.
- `git check-attr text eol` reports `text: set` and `eol: lf` for README.md, package.json, scripts/board.mjs, dashboard/index.html and the nonexistent factory/jobs/x/spec.md. `.gitignore` reports `text: auto` and `eol: unspecified`, as specified.
- Developer flow: staging a factory job file on Windows no longer triggers the CRLF conversion warning. Checkout gives LF for the four pinned types, which the existing parsers handle.
- No other product surface, copy or accessibility is affected.

VERDICT: pass
