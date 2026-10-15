import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "claude-setup");
const read = (...parts) => fs.readFileSync(path.join(source, ...parts), "utf8");

test("SKILL.md records each job on main and rolls back without losing records", () => {
  const skill = read("skills", "factory", "SKILL.md");
  assert.ok(skill.includes("### 7. Record the job"));
  assert.ok(skill.includes("factory: record <id>"));
  assert.ok(skill.includes("git add factory/board.json factory/backlog.md factory/jobs/<id>"));
  assert.ok(skill.includes("reset --keep ORIG_HEAD"));
  assert.ok(!skill.includes("reset --hard"));
});

test("builder.md forbids touching the backlog and committing factory files", () => {
  const builder = read("agents", "builder.md");
  assert.ok(builder.includes("factory/backlog.md"));
});
