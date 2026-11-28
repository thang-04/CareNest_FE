import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { plannedAdmissionNotice } from '@/utils/children/childrenHelpers';

// G94-180/CHD-11 (Cần chốt 19/11 BUG-43, user theo 2026-11-22): trẻ đã tiếp nhận phải có lớp trước khi kích hoạt năm học.
const read = (f) => readFileSync(f, 'utf8');
const MUST_PLACE = 'Phải xếp lớp trước khi kích hoạt năm học';

test('câu đăng ký năm sau: chưa có lớp ⇒ nói phải xếp lớp trước khi kích hoạt; có lớp dự kiến ⇒ không', () => {
  const noClass = plannedAdmissionNotice({ schoolYearName: '2027-2028', className: null, startDate: '2027-09-05' });
  assert.ok(noClass.includes(MUST_PLACE), noClass);
  assert.ok(noClass.includes('cho nghỉ học để hủy đăng ký'), noClass);
  const withClass = plannedAdmissionNotice({ schoolYearName: '2027-2028', className: 'Lớp A', startDate: '2027-09-05' });
  assert.ok(!withClass.includes(MUST_PLACE), withClass);
});

test('danh sách trẻ báo số trẻ Sắp nhập học chưa có lớp, kèm link Xếp lớp năm học mới', () => {
  const src = read('src/pages/children/ChildrenListPage.jsx');
  assert.match(src, /const plannedWithoutClass = all\.filter\(\(c\) => c\.plannedAdmission && !c\.plannedAdmission\.classId\)\.length;/);
  assert.match(src, /trẻ Sắp nhập học chưa có lớp\. Phải xếp lớp trước khi kích hoạt năm học\./);
  assert.match(src, /to="\/school\/placement\?tab=new"/);
});

test('màn kết quả tiếp nhận hiện câu đăng ký năm sau', () => {
  assert.match(read('src/pages/children/EnrollChildPage.jsx'), /saved\.plannedAdmission && <div>\{plannedAdmissionNotice\(saved\.plannedAdmission\)\}<\/div>/);
});
