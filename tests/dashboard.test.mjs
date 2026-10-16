import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_STAGES, STAGES } from "../scripts/lib/board.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dashboardFile = path.join(root, "dashboard", "index.html");
const readDashboard = () => fs.readFileSync(dashboardFile, "utf8");

// Reads the array literal of constant `name` out of the dashboard page without running any page code.
// `name` must be a plain identifier. The \b word boundary keeps "STAGES" from matching "const ACTIVE_STAGES".
function extractArray(html, name) {
  const where = `${name} in dashboard/index.html`;
  const declarations = html.match(new RegExp(String.raw`\bconst\s+${name}\s*=`, "g")) ?? [];
  if (declarations.length === 0) throw new Error(`${where}: no "const ${name} = [...];" declaration found`);
  if (declarations.length > 1) throw new Error(`${where}: found ${declarations.length} declarations, expected exactly one`);

  const decl = html.match(new RegExp(String.raw`\bconst\s+${name}\s*=\s*\[([\s\S]*?)\]\s*;`));
  if (!decl) throw new Error(`${where}: declaration is not a plain array literal "const ${name} = [...];"`);

  const body = decl[1];
  const literal = String.raw`(?:"[^"\\\r\n]*"|'[^'\\\r\n]*')`;
  const shape = new RegExp(String.raw`^\s*(?:${literal}\s*,\s*)*(?:${literal}\s*,?\s*)?$`);
  if (!shape.test(body)) {
    throw new Error(`${where}: array must contain only plain string literals separated by commas, got [${body.trim()}]`);
  }
  return [...body.matchAll(/"([^"\\\r\n]*)"|'([^'\\\r\n]*)'/g)].map((m) => m[1] ?? m[2]);
}

const extractStages = (html) => extractArray(html, "STAGES");

const stagesError = (err) =>
  err instanceof Error && err.message.includes("STAGES") && err.message.includes("dashboard/index.html");

test("dashboard/index.html STAGES matches STAGES exported from scripts/lib/board.mjs", () => {
  const extracted = extractStages(readDashboard());
  assert.deepStrictEqual(
    extracted,
    STAGES,
    `STAGES in dashboard/index.html ${JSON.stringify(extracted)} does not match STAGES exported from scripts/lib/board.mjs ${JSON.stringify(STAGES)}`,
  );
});

test("extractStages catches a reordered dashboard STAGES", () => {
  const html = readDashboard();
  const reordered = html.replace('"queued", "spec",', '"spec", "queued",');
  assert.notEqual(reordered, html, "test setup: replace did not change the dashboard text");
  assert.notDeepStrictEqual(extractStages(reordered), STAGES);
});

test("extractStages catches a dashboard STAGES with a stage removed", () => {
  const html = readDashboard();
  const removed = html.replace('"rework", ', "");
  assert.notEqual(removed, html, "test setup: replace did not change the dashboard text");
  const extracted = extractStages(removed);
  assert.equal(extracted.length, STAGES.length - 1);
  assert.notDeepStrictEqual(extracted, STAGES);
});

test("extractStages throws when there is no STAGES declaration", () => {
  assert.throws(() => extractStages("<script>const OTHER = [\"a\"];</script>"), stagesError);
  assert.throws(() => extractStages(""), stagesError);
});

test("extractStages throws when STAGES is declared more than once", () => {
  const html = `<script>const STAGES = ["a"];\nconst STAGES = ["b"];</script>`;
  assert.throws(() => extractStages(html), stagesError);
});

test("extractStages throws when the brackets hold anything but plain string literals", () => {
  for (const body of ['"a", b', '...OTHER, "a"', '"a", `b`', '"a",, "b"', '"a" "b"', '"a", /* c */ "b"']) {
    assert.throws(() => extractStages(`<script>const STAGES = [${body}];</script>`), stagesError, body);
  }
  assert.throws(() => extractStages("<script>const STAGES = OTHER;</script>"), stagesError);
});

test("extractStages reads CRLF, multi-line and single-quoted arrays", () => {
  assert.deepStrictEqual(extractStages('<script>\r\n  const STAGES = [\r\n    "a",\r\n    "b",\r\n  ];\r\n</script>'), ["a", "b"]);
  assert.deepStrictEqual(extractStages('const STAGES=[\n"a",\n"b"\n]\n;'), ["a", "b"]);
  assert.deepStrictEqual(extractStages("const STAGES = ['a', \"b-c\", 'd'];"), ["a", "b-c", "d"]);
});

test("extractStages does not count a const ACTIVE_STAGES declaration as STAGES", () => {
  assert.throws(() => extractStages('<script>const ACTIVE_STAGES = ["a"];</script>'), stagesError);
  const html = '<script>const STAGES = ["a", "b"];\nconst ACTIVE_STAGES = ["a"];</script>';
  assert.deepStrictEqual(extractStages(html), ["a", "b"]);
  assert.deepStrictEqual(extractArray(html, "ACTIVE_STAGES"), ["a"]);
});

test("extractArray names the constant in its errors", () => {
  assert.throws(
    () => extractArray('<script>const STAGES = ["a"];</script>', "ACTIVE_STAGES"),
    (err) => err instanceof Error && err.message.startsWith("ACTIVE_STAGES in dashboard/index.html: "),
  );
});

test("dashboard/index.html ACTIVE_STAGES matches ACTIVE_STAGES exported from scripts/lib/board.mjs", () => {
  const extracted = extractArray(readDashboard(), "ACTIVE_STAGES");
  assert.deepStrictEqual(
    extracted,
    ACTIVE_STAGES,
    `ACTIVE_STAGES in dashboard/index.html ${JSON.stringify(extracted)} does not match ACTIVE_STAGES exported from scripts/lib/board.mjs ${JSON.stringify(ACTIVE_STAGES)}`,
  );
});

test("extractArray catches a dashboard ACTIVE_STAGES with a stage removed", () => {
  const html = readDashboard();
  const removed = html.replace(/(\bconst\s+ACTIVE_STAGES\s*=\s*\[[^\]]*?),\s*"approve"/, "$1");
  assert.notEqual(removed, html, "test setup: replace did not change the dashboard text");
  const extracted = extractArray(removed, "ACTIVE_STAGES");
  assert.equal(extracted.length, ACTIVE_STAGES.length - 1);
  assert.notDeepStrictEqual(extracted, ACTIVE_STAGES);
  assert.deepStrictEqual(extractStages(removed), STAGES, "test setup: the mutation must only touch ACTIVE_STAGES");
});

test("dashboard/index.html counts slot holders with ACTIVE_STAGES", () => {
  assert.ok(readDashboard().includes("ACTIVE_STAGES.includes("), 'dashboard/index.html does not contain "ACTIVE_STAGES.includes("');
});
