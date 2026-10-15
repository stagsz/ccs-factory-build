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
  // The real config names the user's vault. No test may export there: switch it off
  // here, and export tests point it at a fresh temp dir with setVault().
  setVault(root, null);
  fs.writeFileSync(path.join(root, "factory", "backlog.md"), "# Backlog\n- [ ] Health check :: Add GET /health\n");
  const run = (...args) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return { root, run };
}

function setVault(root, dir) {
  const file = path.join(root, "factory", "config.json");
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  config.export = { obsidianDir: dir };
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
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

const allCommands = ["init", "new", "next", "stage", "verdict", "decide-review", "rework", "risk", "decide-merge", "show", "list", "history", "export", "validate", "help"];

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

test("history prints the job header and its stages oldest first, read-only", () => {
  const { root, run } = setup();
  run("init");
  const id = run("new", "History", "job");
  run("stage", id, "spec", "--note", "spec ready");
  const boardFile = path.join(root, "factory", "board.json");
  const before = fs.readFileSync(boardFile);
  const job = JSON.parse(run("show", id));
  const lines = run("history", id).split(/\r?\n/);
  assert.equal(lines.length, 6);
  assert.equal(lines[0], `${id}  History job`);
  assert.equal(lines[1], `Branch: ${job.branch}`);
  assert.equal(lines[2], "");
  assert.match(lines[3], /^AT\s+STAGE\s+NOTE$/);
  assert.match(lines[4], /^\S+\s+queued\s+created from cli$/);
  assert.match(lines[5], /^\S+\s+spec\s+spec ready$/);
  assert.ok(fs.readFileSync(boardFile).equals(before), "history must not rewrite board.json");
});

test("history with an unknown id prints an error to stderr and exits 1", () => {
  const { root, run } = setup();
  run("init");
  const r = spawnSync(process.execPath, [cli, "history", "j-nope"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^error: No job with id j-nope\./);
});

test("history with no id prints a usage error to stderr and exits 1", () => {
  const { root, run } = setup();
  run("init");
  const r = spawnSync(process.execPath, [cli, "history"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^error: history needs a job id\. Usage: node scripts\/board\.mjs history <id>/);
  assert.doesNotMatch(r.stderr, /undefined/);
});

test("CLI reports illegal moves and missing agent output as errors", () => {
  const { run } = setup();
  run("init");
  const id = run("new", "Thing");
  assert.throws(() => run("stage", id, "merged"), (e) => /cannot move from "queued" to "merged"/.test(e.stderr));
  for (const s of ["spec", "build", "review"]) run("stage", id, s);
  assert.throws(() => run("verdict", id, "code-reviewer"), (e) => /has not written its output/.test(e.stderr));
});

// ---------- export ----------
// Every export test points export.obsidianDir at a fresh temp dir (or null) first.

function freshVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ccs-factory-vault-"));
}

// Drive a job to merged, writing the agent files a real run leaves behind.
function mergeJob(root, run, title) {
  const id = run("new", title);
  const dir = path.join(root, "factory", "jobs", id);
  run("stage", id, "spec");
  fs.writeFileSync(path.join(dir, "spec.md"), `# Spec: ${title}\n`);
  run("stage", id, "build");
  fs.writeFileSync(path.join(dir, "build.md"), `# Build report: ${title}\n`);
  run("stage", id, "review");
  for (const r of reviewers) { writeReview(root, id, r, "pass"); run("verdict", id, r); }
  run("stage", id, "approve");
  fs.writeFileSync(path.join(dir, "approval.md"), "RISK: low\nDECISION: merge\n");
  run("stage", id, "merged", "--note", "abc123");
  return id;
}

function exportRun(root, ...args) {
  return spawnSync(process.execPath, [cli, "export", ...args], { cwd: root, encoding: "utf8" });
}

function listTree(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true }).map((p) => p.split(path.sep).join("/")).sort();
}

test("export copies a merged job's records and writes a linked index note", () => {
  const { root, run } = setup();
  const vault = freshVault();
  setVault(root, vault);
  run("init");
  const id = mergeJob(root, run, "Export me");
  const printed = run("export", id);
  const target = path.join(vault, "Export me");
  assert.equal(printed, target);

  const jobDir = path.join(root, "factory", "jobs", id);
  const reviewFiles = [...reviewers].sort().map((r) => `reviews/${r}.md`);
  const copied = ["request.md", "spec.md", "build.md", ...reviewFiles, "approval.md"];
  for (const rel of copied) {
    const parts = rel.split("/");
    assert.ok(fs.readFileSync(path.join(target, ...parts)).equals(fs.readFileSync(path.join(jobDir, ...parts))), rel);
  }
  assert.deepEqual(listTree(target), ["Export me.md", ...copied.filter((f) => !f.startsWith("reviews/")), "reviews", ...reviewFiles].sort());

  const index = fs.readFileSync(path.join(target, "Export me.md"), "utf8");
  assert.ok(index.startsWith(`---\nfactory-job: ${id}\n`));
  assert.ok(index.includes("\n# Export me\n"));
  const links = index.split("\n").filter((l) => l.includes("[[")).map((l) => /\[\[([^|\]]+)\|/.exec(l)[1]);
  assert.deepEqual(links, copied.map((f) => `Export me/${f.replace(/\.md$/, "")}`));
});

test("export with no id picks the most recently merged job", () => {
  const { root, run } = setup();
  const vault = freshVault();
  setVault(root, vault);
  run("init");
  const first = mergeJob(root, run, "First merged");
  mergeJob(root, run, "Second merged");
  // Make the first job's merge the latest, so list order cannot be what decides.
  const boardFile = path.join(root, "factory", "board.json");
  const board = JSON.parse(fs.readFileSync(boardFile, "utf8"));
  board.jobs.find((j) => j.id === first).history.find((h) => h.stage === "merged").at = "2099-01-01T00:00:00.000Z";
  fs.writeFileSync(boardFile, JSON.stringify(board, null, 2) + "\n");
  assert.equal(run("export"), path.join(vault, "First merged"));
  assert.deepEqual(fs.readdirSync(vault), ["First merged"]);
});

test("export with no merged job exits 1", () => {
  const { root, run } = setup();
  const vault = freshVault();
  setVault(root, vault);
  run("init");
  run("new", "Not done");
  const r = exportRun(root);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /^error: No merged job to export\./);
  assert.deepEqual(fs.readdirSync(vault), []);
});

test("export with an unknown id exits 1 with the usual message", () => {
  const { root, run } = setup();
  setVault(root, freshVault());
  run("init");
  const r = exportRun(root, "j-nope");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^error: No job with id j-nope\./);
});

test("export of a job that is not merged exits 1 and writes nothing", () => {
  const { root, run } = setup();
  const vault = freshVault();
  setVault(root, vault);
  run("init");
  const id = run("new", "Half done");
  run("stage", id, "spec");
  const r = exportRun(root, id);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.ok(r.stderr.includes(id));
  assert.ok(r.stderr.includes('"spec"'));
  assert.match(r.stderr, /Only merged jobs can be exported\./);
  assert.deepEqual(fs.readdirSync(vault), []);
});

test("export with obsidianDir null or empty exits 1 naming the config key and file", () => {
  const { root, run } = setup();
  run("init");
  const id = mergeJob(root, run, "Export me");
  for (const value of [null, ""]) {
    setVault(root, value);
    const r = exportRun(root, id);
    assert.equal(r.status, 1);
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.includes("export.obsidianDir"));
    assert.ok(r.stderr.includes("factory/config.json"));
  }
});

test("export with an obsidianDir that does not exist exits 1 and does not create it", () => {
  const { root, run } = setup();
  run("init");
  const id = mergeJob(root, run, "Export me");
  const missing = path.join(freshVault(), "no-such-vault");
  setVault(root, missing);
  const r = exportRun(root, id);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(missing));
  assert.equal(fs.existsSync(missing), false);
});

test("export resolves a relative obsidianDir against the repo root", () => {
  const { root, run } = setup();
  fs.mkdirSync(path.join(root, "vault"));
  setVault(root, "vault");
  run("init");
  const id = mergeJob(root, run, "Export me");
  assert.equal(run("export", id), path.join(root, "vault", "Export me"));
});

test("export into a folder owned by another job or by the user adds an (<id>) suffix", () => {
  const { root, run } = setup();
  const vault = freshVault();
  setVault(root, vault);
  run("init");
  const id = mergeJob(root, run, "Export me");
  fs.mkdirSync(path.join(vault, "Export me"));
  const theirs = "---\nfactory-job: j-20200101-001\n---\n# Export me\n";
  fs.writeFileSync(path.join(vault, "Export me", "Export me.md"), theirs);
  assert.equal(run("export", id), path.join(vault, `Export me (${id})`));
  assert.equal(fs.readFileSync(path.join(vault, "Export me", "Export me.md"), "utf8"), theirs);
  assert.deepEqual(fs.readdirSync(path.join(vault, "Export me")), ["Export me.md"]);
  const index = fs.readFileSync(path.join(vault, `Export me (${id})`, `Export me (${id}).md`), "utf8");
  assert.ok(index.includes(`[[Export me (${id})/spec|`));

  // A folder the user made by hand (no index note) is never written into either.
  const vault2 = freshVault();
  setVault(root, vault2);
  fs.mkdirSync(path.join(vault2, "Export me"));
  assert.equal(run("export", id), path.join(vault2, `Export me (${id})`));
  assert.deepEqual(fs.readdirSync(path.join(vault2, "Export me")), []);

  // If the suffixed folder is also someone else's, stop instead of writing into it.
  const vault3 = freshVault();
  setVault(root, vault3);
  fs.mkdirSync(path.join(vault3, "Export me"));
  fs.mkdirSync(path.join(vault3, `Export me (${id})`));
  const r = exportRun(root, id);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /is not this job's export/);
  assert.deepEqual(fs.readdirSync(path.join(vault3, `Export me (${id})`)), []);
});

test("re-export overwrites the same folder and keeps files the user added", () => {
  const { root, run } = setup();
  const vault = freshVault();
  setVault(root, vault);
  run("init");
  const id = mergeJob(root, run, "Export me");
  const target = run("export", id);
  fs.writeFileSync(path.join(target, "spec.md"), "edited in Obsidian\n");
  fs.writeFileSync(path.join(target, "Export me.md"), `---\nfactory-job: ${id}\n---\nstale index\n`);
  fs.writeFileSync(path.join(target, "my notes.md"), "keep me\n");
  assert.equal(run("export", id), target);
  assert.deepEqual(fs.readdirSync(vault), ["Export me"]);
  assert.ok(fs.readFileSync(path.join(target, "spec.md")).equals(fs.readFileSync(path.join(root, "factory", "jobs", id, "spec.md"))));
  assert.doesNotMatch(fs.readFileSync(path.join(target, "Export me.md"), "utf8"), /stale index/);
  assert.equal(fs.readFileSync(path.join(target, "my notes.md"), "utf8"), "keep me\n");
});

test("export leaves board.json and the job folder byte-identical", () => {
  const { root, run } = setup();
  setVault(root, freshVault());
  run("init");
  const id = mergeJob(root, run, "Export me");
  const boardFile = path.join(root, "factory", "board.json");
  const jobDir = path.join(root, "factory", "jobs", id);
  const snapshot = () => [
    fs.readFileSync(boardFile).toString("base64"),
    ...listTree(jobDir).map((rel) => {
      const abs = path.join(jobDir, ...rel.split("/"));
      return `${rel}:${fs.statSync(abs).isFile() ? fs.readFileSync(abs).toString("base64") : "dir"}`;
    }),
  ];
  const before = snapshot();
  run("export", id);
  run("export", id);
  assert.deepEqual(snapshot(), before);
});

test("help lists export [<id>]", () => {
  const { run } = setup();
  assert.match(run("help"), /^  export \[<id>\]\s+export a merged job/m);
});
