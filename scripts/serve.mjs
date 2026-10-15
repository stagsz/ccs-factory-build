#!/usr/bin/env node
// CCS Factory Build - dashboard server.
// Serves dashboard/ and factory/board.json on localhost. Read-only, no dependencies.
// Usage: npm run dashboard   (PORT env var to change the port, default 4317)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 4317);

const routes = {
  "/": path.join(root, "dashboard", "index.html"),
  "/board.json": path.join(root, "factory", "board.json"),
  "/config.json": path.join(root, "factory", "config.json"),
};

const types = { ".html": "text/html; charset=utf-8", ".json": "application/json; charset=utf-8" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let file = routes[url.pathname];

  // Job files: /jobs/<id>/<file>.md, read-only, confined to factory/jobs.
  if (!file && url.pathname.startsWith("/jobs/")) {
    const jobsDir = path.join(root, "factory", "jobs");
    const candidate = path.resolve(jobsDir, "." + decodeURIComponent(url.pathname.slice(5)));
    if (candidate.startsWith(jobsDir + path.sep) && candidate.endsWith(".md")) file = candidate;
  }

  if (!file || !fs.existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" });
    return res.end("Not found");
  }
  res.writeHead(200, {
    "content-type": types[path.extname(file)] ?? "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CCS Factory Build dashboard: http://localhost:${port}`);
});
