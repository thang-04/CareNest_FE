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

test("measure: phần tử viết tay, CSS module đè class chung, px/z-index cứng, import CSS chéo module", () => {
  const root = makeRepo({
    "src/components/ui/Button.jsx": "export const Button = () => <button className=\"btn\" />;\n",
    "src/pages/kitchen/A.jsx":
      "import '@/styles/modules/kitchen.css';\nimport '@/styles/modules/menu-planning.css';\nexport default () => (<div onClick={go}><button>x</button><table /><input /></div>);\n",
    "src/styles/components.css": ".btn { padding: 8px; }\n.table { z-index: 5; }\n",
    "src/styles/modules/kitchen.css": ".kb-x .btn { margin-top: 4px; z-index: 9; color: var(--blue-700); }\n.btn-group { gap: 0; }\n",
  });
  const m = measure(root);
  assert.deepEqual(m.rawButton, { "src/pages/kitchen/A.jsx": 1 }, "components/ui được viết <button>");
  assert.deepEqual(m.rawTable, { "src/pages/kitchen/A.jsx": 1 });
  assert.deepEqual(m.rawField, { "src/pages/kitchen/A.jsx": 1 });
  assert.deepEqual(m.clickableDiv, { "src/pages/kitchen/A.jsx": 1 });
  assert.deepEqual(m.crossCssImport, { "src/pages/kitchen/A.jsx": 1 }, "kitchen.css hợp lệ, menu-planning.css là của module khác");
  assert.deepEqual(m.sharedOverride, { "src/styles/modules/kitchen.css": 1 }, ".btn-group và CSS chung không tính");
  assert.deepEqual(m.spacingPx, { "src/styles/components.css": 1, "src/styles/modules/kitchen.css": 1 });
  assert.deepEqual(m.zIndex, { "src/styles/components.css": 1, "src/styles/modules/kitchen.css": 1 });
  assert.deepEqual(m.primitiveToken, { "src/styles/modules/kitchen.css": 1 });
});

test("measure: tab viết tay, thanh nút dính đáy, xuất Excel không xem trước", () => {
  const root = makeRepo({
    "src/components/ui/Tabs.jsx": "export const Tabs = () => <div role=\"tablist\" />;\n",
    "src/components/ui/ExportPreview.jsx": "export const exportWithPreview = (r, f) => downloadXlsx(r, f);\n",
    "src/pages/a/A.jsx":
      "export default () => (<><div role=\"tablist\" /><div className=\"page-actions page-actions--sticky\" /><Button onClick={() => downloadXlsx(rows, 'a.xlsx')} /></>);\n",
    "src/pages/a/B.jsx": "export default () => <Button onClick={() => downloadCsv(tpl, 'mau.csv')} />;\n",
  });
  const m = measure(root);
  assert.deepEqual(m.handTablist, { "src/pages/a/A.jsx": 1 }, "components/ui được viết tablist");
  assert.deepEqual(m.stickyActions, { "src/pages/a/A.jsx": 1 });
  assert.deepEqual(m.directExport, { "src/pages/a/A.jsx": 1 }, "tải tệp mẫu CSV không tính");
});

test("CLI: --update chỉ hạ baseline, từ chối nâng; loại kiểm tra mới được ghi mốc", () => {
  const root = makeRepo({
    "src/styles/modules/a.css": ".a { color: #fff; color: #000; }\n",
    "src/pages/A.jsx": "export default () => <button />;\n",
    "scripts/design-baseline.json": JSON.stringify({ hex: { "src/styles/modules/a.css": 1 } }),
  });
  const refused = run(root, "--update");
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /từ chối nâng/);
  const ok = makeRepo({
    "src/styles/modules/a.css": ".a { color: #fff; }\n",
    "src/pages/A.jsx": "export default () => <button />;\n",
    "scripts/design-baseline.json": JSON.stringify({ hex: { "src/styles/modules/a.css": 2, "src/gone.css": 3 } }),
  });
  assert.equal(run(ok, "--update").status, 0);
  assert.equal(run(ok).status, 0);
});
