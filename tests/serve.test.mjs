import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveJobFile } from "../scripts/lib/serve.mjs";

const root = path.resolve("repo-root");
const jobsDir = path.join(root, "factory", "jobs");

test("resolves a normal job file", () => {
  assert.equal(resolveJobFile(root, "/jobs/j-1/spec.md"), path.join(jobsDir, "j-1", "spec.md"));
});

test("decodes valid percent-encoding", () => {
  assert.equal(resolveJobFile(root, "/jobs/j-1/my%20notes.md"), path.join(jobsDir, "j-1", "my notes.md"));
});

test("rejects .. traversal", () => {
  for (const p of ["/jobs/../board.json", "/jobs/../../package.json", "/jobs/j-1/../../../x.md"]) {
    assert.equal(resolveJobFile(root, p), null, p);
  }
});

test("rejects a sibling directory that shares the jobs prefix", () => {
  assert.equal(resolveJobFile(root, "/jobs/../jobs-evil/x.md"), null);
});

test("rejects percent-encoded traversal", () => {
  for (const p of ["/jobs/%2e%2e/%2e%2e/x.md", "/jobs/..%2f..%2fx.md", "/jobs/%2e%2e%2f%2e%2e%2fx.md"]) {
    assert.equal(resolveJobFile(root, p), null, p);
  }
});

test("rejects backslash-encoded traversal on every platform", () => {
  assert.equal(resolveJobFile(root, "/jobs/..%5c..%5cx.md"), null);
});

test("treats an encoded backslash as a separator on every platform", () => {
  assert.equal(resolveJobFile(root, "/jobs/j-1%5cspec.md"), path.join(jobsDir, "j-1", "spec.md"));
});

test("rejects files that are not .md", () => {
  for (const p of ["/jobs/j-1/notes.txt", "/jobs/j-1/spec.md.bak"]) {
    assert.equal(resolveJobFile(root, p), null, p);
  }
});

test("rejects the jobs directory itself", () => {
  for (const p of ["/jobs/", "/jobs/."]) {
    assert.equal(resolveJobFile(root, p), null, p);
  }
});

test("rejects pathnames without the /jobs/ prefix", () => {
  for (const p of ["/jobs", "/board.json", "/jobsx/a.md"]) {
    assert.equal(resolveJobFile(root, p), null, p);
  }
});

test("returns null instead of throwing on malformed encoding", () => {
  for (const p of ["/jobs/%ZZ", "/jobs/j-1/%E0%A4%A.md"]) {
    let result;
    assert.doesNotThrow(() => {
      result = resolveJobFile(root, p);
    }, p);
    assert.equal(result, null, p);
  }
});
