// End-to-end: drive scripts/board.mjs the way the orchestrator does, in a temp repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
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
  assert.equal(run("stage", id, "merged", "--note", "abc123"), `${id} -> merged`);
  assert.equal(
    fs.readFileSync(path.join(root, "factory", "backlog.md"), "utf8"),
    `# Backlog\n- [x] Health check :: Add GET /health (${id})\n`,
  );

  const job = JSON.parse(run("show", id));
  assert.equal(job.stage, "merged");
  assert.equal(job.rework, 1);
  assert.equal(job.risk.level, "low");
  assert.equal(run("validate"), "Board is valid.");
});

test("a backlog job that fails closes its line with [!]", () => {
  const { root, run } = setup();
  const backlog = path.join(root, "factory", "backlog.md");
  run("init");
  const id = run("next");
  assert.equal(run("stage", id, "spec"), `${id} -> spec`);
  assert.equal(fs.readFileSync(backlog, "utf8"), `# Backlog\n- [~] Health check :: Add GET /health (${id})\n`);
  assert.equal(run("stage", id, "failed"), `${id} -> failed`);
  assert.equal(fs.readFileSync(backlog, "utf8"), `# Backlog\n- [!] Health check :: Add GET /health (${id})\n`);
});

test("a cli job reaching failed leaves backlog.md byte-identical", () => {
  const { root, run } = setup();
  const backlog = path.join(root, "factory", "backlog.md");
  run("init");
  const id = run("new", "Manual", "job");
  // A [~] line ending with this id must still be ignored for a cli-source job.
  fs.writeFileSync(backlog, `# Backlog\r\n- [~] Lookalike (${id})\r\n- [ ] Health check\r\n`);
  const before = fs.readFileSync(backlog);
  run("stage", id, "spec");
  assert.equal(run("stage", id, "failed"), `${id} -> failed`);
  assert.ok(fs.readFileSync(backlog).equals(before));
});

test("stage failed succeeds and creates no backlog.md when the file is missing", () => {
  const { root, run } = setup();
  const backlog = path.join(root, "factory", "backlog.md");
  run("init");
  const id = run("next");
  fs.rmSync(backlog);
  const r = spawnSync(process.execPath, [cli, "stage", id, "failed"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `${id} -> failed`);
  assert.equal(fs.existsSync(backlog), false);
  assert.equal(JSON.parse(run("show", id)).stage, "failed");
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

const allCommands = ["init", "new", "next", "stage", "verdict", "decide-review", "rework", "risk", "decide-merge", "show", "list", "validate", "help"];

test("help, --help and -h print the same usage and exit 0 before init", () => {
  const { root, run } = setup();
  const outputs = ["help", "--help", "-h"].map((a) => run(a));
  for (const o of outputs) {
    assert.match(o, /^Usage: node scripts\/board\.mjs/);
    for (const c of allCommands) assert.ok(o.includes(c), `usage is missing "${c}"`);
  }
  assert.equal(outputs[1], outputs[0]);
  assert.equal(outputs[2], outputs[0]);
  assert.equal(fs.existsSync(path.join(root, "factory", "board.json")), false);
});

test("help works in a directory with no factory/ folder and writes nothing to stderr", () => {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-factory-bare-"));
  const r = spawnSync(process.execPath, [cli, "help"], { cwd: bare, encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
  assert.match(r.stdout, /^Usage: node scripts\/board\.mjs/);
  assert.equal(fs.existsSync(path.join(bare, "factory")), false);
});

test("no command prints usage only and exits 2", () => {
  const { run } = setup();
  assert.throws(() => run(), (e) => e.status === 2 && /Usage:/.test(e.stdout) && !/Unknown command/.test(e.stdout));
});

test("unknown command prints the command list, then usage, and exits 2", () => {
  const { run } = setup();
  assert.throws(
    () => run("bogus"),
    (e) => {
      if (e.status !== 2) return false;
      const [first, ...rest] = e.stdout.split(/\r?\n/);
      const m = /^Unknown command "bogus"\. Commands: (.+)$/.exec(first);
      if (!m) return false;
      const usage = rest.join("\n");
      if (!/^Usage:/.test(usage)) return false;
      // Drift guard: every key of `commands` must be documented in USAGE.
      for (const name of m[1].split(", ")) assert.match(usage, new RegExp(`^  ${name}\\b`, "m"));
      return true;
    },
  );
});

test("names inherited from Object.prototype are unknown commands", () => {
  const { root, run } = setup();
  for (const name of ["toString", "constructor", "hasOwnProperty", "__proto__", "valueOf"]) {
    assert.throws(
      () => run(name),
      (e) => {
        if (e.status !== 2) return false;
        const [first, ...rest] = e.stdout.split(/\r?\n/);
        if (!first.startsWith(`Unknown command "${name}". Commands: `)) return false;
        if (!/Usage:/.test(rest.join("\n"))) return false;
        return e.stderr === "";
      },
      `"${name}" should be an unknown command`,
    );
  }
  assert.ok(!fs.existsSync(path.join(root, "factory", "board.json")));
});

test("list on a repo with no board.json prints No jobs. and creates nothing", () => {
  const { root, run } = setup();
  assert.equal(run("list"), "No jobs.");
  assert.equal(fs.existsSync(path.join(root, "factory", "board.json")), false);
});

test("list prints a header and one row per job in creation order, read-only", () => {
  const { root, run } = setup();
  run("init");
  const first = run("new", "First job");
  const second = run("new", "Second", "job", "title");
  run("stage", first, "spec");
  const boardFile = path.join(root, "factory", "board.json");
  const before = fs.readFileSync(boardFile);
  const lines = run("list").split(/\r?\n/);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^ID\s+STAGE\s+REWORK\s+TITLE$/);
  assert.match(lines[1], new RegExp(`^${first}\\s+spec\\s+0\\s+First job$`));
  assert.match(lines[2], new RegExp(`^${second}\\s+queued\\s+0\\s+Second job title$`));
  assert.ok(fs.readFileSync(boardFile).equals(before), "list must not rewrite board.json");
});

test("CLI reports illegal moves and missing agent output as errors", () => {
  const { run } = setup();
  run("init");
  const id = run("new", "Thing");
  assert.throws(() => run("stage", id, "merged"), (e) => /cannot move from "queued" to "merged"/.test(e.stderr));
  for (const s of ["spec", "build", "review"]) run("stage", id, s);
  assert.throws(() => run("verdict", id, "code-reviewer"), (e) => /has not written its output/.test(e.stderr));
});
