import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { install } from "../scripts/setup.mjs";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "claude-setup");

test("setup installs the skill and all seven agents", () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ccs-setup-")), ".claude");
  const r = install({ source, target });
  const agents = fs.readdirSync(path.join(target, "agents")).sort();
  assert.deepEqual(agents, [
    "approver.md", "builder.md", "code-reviewer.md", "security-reviewer.md",
    "spec-writer.md", "ui-design-reviewer.md", "ux-reviewer.md",
  ]);
  assert.ok(fs.existsSync(path.join(target, "skills", "factory", "SKILL.md")));
  assert.equal(r.copied.length, 8);
});

test("setup keeps existing files unless forced", () => {
  const target = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ccs-setup-")), ".claude");
  install({ source, target });
  const f = path.join(target, "agents", "builder.md");
  fs.writeFileSync(f, "my custom builder");
  const kept = install({ source, target });
  assert.equal(kept.copied.length, 0);
  assert.equal(fs.readFileSync(f, "utf8"), "my custom builder");
  install({ source, target, force: true });
  assert.notEqual(fs.readFileSync(f, "utf8"), "my custom builder");
});

test("every agent declares name, description, tools and a model, and reviewers can write", () => {
  const dir = path.join(source, "agents");
  for (const file of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const fm = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
    assert.match(fm, new RegExp(`^name: ${file.replace(".md", "")}$`, "m"), `${file} name`);
    assert.match(fm, /^description: .+/m, `${file} description`);
    assert.match(fm, /^model: (opus|sonnet|haiku)$/m, `${file} model`);
    assert.match(fm, /^tools: .*\bWrite\b/m, `${file} must be able to write its own output file`);
  }
});
