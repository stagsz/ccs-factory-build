# Security reviewer review: Close backlog items when a job ends

- Job: j-20261015-007
- Round: 1

## Summary
I checked the new pure `closeBacklogItem` and the new write to `factory/backlog.md` in the `stage` command. No regex is built from the job id: the id is only compared with `String.prototype.endsWith`, so escaping cannot go wrong and a crafted id cannot inject a pattern. The write path is fixed, the file is written only when the content changed, and only the leading checkbox of a matching `[~]` line can change. I found no security issues.

## Findings
- **note** `scripts/lib/board.mjs:280-293`: the job id is matched as a literal suffix (`trimEnd().endsWith("(" + jobId + ")")`), and the only regex, `/^(\s*[-*]\s+)\[~\]/`, is a constant. This rules out regex injection and ReDoS from ids. The rebuilt line is `m[1] + "[" + mark + "]" + rest`, and `mark` is restricted to `"x"` or `"!"` by an explicit check that throws, so nothing caller-controlled other than the one checkbox character goes into the file. No fix needed.
- **note** `scripts/board.mjs:92-96`: the write target is `P.backlog`, which comes from `B.paths(root)` and is not built from user input, so path traversal through the id or stage is not possible. The block is gated on `TERMINAL`, on `job.source === "backlog"` (read from board.json, not from argv) and on `fs.existsSync`, so a missing file is never created. If several `[~]` lines end with the same `(<id>)`, all of them close (build.md notes this). Ids are unique, so this has no security impact. No fix needed.
- **note** `scripts/board.mjs:181`: if the backlog write fails, the existing catch prints only `err.message` to stderr. This is the same behaviour as other CLI errors and leaks no new internals. No fix needed.

## Checked
- Secrets, tokens, keys: none added in code, tests or README.
- Injection: no regex built from input; no shell, eval, dynamic import or template evaluation; file path is a constant.
- Scope of the file change: only `^\s*[-*]\s+\[~\]` lines whose trimmed end is exactly `(<jobId>)`; queued `[ ]` lines and closed `[x]`/`[!]` lines cannot change. Prefix collisions (`j-1`/`j-11`, `(xj-1)`) are covered by tests. CRLF/LF and trailing newline are kept. If nothing matches, the input string is returned unchanged, so the file is not rewritten.
- Authorization: no change to who can trigger a stage change. The new side effect only happens on terminal stages for backlog-source jobs, as the spec asks. `nextBacklogItem` regex is unchanged.
- Input validation: `mark` is validated. The job id comes from the board after `setStage` (unknown ids already throw there).
- Dependencies: none added (`package.json` unchanged).
- Logging: stdout is unchanged (`<id> -> <stage>`). No personal data or credentials are logged.
- Diff scope: README.md, scripts/board.mjs, scripts/lib/board.mjs, tests only. Nothing under `factory/` in the diff.

VERDICT: pass
