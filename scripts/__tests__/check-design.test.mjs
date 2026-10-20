import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { compare, measure } from "../check-design.mjs";
import { makeRepo } from "./helpers.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "check-design.mjs");
const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, "--root", root, ...args], { encoding: "utf8" });

test("measure: đếm hex, px, inline style; bỏ qua tokens.css và mocks", () => {
  const root = makeRepo({
    "src/styles/tokens.css": ":root { --blue: #1565e0; border-radius: 8px; }\n",
    "src/mocks/seed.js": "export const c = '#ffffff';\n",
    "src/styles/modules/a.css": ".a { color: #fff; border-radius: 6px; font-weight: 800; }\n",
    "src/pages/A.jsx": "export default () => <div style={{ width: w }} />;\n",
  });
  const m = measure(root);
  assert.deepEqual(m.hex, { "src/styles/modules/a.css": 1 });
  assert.deepEqual(m.cssPx, { "src/styles/modules/a.css": 2 });
  assert.deepEqual(m.inlineStyle, { "src/pages/A.jsx": 1 });
});

test("compare: file vượt baseline hoặc file mới ⇒ lỗi; bằng/giảm ⇒ ok", () => {
  const base = { hex: { "src/a.css": 2 } };
  assert.deepEqual(compare({ hex: { "src/a.css": 2 } }, base), []);
  assert.deepEqual(compare({ hex: { "src/a.css": 1 } }, base), []);
  assert.equal(compare({ hex: { "src/a.css": 3 } }, base).length, 1);
  assert.match(compare({ hex: { "src/b.css": 1 } }, base)[0], /src\/b.css.*baseline 0/);
});

test("CLI: --update ghi baseline rồi pass; thêm vi phạm ⇒ exit 1", () => {
  const root = makeRepo({ "src/styles/modules/a.css": ".a { color: #fff; }\n", "scripts/.keep": "" });
  assert.equal(run(root, "--update").status, 0);
  assert.equal(run(root).status, 0);
  const bad = makeRepo({ "src/styles/modules/a.css": ".a { color: #fff; }\n", "scripts/design-baseline.json": "{}\n" });
  const res = run(bad);
  assert.equal(res.status, 1);
  assert.match(res.stdout, /FAIL/);
});
