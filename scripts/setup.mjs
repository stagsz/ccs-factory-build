#!/usr/bin/env node
// CCS Factory Build - setup.
// Installs the /factory skill and the seven agents from claude-setup/ into .claude/
// so Claude Code picks them up. Existing files are kept unless --force is passed.
// Usage: npm run setup            (or: npm run setup -- --force)
//        node scripts/setup.mjs --target <repo>   install into another repo

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function install({ source, target, force = false }) {
  const results = { copied: [], skipped: [] };
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const from = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(from); continue; }
      const rel = path.relative(source, from);
      const to = path.join(target, rel);
      if (fs.existsSync(to) && !force) { results.skipped.push(rel); continue; }
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      results.copied.push(rel);
    }
  };
  walk(source);
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const t = args.indexOf("--target");
  const repo = t !== -1 ? path.resolve(args[t + 1]) : here;
  const r = install({ source: path.join(here, "claude-setup"), target: path.join(repo, ".claude"), force });
  for (const f of r.copied) console.log(`installed .claude/${f.split(path.sep).join("/")}`);
  for (const f of r.skipped) console.log(`kept      .claude/${f.split(path.sep).join("/")} (exists, use --force to overwrite)`);
  console.log(`\nDone: ${r.copied.length} installed, ${r.skipped.length} kept. Commit .claude/ so the factory travels with the repo.`);
}
