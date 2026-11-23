import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// G94-180 (mục 12, Q5(b)): giáo viên có từ 2 lớp ⇒ mỗi lớp một khối thu gọn, lớp đầu mở sẵn; 1 lớp ⇒ như cũ.
const read = (f) => readFileSync(f, 'utf8');

test('trang: chỉ thu gọn khi có hơn 1 lớp, lớp đầu mở sẵn, tiêu đề lấy số từ classes BE trả', () => {
  const src = read('src/pages/children/HealthCheckDetailPage.jsx');
  assert.match(src, /const fold = classes\.length > 1;/);
  assert.match(src, /collapsible: fold,/);
  assert.match(src, /defaultOpen: i === 0,/);
  assert.match(src, /summary: `/);
  assert.match(src, /<Roster [^>]*\{\.\.\.foldProps\(c, i\)\}/);
});

for (const f of ['MeasurementRoundRoster', 'HealthCheckClassRoster']) {
  test(`${f}: khối thu gọn dùng details/summary, không tải danh sách khi đóng`, () => {
    const src = read(`src/components/children/${f}.jsx`);
    assert.match(src, /collapsible/);
    assert.match(src, /defaultOpen/);
    assert.match(src, /<RosterFold/);
    assert.match(src, /useHealthCheckClass\(campaignId, classId, \{ enabled: open \}\)/);
  });
}

test('RosterFold là details có summary', () => {
  const src = read('src/components/children/RosterFold.jsx');
  assert.match(src, /<details/);
  assert.match(src, /<summary/);
});
