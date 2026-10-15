# Pin line endings for factory files

- Job: j-20261015-004
- Branch: factory/j-20261015-004-pin-line-endings-for-factory-files
- Source: backlog
- Created: 2026-10-15T17:39:23.866Z

## Request

Add a .gitattributes so *.md, *.json, *.mjs and *.html are stored and checked out with LF. Git currently warns "LF will be replaced by CRLF" for every factory/jobs file on Windows. Do not renormalise unrelated files beyond what the attributes require; npm test must still pass.
