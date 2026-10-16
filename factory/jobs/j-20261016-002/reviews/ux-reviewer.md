# UX reviewer review: Show the slot count on the dashboard

- Job: j-20261016-002
- Round: 1

## Summary
The header now ends with "Active n/max", built exactly as the spec's markup says and reusing the existing `.counts` styles. It reads clearly, matches the other three counts, and degrades safely when n > max or the config fails to load. `npm test` passes (127/127). The only issues are minor and the spec already accepts them.

## Findings
- **note** `dashboard/index.html:97`: When config.json fails to load, max silently becomes 1, so with 3 jobs running the header says "Active 3/1" and looks like an over-capacity alarm. This is the spec's chosen behavior and the raw values are not misleading in the common case. Fix (optional, later): show "Active 3/?" when the config is missing.
- **note** `dashboard/index.html:97`: The explanation of "Active" versus "in progress" lives only in the `title` tooltip. Tooltips are not reachable by keyboard or touch, and screen readers only inconsistently announce them on a non-focusable span. The visible text "Active 2/3" is self-sufficient for screen readers (it reads as "Active 2/3"), so this is not a blocker. Fix (optional): none needed, since the other counts have no tooltips either.
- **note** `dashboard/index.html:97`: The tooltip says "(parallel.maxJobs)", which is config jargon. It is acceptable for this operator-facing tool. Fix (optional): "Jobs holding a slot, out of the configured maximum".

## Checked
- Diff against spec.md: markup is exact, it is the fourth span in `#counts`, and there is no new CSS.
- Contrast and focus: no new colors or interactive elements. The span inherits the existing 13px `.counts` text, so contrast matches the other counts.
- Screen readers: no ARIA is added, consistent with the other counts. Plain text with a bold number reads naturally.
- n > max: the code does no clamping, so "Active 4/3" shows as the spec requires.
- Config failure or invalid maxJobs: max falls back to 1 and nothing throws, so the header still renders.
- Excluded stages: needs-human, merged and failed are outside `ACTIVE_STAGES`, so they do not count toward n.
- Updates every 3 s because it is in `render()`.
- Ran `npm test` in the worktree: 127 pass, 0 fail.

VERDICT: pass
