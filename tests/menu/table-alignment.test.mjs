import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const SRC = new URL('../../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.jsx') ? [p] : [];
  });
const sources = files(SRC).map((p) => ({ p: p.slice(SRC.length), text: readFileSync(p, 'utf8') }));

// Ô tiêu đề cột thao tác: <th ...>Thao tác</th> hoặc <th ...><span className="sr-only">Thao tác</span></th>
const ACTION_TH = /<th\b([^>]*)>\s*(?:<span className="sr-only">)?Thao tác(?:<\/span>)?\s*<\/th>/g;

test('mọi cột "Thao tác" dùng class chung cell--actions ở tiêu đề và ô (vừa nút, căn giữa)', () => {
  const bad = [];
  for (const { p, text } of sources) {
    const ths = [...text.matchAll(ACTION_TH)];
    if (!ths.length) continue;
    const missing = ths.filter((m) => !/cell--actions/.test(m[1]));
    if (missing.length) bad.push(`${p}: tiêu đề thiếu cell--actions`);
    const tds = (text.match(/<td\b[^>]*cell--actions/g) || []).length;
    if (tds < ths.length) bad.push(`${p}: ${ths.length} cột thao tác nhưng ${tds} ô có cell--actions`);
    if (ths.some((m) => /\b(center|right|text-right)\b/.test(m[1]))) bad.push(`${p}: tiêu đề thao tác còn class căn riêng`);
  }
  assert.deepEqual(bad, []);
});

test('CSS chung: cột thao tác thu vừa nội dung và căn giữa', () => {
  const css = readFileSync(join(SRC, 'styles/components.css'), 'utf8');
  const rule = css.slice(css.indexOf('.table .cell--actions'), css.indexOf('}', css.indexOf('.table .cell--actions')));
  assert.match(rule, /width:\s*1%/);
  assert.match(rule, /white-space:\s*nowrap/);
  assert.match(rule, /text-align:\s*center/);
});

// User đổi quyết định 20/10/2026: số đếm/số lượng căn giữa (.num), tiền căn phải (.money); tiêu đề cùng class với ô
test('cột số hiển thị căn giữa cả tiêu đề bằng .num (ô nhập số giữ căn theo ô nhập)', () => {
  const NUMERIC = {
    'pages/school-config/AgeGroupsClassesPage.jsx': ['Sĩ số tối đa/lớp', 'Số lớp'],
    'pages/school-config/SchoolYearListPage.jsx': ['Số lớp'],
    'pages/school-config/TeacherAssignmentPage.jsx': ['Số lớp', 'Sĩ số'],
    'pages/school-config/CampusDetailPage.jsx': ['Sĩ số'],
    'pages/school-config/CampusListPage.jsx': ['Trẻ'],
    'components/school-config/CopyClassesModal.jsx': ['Sĩ số tối đa'],
    'components/facility-transfer/StockMovementCard.jsx': ['Số lượng luân chuyển'],
    'components/facility-transfer/wizard/StepAssignUsers.jsx': ['Số lượng luân chuyển'],
    'components/facility-transfer/wizard/StepReview.jsx': ['Số lượng luân chuyển'],
    'pages/facility-transfer/ReceivePage.jsx': ['SL theo phiếu', 'SL đã bàn giao', 'SL cần nhận'],
    'pages/inventory-inspection/InspectionSheetPage.jsx': ['SL sổ sách', 'Chênh lệch'],
  };
  const bad = [];
  for (const [file, headers] of Object.entries(NUMERIC)) {
    const text = readFileSync(join(SRC, file), 'utf8');
    for (const h of headers) {
      const esc = h.replace(/[()/]/g, (c) => `\\${c}`);
      const ths = [...text.matchAll(new RegExp(String.raw`<th\b([^>]*)>` + esc + '</th>', 'g'))];
      if (!ths.length) bad.push(`${file}: không thấy cột ${h}`);
      if (ths.some((m) => !/\bnum\b/.test(m[1]))) bad.push(`${file}: cột ${h} chưa dùng .num (căn giữa)`);
    }
  }
  assert.deepEqual(bad, []);
});
