import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
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

// ---------- export ----------

test("exportFolderName removes each forbidden filename character", () => {
  for (const c of ["<", ">", ":", '"', "/", "\\", "|", "?", "*"]) {
    assert.equal(B.exportFolderName(`a${c}b`, "j-1"), "ab", `char ${JSON.stringify(c)}`);
  }
});

test("exportFolderName removes control chars and Obsidian link breakers", () => {
  assert.equal(B.exportFolderName("a\u0000b\u001fc\u007fd", "j-1"), "abcd");
  assert.equal(B.exportFolderName("a\tb\nc", "j-1"), "abc");
  assert.equal(B.exportFolderName("#tag ^block [[link]]", "j-1"), "tag block link");
});

test("exportFolderName collapses whitespace, trims, and strips trailing dots and spaces", () => {
  assert.equal(B.exportFolderName("  Export   jobs  ", "j-1"), "Export jobs");
  assert.equal(B.exportFolderName("Done... . ", "j-1"), "Done");
  assert.equal(B.exportFolderName("..", "j-1"), "j-1");
  assert.equal(B.exportFolderName("../../etc", "j-1"), "....etc");
  assert.equal(B.exportFolderName("..\\..\\etc", "j-1"), "....etc");
});

test("exportFolderName suffixes Windows reserved names, case-insensitive, with extensions", () => {
  assert.equal(B.exportFolderName("CON", "j-1"), "CON_");
  assert.equal(B.exportFolderName("prn", "j-1"), "prn_");
  assert.equal(B.exportFolderName("Aux", "j-1"), "Aux_");
  assert.equal(B.exportFolderName("nul", "j-1"), "nul_");
  assert.equal(B.exportFolderName("Com1", "j-1"), "Com1_");
  assert.equal(B.exportFolderName("lpt9", "j-1"), "lpt9_");
  assert.equal(B.exportFolderName("con.txt", "j-1"), "con_.txt");
  assert.equal(B.exportFolderName("aux.", "j-1"), "aux_");
  assert.equal(B.exportFolderName("console", "j-1"), "console");
  assert.equal(B.exportFolderName("COM0", "j-1"), "COM0");
});

test("exportFolderName suffixes names that would collide with a copied record", () => {
  assert.equal(B.exportFolderName("Spec", "j-1"), "Spec_");
  assert.equal(B.exportFolderName("request", "j-1"), "request_");
  assert.equal(B.exportFolderName("BUILD", "j-1"), "BUILD_");
  assert.equal(B.exportFolderName("approval", "j-1"), "approval_");
  assert.equal(B.exportFolderName("Specs", "j-1"), "Specs");
});

test("exportFolderName caps at 100 chars, then trims trailing dots and spaces", () => {
  assert.equal(B.exportFolderName("x".repeat(150), "j-1"), "x".repeat(100));
  assert.equal(B.exportFolderName(`${"y".repeat(98)}. z`, "j-1"), "y".repeat(98));
});

test("exportFolderName falls back to the id when nothing is left", () => {
  assert.equal(B.exportFolderName("", "j-1"), "j-1");
  assert.equal(B.exportFolderName("???", "j-1"), "j-1");
  assert.equal(B.exportFolderName(" . ", "j-1"), "j-1");
  assert.equal(B.exportFolderName(undefined, "j-1"), "j-1");
});

test("chooseExportFolder: free, owned by same id, owned by another id, foreign folder", () => {
  assert.equal(B.chooseExportFolder("Title", "j-1", new Map()), "Title");
  assert.equal(B.chooseExportFolder("Title", "j-1", new Map([["Title", "j-1"]])), "Title");
  assert.equal(B.chooseExportFolder("Title", "j-1", new Map([["Title", "j-2"]])), "Title (j-1)");
  assert.equal(B.chooseExportFolder("Title", "j-1", new Map([["Title", null]])), "Title (j-1)");
  assert.equal(B.chooseExportFolder("Title", "j-1", new Map([["Other", "j-2"]])), "Title");
});

test("parseExportOwner reads factory-job from leading frontmatter only", () => {
  assert.equal(B.parseExportOwner("---\nfactory-job: j-1\ntitle: x\n---\n# x\n"), "j-1");
  assert.equal(B.parseExportOwner("---\r\ntitle: x\r\nfactory-job: \"j-2\"\r\n---\r\n"), "j-2");
  assert.equal(B.parseExportOwner("---\ntitle: x\n---\nfactory-job: j-1\n"), null);
  assert.equal(B.parseExportOwner("# Note\n\nfactory-job: j-1\n"), null);
  assert.equal(B.parseExportOwner("\n---\nfactory-job: j-1\n---\n"), null);
  assert.equal(B.parseExportOwner(""), null);
});

function mergedJob(id, ats, stage = "merged") {
  return {
    id,
    title: id,
    stage,
    history: [{ stage: "queued", at: "2026-01-01T00:00:00.000Z", note: "" }, ...ats.map((at) => ({ stage: "merged", at, note: "" }))],
  };
}

test("latestMergedJob: none, picks the latest merged entry, ignores non-merged jobs", () => {
  assert.equal(B.latestMergedJob(B.emptyBoard()), null);
  assert.equal(B.latestMergedJob({ jobs: [mergedJob("j-1", [], "review")] }), null);
  const board = {
    jobs: [
      mergedJob("j-1", ["2026-03-01T00:00:00.000Z"]),
      // Out-of-order history: the later merged entry comes first.
      mergedJob("j-2", ["2026-05-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z"]),
      mergedJob("j-3", ["2026-04-01T00:00:00.000Z"]),
      // Not in "merged" now, so ignored even with a later merged entry.
      mergedJob("j-4", ["2026-09-01T00:00:00.000Z"], "failed"),
    ],
  };
  assert.equal(B.latestMergedJob(board).id, "j-2");
});

function exportJob() {
  return {
    id: "j-20261015-011",
    title: "Export jobs",
    stage: "merged",
    branch: "factory/j-20261015-011-export-jobs",
    risk: { level: "high", reasons: ["sensitive paths: factory/config.json"] },
    verdicts: { "code-reviewer": "pass", "security-reviewer": "changes" },
    history: [
      { stage: "spec", at: "2026-10-15T10:00:00.000Z", note: "a | b\nc" },
      { stage: "queued", at: "2026-10-15T09:00:00.000Z", note: "created from cli" },
      { stage: "merged", at: "2026-10-15T11:00:00.000Z", note: "abc123" },
    ],
  };
}

test("renderExportIndex: frontmatter, heading, fields, risk and verdicts", () => {
  const md = B.renderExportIndex(exportJob(), "Export jobs", []);
  assert.ok(md.startsWith("---\nfactory-job: j-20261015-011\n"));
  assert.equal(B.parseExportOwner(md), "j-20261015-011");
  for (const s of [
    'title: "Export jobs"',
    "stage: merged",
    'branch: "factory/j-20261015-011-export-jobs"',
    "risk: high",
    "\n# Export jobs\n",
    "- Id: j-20261015-011",
    "- Title: Export jobs",
    "- Stage: merged",
    "- Branch: factory/j-20261015-011-export-jobs",
    "- Level: high",
    "- Reason: sensitive paths: factory/config.json",
    "- code-reviewer: pass",
    "- security-reviewer: changes",
  ]) assert.ok(md.includes(s), `missing ${JSON.stringify(s)}`);
});

test("renderExportIndex: not assessed risk and none verdicts", () => {
  const job = { ...exportJob(), risk: null, verdicts: {} };
  const md = B.renderExportIndex(job, "Export jobs", []);
  assert.ok(md.includes("risk: not assessed"));
  assert.ok(md.includes("## Risk\n\n- not assessed\n"));
  assert.ok(md.includes("## Verdicts\n\n- none\n"));
});

test("renderExportIndex: history table oldest first, pipes escaped, newlines flattened", () => {
  const md = B.renderExportIndex(exportJob(), "Export jobs", []);
  assert.ok(md.includes("| At | Stage | Note |\n|---|---|---|\n"));
  const rows = md.split("\n").filter((l) => l.startsWith("| 2026"));
  assert.deepEqual(rows, [
    "| 2026-10-15T09:00:00.000Z | queued | created from cli |",
    "| 2026-10-15T10:00:00.000Z | spec | a \\| b c |",
    "| 2026-10-15T11:00:00.000Z | merged | abc123 |",
  ]);
});

test("renderExportIndex: one link per given file, in order, nothing else", () => {
  const files = ["request.md", "spec.md", "reviews/code-reviewer.md", "approval.md"];
  const md = B.renderExportIndex(exportJob(), "Export jobs", files);
  const links = md.split("\n").filter((l) => l.includes("[["));
  assert.deepEqual(links, [
    "- [[Export jobs/request|Request]]",
    "- [[Export jobs/spec|Spec]]",
    "- [[Export jobs/reviews/code-reviewer|Review: code-reviewer]]",
    "- [[Export jobs/approval|Approval]]",
  ]);
  assert.ok(!md.includes("/build"));
});

test("renderExportIndex does not mutate the job", () => {
  const job = exportJob();
  const before = JSON.stringify(job);
  B.renderExportIndex(job, "Export jobs", ["spec.md"]);
  assert.equal(JSON.stringify(job), before);
});

test("exportDir: off when absent, null or blank; relative resolves against root", () => {
  const root = path.resolve("repo-root");
  assert.equal(B.exportDir({}, root), null);
  assert.equal(B.exportDir({ export: {} }, root), null);
  assert.equal(B.exportDir({ export: { obsidianDir: null } }, root), null);
  assert.equal(B.exportDir({ export: { obsidianDir: "" } }, root), null);
  assert.equal(B.exportDir({ export: { obsidianDir: "  " } }, root), null);
  assert.equal(B.exportDir({ export: { obsidianDir: "vault" } }, root), path.join(root, "vault"));
  const abs = path.resolve("elsewhere", "vault");
  assert.equal(B.exportDir({ export: { obsidianDir: abs } }, root), abs);
});

// ---------- parallel jobs ----------

// A board with one job per stage; createdAt runs in creation order unless overridden.
function boardWithStages(stages) {
  const board = B.emptyBoard();
  stages.forEach((stage, i) => {
    const at = new Date(NOW.getTime() + i * 1000).toISOString();
    board.jobs.push({ id: `j-20261015-${String(i + 1).padStart(3, "0")}`, stage, createdAt: at, history: [{ stage, at }] });
  });
  return board;
}

test("ACTIVE_STAGES holds the seven slot-using stages and nothing else", () => {
  assert.deepEqual(B.ACTIVE_STAGES, ["queued", "spec", "spec-approval", "build", "review", "rework", "approve"]);
  for (const s of B.ACTIVE_STAGES) assert.ok(B.STAGES.includes(s), s);
  for (const s of ["needs-human", "merged", "failed"]) assert.ok(!B.ACTIVE_STAGES.includes(s), s);
});

test("worktreeDir/worktreePath: default, relative, absolute and Windows-style values", () => {
  const root = path.resolve("repo-root");
  const id = "j-20261015-012";
  assert.equal(B.worktreeDir({}, root), path.join(root, ".worktrees"));
  assert.equal(B.worktreeDir(undefined, root), path.join(root, ".worktrees"));
  assert.equal(B.worktreeDir({ parallel: { worktreeDir: "" } }, root), path.join(root, ".worktrees"));
  assert.equal(B.worktreePath({}, root, id), path.join(root, ".worktrees", id));
  assert.equal(B.worktreePath({ parallel: { worktreeDir: "trees" } }, root, id), path.join(root, "trees", id));
  const abs = path.resolve("elsewhere", "wt");
  assert.equal(B.worktreePath({ parallel: { worktreeDir: abs } }, root, id), path.join(abs, id));
  const win = { parallel: { worktreeDir: "build\\trees" } };
  assert.equal(B.worktreeDir(win, root), path.resolve(root, "build\\trees"));
  if (process.platform === "win32") assert.equal(B.worktreePath(win, root, id), path.join(root, "build", "trees", id));
});

test("maxJobs: 1 when unset, integers >= 1 pass, anything else throws", () => {
  assert.equal(B.maxJobs({}), 1);
  assert.equal(B.maxJobs(undefined), 1);
  assert.equal(B.maxJobs({ parallel: {} }), 1);
  assert.equal(B.maxJobs({ parallel: { maxJobs: 1 } }), 1);
  assert.equal(B.maxJobs({ parallel: { maxJobs: 3 } }), 3);
  for (const bad of [0, -1, "2", 1.5, true, Number.NaN]) {
    assert.throws(() => B.maxJobs({ parallel: { maxJobs: bad } }), /config\.parallel\.maxJobs must be an integer >= 1/, String(bad));
  }
});

test("capacity counts active jobs oldest first; needs-human and terminal use no slot", () => {
  const board = boardWithStages(["build", "needs-human", "merged", "failed", "queued", "review"]);
  // Make the review job the oldest so order comes from createdAt, not board order.
  board.jobs[5].createdAt = "2000-01-01T00:00:00.000Z";
  assert.deepEqual(B.capacity(board, { parallel: { maxJobs: 4 } }), {
    active: ["j-20261015-006", "j-20261015-001", "j-20261015-005"],
    max: 4,
    free: 1,
  });
  assert.deepEqual(B.capacity(board, {}), { active: ["j-20261015-006", "j-20261015-001", "j-20261015-005"], max: 1, free: 0 });
  assert.deepEqual(B.capacity(B.emptyBoard(), {}), { active: [], max: 1, free: 1 });
  assert.throws(() => B.capacity(board, { parallel: { maxJobs: 0 } }), /maxJobs/);
});

test("preflightErrors tolerates only in-flight factory records", () => {
  // 001 build (active), 002 merged, 003 needs-human
  const board = boardWithStages(["build", "merged", "needs-human"]);
  const ok = [
    "factory/board.json",
    "factory/backlog.md",
    "factory/jobs/j-20261015-001/spec.md",
    "factory/jobs/j-20261015-001/reviews/code-reviewer.md",
    "factory/jobs/j-20261015-001/",
    "factory\\jobs\\j-20261015-001\\build.md",
    "factory\\board.json",
  ];
  assert.deepEqual(B.preflightErrors(ok, board), []);
  const bad = [
    "factory/jobs/j-20261015-002/approval.md",
    "factory/jobs/j-20261015-003/build.md",
    "factory/jobs/j-20261015-0011/x.md",
    "factory/config.json",
    "src/x.js",
    "src\\x.js",
    ".worktrees/j-20261015-001/",
    ".worktrees/j-20261015-001/src/x.js",
    "factory/jobs/j-20261015-001.md",
  ];
  assert.deepEqual(B.preflightErrors([...ok, ...bad], board), bad);
});

test("preflightErrors flags board.json and backlog.md when no job is active", () => {
  const board = boardWithStages(["merged", "needs-human", "failed"]);
  const dirty = ["factory/board.json", "factory/backlog.md", "factory/jobs/j-20261015-002/build.md"];
  assert.deepEqual(B.preflightErrors(dirty, board), dirty);
  assert.deepEqual(B.preflightErrors(["factory/board.json"], B.emptyBoard()), ["factory/board.json"]);
  assert.deepEqual(B.preflightErrors([], B.emptyBoard()), []);
});

test("parseGitStatusZ returns every path, both sides of a rename", () => {
  const z = " M src/a.js\0?? factory/jobs/j-1/spec.md\0R  new name.js\0old name.js\0C  copy.js\0orig.js\0 D gone.js\0";
  assert.deepEqual(B.parseGitStatusZ(z), [
    "src/a.js",
    "factory/jobs/j-1/spec.md",
    "new name.js",
    "old name.js",
    "copy.js",
    "orig.js",
    "gone.js",
  ]);
  assert.deepEqual(B.parseGitStatusZ(""), []);
});

test("validateBoard reports a bad parallel.maxJobs; configs without parallel stay valid", () => {
  const { board } = freshJob();
  assert.deepEqual(B.validateBoard(board, config), []);
  assert.deepEqual(B.validateBoard(board, { ...config, parallel: { maxJobs: 2 } }), []);
  for (const bad of [0, "2", 1.5]) {
    assert.deepEqual(B.validateBoard(board, { ...config, parallel: { maxJobs: bad } }), ["config.parallel.maxJobs must be an integer >= 1"]);
  }
});
