import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCellChanges, valueAt } from '../../src/models/education-plan/aiEdit.mjs';

// BE:EDU-95: chỉ áp ô còn đúng nội dung AI đã đọc; ô cô vừa sửa giữ nguyên
test('áp ô khớp, bỏ qua ô đã đổi hoặc không có', () => {
  const doc = { days: [{ sections: { hoc: { aims: 'Cũ', rows: [{ teacher: 'Cô vừa sửa' }] } } }] };
  const { doc: next, applied, skipped } = applyCellChanges(doc, [
    { path: 'days.0.sections.hoc.aims', before: 'Cũ', after: 'Mới' },
    { path: 'days.0.sections.hoc.rows.0.teacher', before: 'Bản AI đọc', after: 'AI viết' },
    { path: 'days.3.sections.hoc.aims', before: '', after: 'Ô lạ' },
  ]);
  assert.equal(valueAt(next, 'days.0.sections.hoc.aims'), 'Mới');
  assert.equal(valueAt(next, 'days.0.sections.hoc.rows.0.teacher'), 'Cô vừa sửa');
  assert.equal(applied.length, 1);
  assert.equal(skipped.length, 2);
  assert.equal(doc.days[0].sections.hoc.aims, 'Cũ');
});
