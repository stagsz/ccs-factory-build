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
  "needs-human",   // parked for a human decision
  "merged",        // terminal: merged to main (or PR opened, depending on mergeMode)
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
// Markers: "[ ]" queued, "[~]" taken by a job (line ends with "(<job-id>)"),
// "[x]" job merged, "[!]" job failed. Only "[ ]" lines are picked up here.
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

// Close the "[~]" line of a finished job: mark "x" (merged) or "!" (failed).
// Only "[~]" lines whose trimmed end is exactly "(<jobId>)" change, and only their
// checkbox. Returns the input string itself when nothing matches.
export function closeBacklogItem(markdown, jobId, mark) {
  if (mark !== "x" && mark !== "!") throw new Error(`Backlog mark must be "x" or "!", got ${JSON.stringify(mark)}.`);
  const eol = markdown.includes("\r\n") ? "\r\n" : "\n";
  const lines = markdown.split(/\r?\n/);
  const suffix = `(${jobId})`;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*[-*]\s+)\[~\]/.exec(lines[i]);
    if (!m || !lines[i].trimEnd().endsWith(suffix)) continue;
    lines[i] = `${m[1]}[${mark}]${lines[i].slice(m[0].length)}`;
    changed = true;
  }
  return changed ? lines.join(eol) : markdown;
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
  try {
    maxJobs(config);
  } catch {
    errors.push(MAX_JOBS_ERROR);
  }
  return errors;
}

// ---------- parallel jobs ----------

// Stages that hold a slot under parallel.maxJobs. needs-human and the terminal
// stages do not: a parked job waits for a person, not for the orchestrator.
export const ACTIVE_STAGES = ["queued", "spec", "spec-approval", "build", "review", "rework", "approve"];

const MAX_JOBS_ERROR = "config.parallel.maxJobs must be an integer >= 1";

// The folder that holds every job's worktree. Relative values resolve against root.
export function worktreeDir(config, root) {
  return path.resolve(root, config?.parallel?.worktreeDir || ".worktrees");
}

// One job's worktree, named by id (not branch slug) to keep Windows paths short.
export function worktreePath(config, root, id) {
  return path.join(worktreeDir(config, root), id);
}

// The job cap. Unset (absent, undefined or null) means 1.
export function maxJobs(config) {
  const v = config?.parallel?.maxJobs;
  if (v === undefined || v === null) return 1;
  if (!Number.isInteger(v) || v < 1) throw new Error(`${MAX_JOBS_ERROR}, got ${JSON.stringify(v)}.`);
  return v;
}

// Active job ids (oldest first), the cap and the free slots (never below 0).
export function capacity(board, config) {
  const byAge = (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0);
  const active = (board.jobs ?? [])
    .filter((j) => ACTIVE_STAGES.includes(j.stage))
    .sort(byAge)
    .map((j) => j.id);
  const max = maxJobs(config);
  return { active, max, free: Math.max(0, max - active.length) };
}

// Paths out of `git status --porcelain=v1 -z`. A rename or copy entry carries a
// second NUL-separated field (the source path); both paths are returned.
export function parseGitStatusZ(text) {
  const fields = String(text ?? "").split("\0");
  const out = [];
  for (let i = 0; i < fields.length; i++) {
    const entry = fields[i];
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    out.push(entry.slice(3));
    if (/[RC]/.test(xy) && i + 1 < fields.length && fields[i + 1]) out.push(fields[++i]);
  }
  return out;
}

// The dirty paths the pre-flight check must refuse. Only factory/board.json,
// factory/backlog.md and factory/jobs/<id>/** of active jobs are tolerated, and
// only while at least one job is active. Accepts "\" and "/" separators.
export function preflightErrors(dirtyPaths, board) {
  const active = new Set((board?.jobs ?? []).filter((j) => ACTIVE_STAGES.includes(j.stage)).map((j) => j.id));
  const allowed = (p) => {
    if (!active.size) return false;
    const norm = String(p).replace(/\\/g, "/").replace(/\/+$/, "");
    if (norm === "factory/board.json" || norm === "factory/backlog.md") return true;
    const m = /^factory\/jobs\/([^/]+)(?:\/.*)?$/.exec(norm);
    return Boolean(m && active.has(m[1]));
  };
  return dirtyPaths.filter((p) => !allowed(p));
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

// One job's stage history (at, stage, note), oldest first. Pure: sorts a copy.
export function formatJobHistory(job) {
  const head = [`${job.id}  ${job.title}`, `Branch: ${job.branch}`, ""];
  const history = job.history ?? [];
  if (!history.length) return [...head, "No history."].join("\n");
  const byAt = (a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  const rows = [...history].sort(byAt).map((h) => [String(h.at), String(h.stage), String(h.note ?? "")]);
  const table = [["AT", "STAGE", "NOTE"], ...rows];
  const widths = [0, 1].map((c) => Math.max(...table.map((r) => r[c].length)));
  const lines = table.map((r) => [...widths.map((w, c) => r[c].padEnd(w)), r[2]].join("  ").trimEnd());
  return [...head, ...lines].join("\n");
}

// ---------- export ----------

// The folder export.obsidianDir points at, or null when the feature is off
// (export, obsidianDir absent, null or blank). Relative paths resolve against root.
export function exportDir(config, root) {
  const dir = config?.export?.obsidianDir;
  if (typeof dir !== "string" || !dir.trim()) return null;
  return path.resolve(root, dir);
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
// Top-level records copied into the export. The index note is <folder>.md, so a
// folder named after one of them would overwrite that record with the index.
const EXPORT_RECORD_STEMS = /^(request|spec|build|approval)$/i;

// A job title made safe as one folder name on Windows, Linux and in Obsidian links.
export function exportFolderName(title, id) {
  let name = String(title ?? "")
    .replace(/[<>:"/\\|?*#^[\]\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .replace(/[. ]+$/, "");
  if (!name) return id;
  // "con.txt" is as reserved as "con": put the "_" on the stem so the result is safe.
  const reserved = WINDOWS_RESERVED.exec(name);
  if (reserved) name = `${reserved[1]}_${reserved[2] ?? ""}`;
  else if (EXPORT_RECORD_STEMS.test(name)) name += "_";
  return name;
}

// owners: Map of existing folder name -> owning job id (null: not a factory export).
export function chooseExportFolder(base, id, owners) {
  if (!owners.has(base) || owners.get(base) === id) return base;
  return `${base} (${id})`;
}

// The factory-job value from an index note's leading YAML frontmatter, or null.
export function parseExportOwner(text) {
  const fm = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(String(text ?? ""));
  if (!fm) return null;
  const line = /^factory-job:[ \t]*(.*?)[ \t]*\r?$/m.exec(fm[1]);
  if (!line) return null;
  const value = line[1].replace(/^(["'])(.*)\1$/, "$2").trim();
  return value || null;
}

// The merged job with the latest "merged" history entry, or null.
export function latestMergedJob(board) {
  let best = null;
  let bestAt = null;
  for (const job of board.jobs ?? []) {
    if (job.stage !== "merged") continue;
    const at = (job.history ?? [])
      .filter((h) => h.stage === "merged")
      .reduce((max, h) => (String(h.at) > max ? String(h.at) : max), "");
    if (best === null || at > bestAt) {
      best = job;
      bestAt = at;
    }
  }
  return best;
}

const oneLine = (s) => String(s ?? "").replace(/\r\n|\r|\n/g, " ");
const cell = (s) => oneLine(s).replace(/\|/g, "\\|");

function exportLinkLabel(file) {
  const stem = file.replace(/\.md$/i, "");
  const fixed = { request: "Request", spec: "Spec", build: "Build report", approval: "Approval" };
  if (Object.hasOwn(fixed, stem)) return fixed[stem];
  if (stem.startsWith("reviews/")) return `Review: ${stem.slice("reviews/".length)}`;
  return stem;
}

// The index note of an exported job. files: posix paths relative to the export folder.
// Pure: sorts a copy of the history.
export function renderExportIndex(job, folder, files) {
  const risk = job.risk ? job.risk.level : "not assessed";
  const reasons = job.risk?.reasons ?? [];
  const verdicts = Object.entries(job.verdicts ?? {});
  const byAt = (a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);
  const history = [...(job.history ?? [])].sort(byAt);
  const lines = [
    "---",
    `factory-job: ${job.id}`,
    `title: ${JSON.stringify(oneLine(job.title))}`,
    `stage: ${job.stage}`,
    `branch: ${JSON.stringify(oneLine(job.branch))}`,
    `risk: ${risk}`,
    "---",
    "",
    `# ${oneLine(job.title)}`,
    "",
    `- Id: ${job.id}`,
    `- Title: ${oneLine(job.title)}`,
    `- Stage: ${job.stage}`,
    `- Branch: ${oneLine(job.branch)}`,
    "",
    "## Risk",
    "",
    job.risk ? `- Level: ${risk}` : "- not assessed",
    ...(job.risk ? (reasons.length ? reasons.map((r) => `- Reason: ${oneLine(r)}`) : ["- Reasons: none"]) : []),
    "",
    "## Verdicts",
    "",
    ...(verdicts.length ? verdicts.map(([r, v]) => `- ${r}: ${v}`) : ["- none"]),
    "",
    "## History",
    "",
    "| At | Stage | Note |",
    "|---|---|---|",
    ...history.map((h) => `| ${cell(h.at)} | ${cell(h.stage)} | ${cell(h.note)} |`),
    "",
    "## Files",
    "",
    ...(files.length
      ? files.map((f) => `- [[${folder}/${f.replace(/\.md$/i, "")}|${exportLinkLabel(f)}]]`)
      : ["- none"]),
  ];
  return lines.join("\n") + "\n";
}
