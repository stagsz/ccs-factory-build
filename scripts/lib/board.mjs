// CCS Factory Build - board library.
// The deterministic core of the factory: job state machine, verdict parsing,
// review aggregation, risk assessment and backlog handling.
// Only the orchestrator writes factory/board.json, and it does so through this module.

import fs from "node:fs";
import path from "node:path";

export const STAGES = [
  "queued",        // job created, nothing done yet
  "spec",          // spec-writer is drafting
  "spec-approval", // optional human gate: approve the spec before code exists
  "build",         // builder is implementing on the feature branch
  "review",        // reviewers run in parallel
  "rework",        // builder resumed with review feedback
  "approve",       // approver decides merge or escalate
  "merged",        // terminal: merged to main (or PR opened, depending on mergeMode)
  "needs-human",   // parked for a human decision
  "failed",        // terminal: stopped with an error
];

export const TERMINAL = new Set(["merged", "failed"]);

export const TRANSITIONS = {
  queued: ["spec", "failed"],
  spec: ["spec-approval", "build", "failed"],
  "spec-approval": ["build", "spec", "failed"],
  build: ["review", "failed"],
  review: ["approve", "rework", "needs-human", "failed"],
  rework: ["review", "needs-human", "failed"],
  approve: ["merged", "needs-human", "failed"],
  "needs-human": ["merged", "rework", "spec", "failed"],
  merged: [],
  failed: [],
};

export const VERDICTS = ["pass", "changes", "block"];

// ---------- paths ----------

export function paths(root = process.cwd()) {
  const factory = path.join(root, "factory");
  return {
    root,
    factory,
    board: path.join(factory, "board.json"),
    config: path.join(factory, "config.json"),
    backlog: path.join(factory, "backlog.md"),
    jobs: path.join(factory, "jobs"),
    job: (id) => path.join(factory, "jobs", id),
  };
}

// ---------- io ----------

export function emptyBoard() {
  return { version: 1, updatedAt: null, jobs: [] };
}

export function loadConfig(root) {
  const p = paths(root).config;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function loadBoard(root) {
  const p = paths(root).board;
  if (!fs.existsSync(p)) return emptyBoard();
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

// Write via temp file + rename so a crash never leaves a half-written board.
export function saveBoard(board, root, now = new Date()) {
  const p = paths(root).board;
  board.updatedAt = now.toISOString();
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(board, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, p);
  return board;
}

// ---------- jobs ----------

export function slugify(text, max = 40) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "") || "job";
}

export function nextJobId(board, now = new Date()) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `j-${day}-`;
  const n = board.jobs
    .map((j) => j.id)
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.slice(prefix.length), 10))
    .filter(Number.isFinite);
  const seq = (n.length ? Math.max(...n) : 0) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export function createJob(board, { title, request, source = "cli" }, config, now = new Date()) {
  if (!title || !title.trim()) throw new Error("A job needs a title.");
  const id = nextJobId(board, now);
  const prefix = config?.repo?.branchPrefix ?? "factory/";
  const at = now.toISOString();
  const job = {
    id,
    title: title.trim(),
    request: (request ?? title).trim(),
    source,
    stage: "queued",
    branch: `${prefix}${id}-${slugify(title)}`,
    rework: 0,
    risk: null,
    verdicts: {},
    createdAt: at,
    updatedAt: at,
    history: [{ stage: "queued", at, note: `created from ${source}` }],
  };
  board.jobs.push(job);
  return job;
}

export function findJob(board, id) {
  const job = board.jobs.find((j) => j.id === id);
  if (!job) throw new Error(`No job with id ${id}.`);
  return job;
}

export function canTransition(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

export function setStage(board, id, to, note = "", now = new Date()) {
  if (!STAGES.includes(to)) throw new Error(`Unknown stage "${to}". Stages: ${STAGES.join(", ")}`);
  const job = findJob(board, id);
  if (!canTransition(job.stage, to)) {
    throw new Error(`Job ${id} cannot move from "${job.stage}" to "${to}". Allowed: ${TRANSITIONS[job.stage].join(", ") || "none (terminal)"}`);
  }
  const at = now.toISOString();
  job.stage = to;
  job.updatedAt = at;
  if (to === "review") job.verdicts = {}; // every review round starts clean
  job.history.push({ stage: to, at, note });
  return job;
}

export function recordVerdict(board, id, reviewer, verdict, config, now = new Date()) {
  if (!VERDICTS.includes(verdict)) throw new Error(`Verdict must be one of ${VERDICTS.join(", ")}.`);
  const known = config?.reviewers ?? [];
  if (known.length && !known.includes(reviewer)) {
    throw new Error(`Unknown reviewer "${reviewer}". Configured: ${known.join(", ")}`);
  }
  const job = findJob(board, id);
  if (job.stage !== "review") throw new Error(`Job ${id} is in "${job.stage}", verdicts are only accepted in "review".`);
  job.verdicts[reviewer] = verdict;
  job.updatedAt = now.toISOString();
  return job;
}

// Decide what happens after a review round.
// Returns "pending" | "approve" | "rework" | "needs-human".
export function decideReview(job, config) {
  const reviewers = config.reviewers;
  const missing = reviewers.filter((r) => !(r in job.verdicts));
  if (missing.length) return "pending";
  const values = reviewers.map((r) => job.verdicts[r]);
  if (values.includes("block")) return "needs-human";
  if (values.includes("changes")) {
    return job.rework >= config.maxReworkCycles ? "needs-human" : "rework";
  }
  return "approve";
}

// Move to rework and count the cycle. Escalates when the budget is spent.
export function startRework(board, id, config, note = "", now = new Date()) {
  const job = findJob(board, id);
  if (job.stage === "needs-human") {
    // A human sending the job back grants a fresh rework budget.
    setStage(board, id, "rework", `human rework. ${note}`.trim(), now);
    job.rework = 1;
    return job;
  }
  if (job.rework >= config.maxReworkCycles) {
    return setStage(board, id, "needs-human", `rework budget (${config.maxReworkCycles}) spent. ${note}`.trim(), now);
  }
  setStage(board, id, "rework", note, now);
  job.rework += 1;
  return job;
}

// ---------- agent output parsing ----------

// Reviews end with a line like "VERDICT: pass". Last match wins.
export function parseVerdict(text) {
  const m = [...String(text).matchAll(/^\s*VERDICT:\s*(pass|changes|block)\s*$/gim)];
  return m.length ? m[m.length - 1][1].toLowerCase() : null;
}

// Approval files carry "RISK: low|high" and "DECISION: merge|escalate".
export function parseApproval(text) {
  const risk = /^\s*RISK:\s*(low|high)\s*$/im.exec(text)?.[1]?.toLowerCase() ?? null;
  const decision = /^\s*DECISION:\s*(merge|escalate)\s*$/im.exec(text)?.[1]?.toLowerCase() ?? null;
  return { risk, decision };
}

// ---------- risk ----------

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

// Deterministic floor under the approver's judgement: touching a sensitive path
// or too many files always escalates, whatever the approver says.
export function assessRisk(changedFiles, config) {
  const rules = config.risk ?? {};
  const patterns = (rules.alwaysEscalatePaths ?? []).map(globToRegExp);
  const norm = changedFiles.map((f) => f.replace(/\\/g, "/"));
  const hits = norm.filter((f) => patterns.some((re) => re.test(f)));
  const reasons = [];
  if (hits.length) reasons.push(`sensitive paths: ${hits.join(", ")}`);
  if (rules.maxFilesForLowRisk != null && norm.length > rules.maxFilesForLowRisk) {
    reasons.push(`${norm.length} files changed (limit ${rules.maxFilesForLowRisk})`);
  }
  return { level: reasons.length ? "high" : "low", reasons };
}

// Final call: merge only if approver says merge, risk is low, and the floor agrees.
export function decideMerge(approval, riskFloor) {
  if (approval.decision !== "merge") return { action: "needs-human", why: "approver escalated" };
  if (approval.risk !== "low") return { action: "needs-human", why: "approver rated risk high" };
  if (riskFloor.level !== "low") return { action: "needs-human", why: riskFloor.reasons.join("; ") };
  return { action: "merged", why: "low risk, approved" };
}

// ---------- backlog ----------

// Backlog items are markdown checkboxes: "- [ ] Title :: optional longer request"
export function nextBacklogItem(markdown) {
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*[-*]\s+)\[ \]\s+(.+?)\s*$/.exec(lines[i]);
    if (m) {
      const [title, request] = m[2].split(/\s+::\s+/);
      return { index: i, prefix: m[1], title: title.trim(), request: (request ?? title).trim() };
    }
  }
  return null;
}

export function markBacklogItem(markdown, item, jobId) {
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);
  lines[item.index] = lines[item.index].replace("[ ]", "[~]") + ` (${jobId})`;
  return lines.join(eol);
}

// ---------- validation ----------

export function validateBoard(board, config) {
  const errors = [];
  if (board.version !== 1) errors.push("board.version must be 1");
  if (!Array.isArray(board.jobs)) return [...errors, "board.jobs must be an array"];
  const ids = new Set();
  for (const j of board.jobs) {
    if (ids.has(j.id)) errors.push(`duplicate job id ${j.id}`);
    ids.add(j.id);
    if (!STAGES.includes(j.stage)) errors.push(`${j.id}: unknown stage ${j.stage}`);
    if (!Array.isArray(j.history) || !j.history.length) errors.push(`${j.id}: empty history`);
    if (j.rework > (config?.maxReworkCycles ?? Infinity)) errors.push(`${j.id}: rework ${j.rework} exceeds max`);
    for (const [r, v] of Object.entries(j.verdicts ?? {})) {
      if (!VERDICTS.includes(v)) errors.push(`${j.id}: bad verdict ${r}=${v}`);
    }
  }
  return errors;
}

// ---------- listing ----------

// One line per job (id, stage, rework, title), oldest first. Pure: sorts a copy.
export function formatJobList(board) {
  if (!board.jobs.length) return "No jobs.";
  const byAge = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
  const rows = [...board.jobs].sort(byAge).map((j) => [j.id, j.stage, String(j.rework), j.title]);
  const table = [["ID", "STAGE", "REWORK", "TITLE"], ...rows];
  const widths = [0, 1, 2].map((c) => Math.max(...table.map((r) => r[c].length)));
  return table.map((r) => [...widths.map((w, c) => r[c].padEnd(w)), r[3]].join("  ")).join("\n");
}
