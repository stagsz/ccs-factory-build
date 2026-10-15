// End-to-end: drive scripts/board.mjs the way the orchestrator does, in a temp repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "scripts", "board.mjs");
const realConfig = path.join(here, "..", "factory", "config.json");

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-factory-"));
  fs.mkdirSync(path.join(root, "factory"), { recursive: true });
  fs.copyFileSync(realConfig, path.join(root, "factory", "config.json"));
  fs.writeFileSync(path.join(root, "factory", "backlog.md"), "# Backlog\n- [ ] Health check :: Add GET /health\n");
  const run = (...args) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return { root, run };
}

function writeReview(root, id, reviewer, verdict) {
  fs.writeFileSync(path.join(root, "factory", "jobs", id, "reviews", `${reviewer}.md`), `# review\n\nVERDICT: ${verdict}\n`);
}

const reviewers = JSON.parse(fs.readFileSync(realConfig, "utf8")).reviewers;

test("full line through the CLI: next -> rework once -> merged", () => {
  const { root, run } = setup();
  run("init");
  const id = run("next");
  assert.match(id, /^j-\d{8}-001$/);
  assert.ok(fs.existsSync(path.join(root, "factory", "jobs", id, "request.md")));
  assert.match(fs.readFileSync(path.join(root, "factory", "backlog.md"), "utf8"), /\[~\] Health check :: Add GET \/health \(j-/);

  run("stage", id, "spec");
  run("stage", id, "build");
  run("stage", id, "review");

  for (const r of reviewers) writeReview(root, id, r, r === "code-reviewer" ? "changes" : "pass");
  for (const r of reviewers) run("verdict", id, r);
  assert.equal(run("decide-review", id), "rework");
  assert.match(run("rework", id, "--note", "add missing test"), /rework \(rework 1\/2\)/);

  run("stage", id, "review");
  for (const r of reviewers) writeReview(root, id, r, "pass");
  for (const r of reviewers) run("verdict", id, r);
  assert.equal(run("decide-review", id), "approve");

  run("stage", id, "approve");
  fs.writeFileSync(path.join(root, "factory", "jobs", id, "approval.md"), "RISK: low\nDECISION: merge\n");
  const decision = JSON.parse(run("decide-merge", id, "src/routes/health.js", "tests/health.test.js"));
  assert.equal(decision.action, "merged");
  run("stage", id, "merged", "--note", "abc123");

  const job = JSON.parse(run("show", id));
  assert.equal(job.stage, "merged");
  assert.equal(job.rework, 1);
  assert.equal(job.risk.level, "low");
  assert.equal(run("validate"), "Board is valid.");
});

test("risk floor overrides an approver who wants to merge", () => {
  const { root, run } = setup();
  run("init");
  const id = run("new", "Bump", "deps", "--request", "Upgrade lodash");
  for (const s of ["spec", "build", "review"]) run("stage", id, s);
  for (const r of reviewers) { writeReview(root, id, r, "pass"); run("verdict", id, r); }
  run("stage", id, "approve");
  fs.writeFileSync(path.join(root, "factory", "jobs", id, "approval.md"), "RISK: low\nDECISION: merge\n");
  const decision = JSON.parse(run("decide-merge", id, "package.json"));
  assert.equal(decision.action, "needs-human");
  assert.match(decision.why, /package\.json/);
});

test("CLI reports illegal moves and missing agent output as errors", () => {
  const { run } = setup();
  run("init");
  const id = run("new", "Thing");
  assert.throws(() => run("stage", id, "merged"), (e) => /cannot move from "queued" to "merged"/.test(e.stderr));
  for (const s of ["spec", "build", "review"]) run("stage", id, s);
  assert.throws(() => run("verdict", id, "code-reviewer"), (e) => /has not written its output/.test(e.stderr));
});
