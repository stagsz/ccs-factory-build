# Code reviewer review: Friendly preflight error outside a git repo

- Job: j-20261016-003
- Round: 1

## Summary
The diff matches the spec's detection method exactly. `git status` is unchanged, and the probe runs only after exit 128. The new error is thrown only when the probe also exits 128 and reports "not a git repository" under the C locale. All other failures are rethrown unchanged. I ran `npm test` in the worktree: 124/124 pass. Only the two permitted files changed.

## Findings
- **note** `scripts/board.mjs:263-278`: The detection depends on the English message from the probe. The spec chose this and `LC_ALL=C` makes it reliable. If git is built without the C locale, the failure mode is the old raw error, which is safe. No change needed.
- **note** `tests/cli.test.mjs:659-683`: Case B shares one ceiling (`path.dirname(dir)`) for both dirs. That is valid because both come from the same realpathed `os.tmpdir()`. If either dir were in a different parent, the ceiling would not cover it. Optional hardening: join both parents with `path.delimiter`.

## Checked
- Acceptance criteria:
  - Case A (cwd, no FACTORY_ROOT): met. The test deletes FACTORY_ROOT and asserts the exact stderr.
  - Case B (FACTORY_ROOT set, different cwd): met.
  - No `fatal` / `Command failed` in stderr: met, asserted.
  - The git check runs before `B.loadBoard`: met. The try/catch sits where the old call was, and the test dirs have no `factory/`.
  - Other git failures unchanged: met. Inside `.git`, the probe succeeds, so the original error is rethrown. The second test asserts `^error: Command failed`.
  - The probe runs only on status 128: met.
  - Scope: only `scripts/board.mjs` and `tests/cli.test.mjs`. `scripts/lib/board.mjs` is untouched, and the CLI stays IO-only.
  - `npm test`: passes (124/124).
- Correctness:
  - ENOENT has no status 128, so it passes through.
  - `probe.stderr` is read with `?? ""`, which is safe.
  - The `env` override applies only to the probe.
  - The helper uses the module-level `root`, so it matches the status call.
- Test isolation:
  - `gitEnv()` strips GIT_DIR and related variables.
  - `GIT_CEILING_DIRECTORIES` is set to the temp parent, and the probe inherits it via `process.env`.
  - Dirs are realpathed and cleaned in `finally`.
- Fails without the fix: the first test asserts the exact new message. Without the fix, stderr would be "Command failed ... fatal", so it would fail. I did not re-run the revert, and relied on the builder's reported sanity check plus the diff logic.
- No dead code, debug output or commented-out code. The comment above `notAGitRepo` is accurate.
- Only tested on Windows. Linux/macOS were not run.

VERDICT: pass
