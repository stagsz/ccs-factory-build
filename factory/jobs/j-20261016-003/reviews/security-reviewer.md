# Security reviewer review: Friendly preflight error outside a git repo

- Job: j-20261016-003
- Round: 1

## Summary
I checked that the new error branch in `commands.preflight()` stays fail-closed, that the not-a-repo check cannot hide other git errors, that both child processes avoid a shell, and that the new tests stay inside temp dirs. Every path out of the new `catch` throws, so a failed or dirty `git status` can never become a pass. The probe only changes the message, and only when `git rev-parse` itself reports "not a git repository" with exit 128. I found no security issues.

## Findings
- **note** `scripts/board.mjs:251-254`: Fail-closed holds. The `catch` either throws the new `Error` or rethrows `err`. It has no return and no fall-through to `preflightErrors`, so the top-level catch (l.288-293) always exits 1. If the probe ever misclassified a failure, only the stderr text would change. The exit code and the orchestrator's stop would stay the same. No fix needed.
- **note** `scripts/board.mjs:266-278`: The probe is hard to fool. It needs `probe.status === 128` and an English "not a git repository" stderr, with `LC_ALL=C` and `LANGUAGE=""` set only on the probe. Inside `.git`, the probe succeeds and returns false. With dubious ownership, git says "detected dubious ownership". With git missing (ENOENT), there is no `status` and the outer check `err.status === 128` already fails. All three keep git's original error. An inherited bad `GIT_DIR` would produce "not a git repository" from both calls. That really is a not-a-repo case, so the friendly message is accurate. No fix needed.
- **note** `scripts/board.mjs:244-249, 268-273`: Both calls use `execFileSync("git", [...fixed args])`, with no `shell` option and no user-controlled arguments. `root` is passed only as `cwd`. No injection surface.
- **note** `scripts/board.mjs:252`: The new message includes the absolute `root` path on stderr. That is the user's own local path, the same information git's `fatal:` line showed before. No new disclosure.
- **note** `tests/cli.test.mjs:659-682`: All dirs come from `mkdtempSync(os.tmpdir())`, are realpathed, and are removed in `finally`. `GIT_CEILING_DIRECTORIES` stops git from walking up into a real parent repo. The second test (l.684-694) runs in a `gitRepo()` temp repo's `.git` with `gitEnv()`. Neither test touches the main checkout or the worktree. Minor: if the second `mkdtempSync` throws, `dir` leaks because it is created before the `try`. That is harmless, so I am not asking for a fix.

## Checked
- `git diff main...HEAD`: only `scripts/board.mjs` and `tests/cli.test.mjs` changed (+66/-5), as the spec says. No new dependencies and no secrets, tokens or credentials in code or fixtures.
- Control flow of the new try/catch against the top-level catch and exit code. The success path is unchanged and adds no extra spawn.
- Probe conditions against these git exit-128 cases: inside `.git`, dubious ownership, git not installed (ENOENT), and an inherited `GIT_DIR`.
- No shell, eval or dynamic import. No logging of personal data beyond the local root path.
- Test isolation: temp dirs, ceiling env, cleanup in `finally`.
- `npm test` in the worktree: 124 passed, 0 failed, 0 skipped. Worktree status clean.

VERDICT: pass
