# Code reviewer review: Export approved jobs to an Obsidian vault

- Job: j-20261015-011
- Round: 1

## Summary
I read spec.md, build.md and the full diff, and ran `npm test` (101 pass, 0 fail). Every acceptance criterion is met. The pure/IO split follows repo convention, and the tests never reach the real vault. The three deviations from the spec are justified. Only minor notes remain.

## Acceptance criteria
| Criterion | Status |
|---|---|
| config.json `export.obsidianDir`; no vault path in any .mjs file | met |
| Off for absent, null or blank `export`/`obsidianDir`; relative paths resolve against root; absolute used as is | met (`exportDir`, plus a relative-path CLI test) |
| `exportFolderName` | met, with the deviations below |
| `chooseExportFolder` | met |
| `parseExportOwner` | met (BOM, CRLF and quotes handled; only reads leading frontmatter) |
| `latestMergedJob` | met (max merged `at`; ignores non-merged jobs) |
| `renderExportIndex` | met (pure, sorts a copy, escapes `\|`, flattens newlines, JSON-quotes title and branch in frontmatter) |
| CLI: no id, unknown id, not merged, config off, missing dir | met, with the exact messages |
| CLI: success layout, printed path, exit 0 | met |
| Re-export overwrites only its own folder and never deletes | met, tested with a user-added file |
| Read-only for the factory | met; the test snapshots board.json and the job folder across two exports |
| node:path/node:fs only; USAGE line | met |
| SKILL.md table row, dispatch sentence, Human commands entry | met |

## Deviations judged
1. **Reserved names put `_` on the stem (`con.txt` becomes `con_.txt`).** Justified. Appending `_` to the end gives `con.txt_`, whose stem is still `con`, so it would remain reserved on Windows. Bare names (`CON` becomes `CON_`) match the spec literally. Documented and tested.
2. **Titles `Spec`, `Request`, `Build`, `Approval` get `_` appended.** Justified. The index note is `<folder>/<folder>.md`, so a job titled "Spec" would overwrite its own copied `spec.md` with the index. This is a real data-loss bug the spec missed. The change is small and tested.
3. **Exit 1 when `base (<id>)` also exists and is not this job's export.** Justified. `chooseExportFolder` would otherwise return that folder and the CLI would write into a foreign folder, which contradicts the ownership rule. The check sits in the CLI, which has the IO context, and is tested.

## Findings
- **note** `scripts/board.mjs:162-168`: The config and vault checks run before the job lookup. With export off, `export j-nope` reports the config error, not "No job with id". The spec does not fix an order, and build.md documents it. No change needed.
- **note** `scripts/board.mjs:177`: `owners.has(folder) && owners.get(folder) !== job.id && folder !== base` is correct, but the `folder !== base` clause is only reachable because `chooseExportFolder` already guarantees `base` is free or owned. A one-line comment would help the next reader. Fix: optional.
- **note** `scripts/board.mjs:174-176`: The `existsSync` ownership probe is case-sensitive on Linux. Two titles that differ only by case would be separate folders there and one folder on Windows. Edge case, not worth handling now.
- **note** `tests/cli.test.mjs`: The `mergeJob` helper creates the job with `run("new", ...)`, so `request.md` comes from the real CLI. This is fine.

No debug output, commented-out code or scope creep. Changes outside the spec (the `setup()` null-vault default, the `allCommands` list) are explained in build.md and necessary.

## Checked
- Collision handling: free, owned by the same id, owned by another id, foreign folder with a null owner, and a foreign suffixed folder.
- Path safety: separators and `..` are stripped, and the prefix check also covers a drive-root vault.
- Test isolation: `setup()` forces `obsidianDir` to null, and every export test calls `setVault` with a fresh `mkdtempSync` dir before running. The real vault directory was empty or untouched after the run.
- "Most recently merged": the test makes list order and merge order disagree, so it would fail if the selection were wrong.
- SKILL.md edits are in `claude-setup/`; `.claude/` is not touched.
- The skill test asserts the required strings, so it would fail if the wording regressed.

VERDICT: pass
