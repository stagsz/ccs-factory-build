#!/usr/bin/env node
// CCS Factory Build - board CLI.
// The orchestrator calls this for every write to factory/board.json.
// Agents never call it; they write only their own file under factory/jobs/<id>/.
//
// Usage: see USAGE below, or run `node scripts/board.mjs help`.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as B from "./lib/board.mjs";

const USAGE = `Usage: node scripts/board.mjs <command> [args]
  init                                   create factory/board.json and factory/jobs/
  new "<title>" [--request "<text>"]     create a job, prints its id
  next                                   take the next "- [ ]" item from backlog.md
  stage <id> <stage> [--note "<text>"]   move a job (transition rules enforced)
  verdict <id> <reviewer>                read reviews/<reviewer>.md and record its VERDICT
  decide-review <id>                     print approve | rework | needs-human | pending
  rework <id> [--note "<text>"]          start a rework cycle (escalates when budget spent)
  risk <id> <file> [<file> ...]          deterministic risk floor for the changed files
  decide-merge <id> <file> [...]         read approval.md + risk floor, print merged | needs-human
  show [<id>]                            print the board or one job as JSON
  list                                   print one line per job (id, stage, rework, title)
  history <id>                           print one job's stage history, oldest first
  export [<id>]                          export a merged job (default: the most recently merged) to export.obsidianDir
  validate                               check board.json integrity
  worktree <id>                          print the absolute path of a job's git worktree
  slots                                  print active jobs against parallel.maxJobs and the free slots
  preflight                              check git status: only in-flight jobs' factory records may be dirty
  help (also --help, -h)                 print this usage`;

const HELP = new Set(["help", "--help", "-h"]);

const root = process.env.FACTORY_ROOT ? path.resolve(process.env.FACTORY_ROOT) : process.cwd();
const P = B.paths(root);

function flag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
}

function readJobFile(id, rel) {
  const f = path.join(P.job(id), rel);
  if (!fs.existsSync(f)) throw new Error(`Missing ${path.relative(root, f)}. The agent has not written its output yet.`);
  return fs.readFileSync(f, "utf8");
}

function out(v) {
  process.stdout.write((typeof v === "string" ? v : JSON.stringify(v, null, 2)) + "\n");
}

function writeRequest(job) {
  fs.mkdirSync(path.join(P.job(job.id), "reviews"), { recursive: true });
  const md = `# ${job.title}\n\n- Job: ${job.id}\n- Branch: ${job.branch}\n- Source: ${job.source}\n- Created: ${job.createdAt}\n\n## Request\n\n${job.request}\n`;
  fs.writeFileSync(path.join(P.job(job.id), "request.md"), md, "utf8");
}

const commands = {
  init() {
    fs.mkdirSync(P.jobs, { recursive: true });
    if (!fs.existsSync(P.board)) B.saveBoard(B.emptyBoard(), root);
    out(`Board ready at ${path.relative(root, P.board)}`);
  },

  new(args) {
    const request = flag(args, "request");
    const title = args.join(" ");
    const config = B.loadConfig(root);
    const board = B.loadBoard(root);
    const job = B.createJob(board, { title, request, source: "cli" }, config);
    writeRequest(job);
    B.saveBoard(board, root);
    out(job.id);
  },

  next() {
    const md = fs.readFileSync(P.backlog, "utf8");
    const item = B.nextBacklogItem(md);
    if (!item) return out("Backlog is empty.");
    const config = B.loadConfig(root);
    const board = B.loadBoard(root);
    const job = B.createJob(board, { title: item.title, request: item.request, source: "backlog" }, config);
    writeRequest(job);
    B.saveBoard(board, root);
    fs.writeFileSync(P.backlog, B.markBacklogItem(md, item, job.id), "utf8");
    out(job.id);
  },

  stage([id, stage, ...rest]) {
    const note = flag(rest, "note") ?? "";
    const board = B.loadBoard(root);
    const job = B.setStage(board, id, stage, note);
    B.saveBoard(board, root);
    if (B.TERMINAL.has(job.stage) && job.source === "backlog" && fs.existsSync(P.backlog)) {
      const md = fs.readFileSync(P.backlog, "utf8");
      const closed = B.closeBacklogItem(md, job.id, job.stage === "merged" ? "x" : "!");
      if (closed !== md) fs.writeFileSync(P.backlog, closed, "utf8");
    }
    out(`${job.id} -> ${job.stage}`);
  },

  verdict([id, reviewer]) {
    const config = B.loadConfig(root);
    const verdict = B.parseVerdict(readJobFile(id, path.join("reviews", `${reviewer}.md`)));
    if (!verdict) throw new Error(`reviews/${reviewer}.md has no "VERDICT: pass|changes|block" line.`);
    const board = B.loadBoard(root);
    B.recordVerdict(board, id, reviewer, verdict, config);
    B.saveBoard(board, root);
    out(`${id} ${reviewer}: ${verdict}`);
  },

  "decide-review"([id]) {
    const config = B.loadConfig(root);
    const board = B.loadBoard(root);
    out(B.decideReview(B.findJob(board, id), config));
  },

  rework([id, ...rest]) {
    const note = flag(rest, "note") ?? "";
    const config = B.loadConfig(root);
    const board = B.loadBoard(root);
    const job = B.startRework(board, id, config, note);
    B.saveBoard(board, root);
    out(`${job.id} -> ${job.stage} (rework ${job.rework}/${config.maxReworkCycles})`);
  },

  risk([id, ...files]) {
    const config = B.loadConfig(root);
    const board = B.loadBoard(root);
    const job = B.findJob(board, id);
    const r = B.assessRisk(files, config);
    job.risk = r;
    B.saveBoard(board, root);
    out(r);
  },

  "decide-merge"([id, ...files]) {
    const config = B.loadConfig(root);
    const approval = B.parseApproval(readJobFile(id, "approval.md"));
    const floor = B.assessRisk(files, config);
    const board = B.loadBoard(root);
    B.findJob(board, id).risk = floor;
    B.saveBoard(board, root);
    out(B.decideMerge(approval, floor));
  },

  show([id]) {
    const board = B.loadBoard(root);
    out(id ? B.findJob(board, id) : board);
  },

  list() {
    out(B.formatJobList(B.loadBoard(root)));
  },

  history([id]) {
    if (!id) throw new Error("history needs a job id. Usage: node scripts/board.mjs history <id>");
    const board = B.loadBoard(root);
    out(B.formatJobHistory(B.findJob(board, id)));
  },

  export([id]) {
    const config = B.loadConfig(root);
    const vault = B.exportDir(config, root);
    if (!vault) throw new Error("Export is off: set export.obsidianDir in factory/config.json to your Obsidian vault folder.");
    if (!fs.existsSync(vault) || !fs.statSync(vault).isDirectory()) {
      throw new Error(`Export folder ${vault} does not exist. Create it, or fix export.obsidianDir in factory/config.json.`);
    }
    const board = B.loadBoard(root);
    const job = id ? B.findJob(board, id) : B.latestMergedJob(board);
    if (!job) throw new Error("No merged job to export.");
    if (job.stage !== "merged") {
      throw new Error(`Job ${job.id} is in "${job.stage}". Only merged jobs can be exported.`);
    }

    const base = B.exportFolderName(job.title, job.id);
    const owners = new Map();
    for (const name of [base, `${base} (${job.id})`]) {
      if (!fs.existsSync(path.join(vault, name))) continue;
      const note = path.join(vault, name, `${name}.md`);
      owners.set(name, fs.existsSync(note) ? B.parseExportOwner(fs.readFileSync(note, "utf8")) : null);
    }
    const folder = B.chooseExportFolder(base, job.id, owners);
    const target = path.resolve(vault, folder);
    const vaultRoot = path.resolve(vault);
    const prefix = vaultRoot.endsWith(path.sep) ? vaultRoot : vaultRoot + path.sep;
    if (!target.startsWith(prefix) || target.length === prefix.length) {
      throw new Error(`Refusing to export outside ${vaultRoot}.`);
    }
    if (owners.has(folder) && owners.get(folder) !== job.id && folder !== base) {
      throw new Error(`Export folder ${target} already exists and is not this job's export. Move or rename it, then retry.`);
    }

    const src = P.job(job.id);
    const files = ["request.md", "spec.md", "build.md"].filter((f) => fs.existsSync(path.join(src, f)));
    const reviewsDir = path.join(src, "reviews");
    if (fs.existsSync(reviewsDir)) {
      const reviews = fs
        .readdirSync(reviewsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && e.name.endsWith(".md"))
        .map((e) => e.name)
        .sort();
      files.push(...reviews.map((r) => `reviews/${r}`));
    }
    if (fs.existsSync(path.join(src, "approval.md"))) files.push("approval.md");

    fs.mkdirSync(target, { recursive: true });
    for (const rel of files) {
      const parts = rel.split("/");
      if (parts.length > 1) fs.mkdirSync(path.join(target, ...parts.slice(0, -1)), { recursive: true });
      fs.copyFileSync(path.join(src, ...parts), path.join(target, ...parts));
    }
    fs.writeFileSync(path.join(target, `${folder}.md`), B.renderExportIndex(job, folder, files), "utf8");
    out(target);
  },

  validate() {
    const config = B.loadConfig(root);
    const errors = B.validateBoard(B.loadBoard(root), config);
    if (errors.length) {
      out(errors.map((e) => `- ${e}`).join("\n"));
      process.exitCode = 1;
    } else out("Board is valid.");
  },

  worktree([id]) {
    if (!id) throw new Error("worktree needs a job id. Usage: node scripts/board.mjs worktree <id>");
    const config = B.loadConfig(root);
    B.findJob(B.loadBoard(root), id);
    out(B.worktreePath(config, root, id));
  },

  slots() {
    const config = B.loadConfig(root);
    const { active, max, free } = B.capacity(B.loadBoard(root), config);
    out(`active ${active.length}/${max}: ${active.length ? active.join(", ") : "none"}; free ${free}`);
  },

  preflight() {
    const status = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const errors = B.preflightErrors(B.parseGitStatusZ(status), B.loadBoard(root));
    if (errors.length) {
      out(["Uncommitted changes outside in-flight factory records. Commit or remove them first:", ...errors.map((p) => `- ${p}`)].join("\n"));
      process.exitCode = 1;
    } else out("Clean apart from in-flight factory records.");
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (HELP.has(cmd)) {
  out(USAGE);
  process.exit(0);
}
if (!cmd) {
  out(USAGE);
  process.exit(2);
}
if (!Object.hasOwn(commands, cmd)) {
  out(`Unknown command "${cmd}". Commands: ${Object.keys(commands).join(", ")}`);
  out(USAGE);
  process.exit(2);
}
try {
  commands[cmd](args);
} catch (err) {
  process.stderr.write(`error: ${err.message}\n`);
  process.exit(1);
}
