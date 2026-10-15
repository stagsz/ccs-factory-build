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

test("closeBacklogItem: x and ! on LF, other lines unchanged, trailing newline kept", () => {
  const md = "# Backlog\n- [x] done (j-0)\n- [~] Health check :: Add GET /health (j-1)\n- [~] Other (j-2)\n- [ ] Later\n";
  assert.equal(
    B.closeBacklogItem(md, "j-1", "x"),
    "# Backlog\n- [x] done (j-0)\n- [x] Health check :: Add GET /health (j-1)\n- [~] Other (j-2)\n- [ ] Later\n",
  );
  assert.equal(
    B.closeBacklogItem(md, "j-2", "!"),
    "# Backlog\n- [x] done (j-0)\n- [~] Health check :: Add GET /health (j-1)\n- [!] Other (j-2)\n- [ ] Later\n",
  );
});

test("closeBacklogItem: x and ! on CRLF stay CRLF", () => {
  const md = "# Backlog\r\n  * [~] Indented (j-1)  \r\n- [~] Other (j-2)\r\n- [ ] Later\r\n";
  assert.equal(B.closeBacklogItem(md, "j-1", "x"), "# Backlog\r\n  * [x] Indented (j-1)  \r\n- [~] Other (j-2)\r\n- [ ] Later\r\n");
  assert.equal(B.closeBacklogItem(md, "j-2", "!"), "# Backlog\r\n  * [~] Indented (j-1)  \r\n- [!] Other (j-2)\r\n- [ ] Later\r\n");
});

test("closeBacklogItem: no match returns the same string", () => {
  const md = "# Backlog\n- [~] Running (j-1)\n- [ ] Queued (j-3)\n";
  assert.equal(B.closeBacklogItem(md, "j-9", "x"), md);
  assert.equal(B.closeBacklogItem(md, "j-3", "x"), md);
  assert.equal(B.closeBacklogItem("", "j-1", "!"), "");
});

test("closeBacklogItem: id-prefix collisions change nothing", () => {
  const short = "- [~] A (j-1)\n";
  const long = "- [~] B (j-11)\n";
  assert.equal(B.closeBacklogItem(long, "j-1", "x"), long);
  assert.equal(B.closeBacklogItem(short, "j-11", "x"), short);
  assert.equal(B.closeBacklogItem("- [~] C (xj-1)\n", "j-1", "x"), "- [~] C (xj-1)\n");
});

test("closeBacklogItem: already-closed lines change nothing", () => {
  const md = "- [x] Merged (j-1)\n- [!] Failed (j-2)\n";
  assert.equal(B.closeBacklogItem(md, "j-1", "!"), md);
  assert.equal(B.closeBacklogItem(md, "j-2", "x"), md);
});

test("closeBacklogItem: invalid mark throws", () => {
  for (const bad of ["[x]", "X", "~", " ", "", undefined]) {
    assert.throws(() => B.closeBacklogItem("- [~] A (j-1)\n", "j-1", bad), /mark/);
  }
});

test("nextBacklogItem skips [!], [x] and [~] lines", () => {
  const md = "- [!] Failed (j-1)\n- [x] Merged (j-2)\n- [~] Running (j-3)\n- [ ] Next one\n";
  assert.equal(B.nextBacklogItem(md).title, "Next one");
  assert.equal(B.nextBacklogItem("- [!] Failed (j-1)\n"), null);
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

test("formatJobList: empty board prints No jobs.", () => {
  assert.equal(B.formatJobList(B.emptyBoard()), "No jobs.");
});

test("formatJobList: aligned columns, two-space gaps, no trailing whitespace", () => {
  const board = B.emptyBoard();
  board.jobs.push(
    { id: "j-20261015-001", stage: "queued", rework: 0, title: "Short", createdAt: "2026-10-15T10:00:00.000Z" },
    { id: "j-20261015-002", stage: "needs-human", rework: 12, title: "A much longer title here", createdAt: "2026-10-15T11:00:00.000Z" },
    { id: "j-1", stage: "spec", rework: 3, title: "Mid title", createdAt: "2026-10-15T12:00:00.000Z" },
  );
  const expected = [
    "ID              STAGE        REWORK  TITLE",
    "j-20261015-001  queued       0       Short",
    "j-20261015-002  needs-human  12      A much longer title here",
    "j-1             spec         3       Mid title",
  ].join("\n");
  const text = B.formatJobList(board);
  assert.equal(text, expected);
  for (const line of text.split("\n")) assert.equal(line, line.trimEnd());
  assert.ok(!text.endsWith("\n"));
});

test("formatJobList: sorts by createdAt ascending (stable), without touching the board", () => {
  const board = B.emptyBoard();
  board.jobs.push(
    { id: "j-c", stage: "build", rework: 1, title: "Newest", createdAt: "2026-10-15T12:00:00.000Z" },
    { id: "j-a", stage: "queued", rework: 0, title: "Oldest", createdAt: "2026-10-14T09:00:00.000Z" },
    { id: "j-b1", stage: "spec", rework: 0, title: "Tie first", createdAt: "2026-10-15T08:00:00.000Z" },
    { id: "j-b2", stage: "spec", rework: 0, title: "Tie second", createdAt: "2026-10-15T08:00:00.000Z" },
  );
  const before = structuredClone(board.jobs);
  const jobsRef = board.jobs;
  const ids = B.formatJobList(board).split("\n").slice(1).map((l) => l.split(/\s+/)[0]);
  assert.deepEqual(ids, ["j-a", "j-b1", "j-b2", "j-c"]);
  assert.equal(board.jobs, jobsRef);
  assert.deepEqual(board.jobs, before);
});

const historyJob = (history) => ({ id: "j-20261015-008", title: "History job", branch: "factory/j-20261015-008-history-job", history });

test("formatJobHistory: header lines, aligned columns, empty note, no trailing whitespace", () => {
  const job = historyJob([
    { stage: "queued", at: "2026-10-15T10:00:00.000Z", note: "created from cli" },
    { stage: "needs-human", at: "2026-10-15T11:00:00.000Z", note: "" },
    { stage: "spec", at: "2026-10-15T12:00:00.000Z", note: "go" },
  ]);
  const expected = [
    "j-20261015-008  History job",
    "Branch: factory/j-20261015-008-history-job",
    "",
    "AT                        STAGE        NOTE",
    "2026-10-15T10:00:00.000Z  queued       created from cli",
    "2026-10-15T11:00:00.000Z  needs-human",
    "2026-10-15T12:00:00.000Z  spec         go",
  ].join("\n");
  const text = B.formatJobHistory(job);
  assert.equal(text, expected);
  for (const line of text.split("\n")) assert.equal(line, line.trimEnd());
  assert.ok(!text.endsWith("\n"));
});

test("formatJobHistory: sorts by at ascending (stable), without touching the job", () => {
  const job = historyJob([
    { stage: "build", at: "2026-10-15T12:00:00.000Z", note: "newest" },
    { stage: "queued", at: "2026-10-14T09:00:00.000Z", note: "oldest" },
    { stage: "spec", at: "2026-10-15T08:00:00.000Z", note: "tie first" },
    { stage: "rework", at: "2026-10-15T08:00:00.000Z", note: "tie second" },
  ]);
  const before = structuredClone(job);
  const historyRef = job.history;
  const notes = B.formatJobHistory(job).split("\n").slice(4).map((l) => l.split(/\s{2,}/).pop());
  assert.deepEqual(notes, ["oldest", "tie first", "tie second", "newest"]);
  assert.equal(job.history, historyRef);
  assert.deepEqual(job, before);
});

test("formatJobHistory: empty or missing history prints No history.", () => {
  const expected = "j-20261015-008  History job\nBranch: factory/j-20261015-008-history-job\n\nNo history.";
  assert.equal(B.formatJobHistory(historyJob([])), expected);
  const { history, ...noHistory } = historyJob([]);
  assert.equal(B.formatJobHistory(noHistory), expected);
});
