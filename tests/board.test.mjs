import { test } from "node:test";
import assert from "node:assert/strict";
import * as B from "../scripts/lib/board.mjs";

const config = {
  repo: { branchPrefix: "factory/" },
  reviewers: ["security-reviewer", "ux-reviewer", "ui-design-reviewer", "code-reviewer"],
  maxReworkCycles: 2,
  risk: { maxFilesForLowRisk: 3, alwaysEscalatePaths: ["**/auth/**", "package.json", ".github/**"] },
};
const NOW = new Date("2026-10-15T12:00:00Z");

function freshJob(title = "Unpaywall course pages") {
  const board = B.emptyBoard();
  const job = B.createJob(board, { title }, config, NOW);
  return { board, job };
}

function walk(board, id, stages) {
  for (const s of stages) B.setStage(board, id, s, "", NOW);
}

function allVerdicts(board, id, v) {
  for (const r of config.reviewers) B.recordVerdict(board, id, r, v, config, NOW);
}

test("createJob assigns sequential ids and a slugged branch", () => {
  const board = B.emptyBoard();
  const a = B.createJob(board, { title: "Fix Login Bug!" }, config, NOW);
  const b = B.createJob(board, { title: "Second" }, config, NOW);
  assert.equal(a.id, "j-20261015-001");
  assert.equal(b.id, "j-20261015-002");
  assert.equal(a.branch, "factory/j-20261015-001-fix-login-bug");
  assert.equal(a.stage, "queued");
  assert.equal(a.request, "Fix Login Bug!");
});

test("createJob rejects an empty title", () => {
  assert.throws(() => B.createJob(B.emptyBoard(), { title: "  " }, config, NOW), /title/);
});

test("happy path reaches merged", () => {
  const { board, job } = freshJob();
  walk(board, job.id, ["spec", "build", "review"]);
  allVerdicts(board, job.id, "pass");
  assert.equal(B.decideReview(job, config), "approve");
  walk(board, job.id, ["approve", "merged"]);
  assert.equal(job.stage, "merged");
  assert.deepEqual(job.history.map((h) => h.stage), ["queued", "spec", "build", "review", "approve", "merged"]);
});

test("illegal transitions are refused with the allowed list", () => {
  const { board, job } = freshJob();
  assert.throws(() => B.setStage(board, job.id, "merged"), /cannot move from "queued" to "merged".*spec, failed/);
  assert.throws(() => B.setStage(board, job.id, "shipping"), /Unknown stage/);
});

test("terminal stages cannot move", () => {
  const { board, job } = freshJob();
  B.setStage(board, job.id, "failed", "boom", NOW);
  assert.throws(() => B.setStage(board, job.id, "spec"), /terminal/);
});

test("decideReview waits for every reviewer", () => {
  const { board, job } = freshJob();
  walk(board, job.id, ["spec", "build", "review"]);
  B.recordVerdict(board, job.id, "code-reviewer", "pass", config, NOW);
  assert.equal(B.decideReview(job, config), "pending");
});

test("any block escalates to a human", () => {
  const { board, job } = freshJob();
  walk(board, job.id, ["spec", "build", "review"]);
  allVerdicts(board, job.id, "pass");
  B.recordVerdict(board, job.id, "security-reviewer", "block", config, NOW);
  assert.equal(B.decideReview(job, config), "needs-human");
});

test("rework loop runs max 2 cycles, then escalates", () => {
  const { board, job } = freshJob();
  walk(board, job.id, ["spec", "build", "review"]);

  for (let cycle = 1; cycle <= 2; cycle++) {
    allVerdicts(board, job.id, "pass");
    B.recordVerdict(board, job.id, "code-reviewer", "changes", config, NOW);
    assert.equal(B.decideReview(job, config), "rework");
    B.startRework(board, job.id, config, `cycle ${cycle}`, NOW);
    assert.equal(job.stage, "rework");
    assert.equal(job.rework, cycle);
    B.setStage(board, job.id, "review", "", NOW);
    assert.deepEqual(job.verdicts, {}, "verdicts reset each review round");
  }

  allVerdicts(board, job.id, "pass");
  B.recordVerdict(board, job.id, "ux-reviewer", "changes", config, NOW);
  assert.equal(B.decideReview(job, config), "needs-human");
  B.startRework(board, job.id, config, "third try", NOW);
  assert.equal(job.stage, "needs-human");
  assert.equal(job.rework, 2);
});

test("human rework from needs-human grants a fresh budget", () => {
  const { board, job } = freshJob();
  walk(board, job.id, ["spec", "build", "review", "needs-human"]);
  job.rework = 2;
  B.startRework(board, job.id, config, "use the existing guard", NOW);
  assert.equal(job.stage, "rework");
  assert.equal(job.rework, 1);
  assert.deepEqual(B.validateBoard(board, config), []);
});

test("verdicts only in review, only known reviewers, only valid values", () => {
  const { board, job } = freshJob();
  assert.throws(() => B.recordVerdict(board, job.id, "code-reviewer", "pass", config, NOW), /only accepted in "review"/);
  walk(board, job.id, ["spec", "build", "review"]);
  assert.throws(() => B.recordVerdict(board, job.id, "vibes-reviewer", "pass", config, NOW), /Unknown reviewer/);
  assert.throws(() => B.recordVerdict(board, job.id, "code-reviewer", "lgtm", config, NOW), /Verdict must be/);
});

test("parseVerdict takes the last VERDICT line", () => {
  assert.equal(B.parseVerdict("intro\nVERDICT: changes\nmore\nVERDICT: pass\n"), "pass");
  assert.equal(B.parseVerdict("  verdict:   BLOCK  "), "block");
  assert.equal(B.parseVerdict("I think VERDICT: pass is fine"), null);
  assert.equal(B.parseVerdict("no verdict here"), null);
});

test("parseApproval reads RISK and DECISION", () => {
  assert.deepEqual(B.parseApproval("# x\nRISK: low\nDECISION: merge\n"), { risk: "low", decision: "merge" });
  assert.deepEqual(B.parseApproval("RISK: maybe\n"), { risk: null, decision: null });
});

test("globToRegExp handles ** and *", () => {
  assert.ok(B.globToRegExp("**/auth/**").test("src/auth/login.ts"));
  assert.ok(B.globToRegExp("**/auth/**").test("auth/x.js"));
  assert.ok(!B.globToRegExp("**/auth/**").test("src/author.ts"));
  assert.ok(B.globToRegExp("src/*.js").test("src/a.js"));
  assert.ok(!B.globToRegExp("src/*.js").test("src/deep/a.js"));
  assert.ok(B.globToRegExp("package.json").test("package.json"));
  assert.ok(!B.globToRegExp("package.json").test("packageXjson"));
});

test("assessRisk escalates sensitive paths and large diffs, accepts Windows paths", () => {
  assert.deepEqual(B.assessRisk(["src/pages/course.tsx"], config), { level: "low", reasons: [] });
  const auth = B.assessRisk(["src\\auth\\guard.ts"], config);
  assert.equal(auth.level, "high");
  assert.match(auth.reasons[0], /src\/auth\/guard\.ts/);
  assert.equal(B.assessRisk(["a", "b", "c", "d"], config).level, "high");
});

test("decideMerge needs approver merge, low risk, and a low floor", () => {
  const low = { level: "low", reasons: [] };
  const high = { level: "high", reasons: ["sensitive paths: package.json"] };
  assert.equal(B.decideMerge({ risk: "low", decision: "merge" }, low).action, "merged");
  assert.equal(B.decideMerge({ risk: "low", decision: "escalate" }, low).action, "needs-human");
  assert.equal(B.decideMerge({ risk: "high", decision: "merge" }, low).action, "needs-human");
  const floored = B.decideMerge({ risk: "low", decision: "merge" }, high);
  assert.equal(floored.action, "needs-human");
  assert.match(floored.why, /package\.json/);
  assert.equal(B.decideMerge({ risk: null, decision: null }, low).action, "needs-human");
});

test("backlog: next item, request split, marking, CRLF preserved", () => {
  const md = "# Backlog\r\n- [x] done\r\n- [~] running (j-1)\r\n- [ ] Health check :: Add GET /health\r\n- [ ] Later\r\n";
  const item = B.nextBacklogItem(md);
  assert.equal(item.title, "Health check");
  assert.equal(item.request, "Add GET /health");
  const marked = B.markBacklogItem(md, item, "j-20261015-001");
  assert.ok(marked.includes("- [~] Health check :: Add GET /health (j-20261015-001)\r\n"));
  assert.equal(B.nextBacklogItem(marked).title, "Later");
  assert.equal(B.nextBacklogItem("# empty\n- [x] all done\n"), null);
});

test("validateBoard catches duplicates, bad stages and bad verdicts", () => {
  const { board, job } = freshJob();
  board.jobs.push({ ...job });
  board.jobs[1].stage = "shipping";
  board.jobs[1].verdicts = { "code-reviewer": "lgtm" };
  const errors = B.validateBoard(board, config);
  assert.ok(errors.some((e) => /duplicate/.test(e)));
  assert.ok(errors.some((e) => /unknown stage/.test(e)));
  assert.ok(errors.some((e) => /bad verdict/.test(e)));
});

test("slugify strips accents and symbols", () => {
  assert.equal(B.slugify("Göteborg Event-Scout: v2!!"), "goteborg-event-scout-v2");
  assert.equal(B.slugify("***"), "job");
});
