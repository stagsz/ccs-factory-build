import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "claude-setup");
const read = (...parts) => fs.readFileSync(path.join(source, ...parts), "utf8");

test("SKILL.md records each job on main and rolls back without losing records", () => {
  const skill = read("skills", "factory", "SKILL.md");
  assert.ok(skill.includes("### 7. Record the job"));
  assert.ok(skill.includes("factory: record <id>"));
  assert.ok(skill.includes("git add factory/board.json factory/backlog.md factory/jobs/<id>"));
  assert.ok(skill.includes("reset --keep ORIG_HEAD"));
  assert.ok(!skill.includes("reset --hard"));
});

test("SKILL.md says how to stop safely when a git step in the record flow fails", () => {
  const skill = read("skills", "factory", "SKILL.md");
  assert.ok(skill.includes("If `reset --keep` reports an error, stop and tell the user"));
  assert.ok(skill.includes("never retry with `--hard`"));
  assert.ok(skill.includes("If `git worktree remove` fails, stop and tell the user"));
  assert.ok(skill.includes("git merge --abort"));
  assert.ok(skill.includes("do not resolve conflicts yourself"));
  assert.ok(skill.includes("leave the stage as is (do not run `stage`"));
});

test("SKILL.md step 6 names the branch the repo is actually on", () => {
  const skill = read("skills", "factory", "SKILL.md");
  const start = skill.indexOf("### 6. Park for a human");
  const end = skill.indexOf("### 7. Record the job");
  assert.ok(start !== -1 && end > start);
  const step6 = skill.slice(start, end);
  assert.ok(step6.includes("git branch --show-current"));
  assert.ok(step6.includes("<mainBranch>"));
  assert.ok(step6.includes("<branch>"));
  assert.ok(step6.includes("three lines or fewer"));
  assert.ok(step6.includes("/factory approve <id>"));
  assert.ok(step6.includes("/factory rework <id> <note>"));
  assert.ok(!skill.includes("that the repo is left on `<mainBranch>` (the work is on `<branch>`)"));
});

test("SKILL.md has /factory approved for export, separate from /factory approve", () => {
  const skill = read("skills", "factory", "SKILL.md");
  assert.ok(skill.includes("/factory approved [<job-id>]"));
  assert.ok(skill.includes("node scripts/board.mjs export"));
  assert.ok(skill.includes("/factory approve <job-id>"));
  assert.ok(skill.includes("matched on the exact first word"));
  assert.ok(skill.includes("**`/factory approved [<id>]`**"));
  assert.ok(skill.includes("no commit is made for an export"));
});

test("builder.md forbids touching the backlog and committing factory files", () => {
  const builder = read("agents", "builder.md");
  assert.ok(builder.includes("factory/backlog.md"));
  assert.ok(builder.includes("Never stage or commit anything under `factory/`"));
  assert.ok(builder.includes("worktree"));
});

test("SKILL.md runs every job in its own worktree and never switches the main checkout", () => {
  const skill = read("skills", "factory", "SKILL.md");
  assert.ok(skill.includes("git worktree add -b <branch> <worktree> <mainBranch>"));
  assert.ok(skill.includes("node scripts/board.mjs preflight"));
  assert.ok(skill.includes("node scripts/board.mjs slots"));
  assert.ok(skill.includes("node scripts/board.mjs worktree <id>"));
  assert.ok(skill.includes("parallel.maxJobs"));
  assert.ok(skill.includes("/factory next [<n>]"));
  assert.ok(skill.includes("## Running several jobs"));
  assert.ok(!skill.includes("git switch"));
  assert.ok(!skill.includes("worktree remove --force"));
  assert.ok(!skill.includes("One job at a time in this version"));
});

test("SKILL.md tells the user what happens on a park, a full board, a short backlog and a spec gate", () => {
  const skill = read("skills", "factory", "SKILL.md");
  const step6 = skill.slice(skill.indexOf("### 6. Park for a human"), skill.indexOf("### 7. Record the job"));
  assert.ok(step6.includes("Work is on <branch> in <worktree>; the main checkout is on <current branch>."));
  assert.ok(step6.includes("merges <mainBranch> into <branch> first"));
  assert.ok(skill.includes("No free slot (active: <ids>)."));
  assert.ok(skill.includes("Started <k> of <n>: <ids>."));
  assert.ok(skill.includes("it leaves the round but keeps its slot while it waits, and the other jobs carry on"));
  assert.ok(skill.includes("its worktree (if any) was left in place"));
  assert.ok(skill.includes('wrap the path in double quotes (`git -C "<worktree>" ...`)'));
});

test("SKILL.md decides every failed git merge by MERGE_HEAD, not by git's message", () => {
  const skill = read("skills", "factory", "SKILL.md");
  assert.ok(skill.includes("whenever `git merge` exits non-zero"));
  assert.ok(skill.includes("git rev-parse -q --verify MERGE_HEAD"));
  assert.ok(skill.includes('git -C "<worktree>" rev-parse -q --verify MERGE_HEAD'));
  assert.ok(skill.includes('git -C "<worktree>" merge --abort'));
  assert.ok(skill.includes("conflict or rejected merge: <git line>"));
  assert.ok(skill.includes("merge refused: <git line>"));
  assert.ok(skill.includes("double quotes, `$` and backticks removed"));
  assert.ok(skill.includes("If `git merge --abort` fails, stop and tell the user"));
  assert.ok(skill.includes("and backslashes removed too"));
  assert.ok(skill.includes("In either branch never go on to the tests or `merged`."));
  const step5 = skill.slice(skill.indexOf("### 5. Approve"), skill.indexOf("### 6. Park for a human"));
  const started = step5.indexOf("If it succeeds, a merge started: run `git merge --abort`");
  const abortFails = step5.indexOf("If `git merge --abort` fails, stop and tell the user");
  const conflictNote = step5.indexOf("conflict or rejected merge: <git line>");
  const refused = step5.indexOf("If it fails, nothing started");
  assert.ok(started >= 0 && started < abortFails && abortFails < conflictNote && conflictNote < refused);
  const localLine = step5.split("\n").find((line) => line.startsWith("    - `local`:"));
  assert.ok(localLine !== undefined);
  assert.ok(!localLine.includes("MERGE_HEAD"));
  assert.ok(skill.includes("do not resolve conflicts yourself. If the merge exits 0, run `node scripts/board.mjs rework"));
  assert.ok(!skill.includes("In both cases never go on to the tests"));
  assert.ok(!skill.includes("If the merge reports conflicts"));
  assert.ok(!skill.includes("conflicts with <mainBranch>"));
  assert.ok(!skill.includes("merge refused: <git message>"));
  assert.ok(!skill.includes("refused without starting"));
});

test("every configured reviewer and the approver work in the job's worktree", () => {
  const config = JSON.parse(fs.readFileSync(path.join(source, "..", "factory", "config.json"), "utf8"));
  for (const name of [...config.reviewers, "approver"]) {
    const text = read("agents", `${name}.md`);
    assert.ok(text.includes("worktree"), `${name}.md must mention the worktree`);
  }
});
