import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const { applyEduConfig } = await import('@/models/education-plan/eduConfig');
const { yearSigners, yearPlanFile } = await import('@/utils/education-plan/yearPlanDoc');
const { leaderNameOf } = await import('@/utils/education-plan/classPlanDoc');

const staff = [
  { id: 1, fullName: 'Nguyễn Quang Tiền', role: 'TEAM_LEADER', ageGroupId: 'ag-4' },
  { id: 2, fullName: 'Giáo viên Khác', role: 'TEACHER', ageGroupId: 'ag-4' },
];
const plan = { ageGroupId: 'ag-4', schoolYear: '2027-2028', title: 'KH', domains: [], themes: [], breaks: [] };

test('người ký kế hoạch năm: Tổ trưởng theo nhóm tuổi; Phó HT duy nhất in sẵn, nhiều Phó HT để trống (Tiền 31/10)', () => {
  applyEduConfig({ signerNames: { principals: ['Hiệu trưởng A'], vicePrincipals: ['Phó HT Duy Nhất'] } });
  assert.deepEqual(
    yearSigners(plan, staff).map((s) => [s.title, s.name]),
    [
      ['Tổ trưởng', 'Nguyễn Quang Tiền'],
      ['Phó hiệu trưởng', 'Phó HT Duy Nhất'],
    ],
  );
  applyEduConfig({ signerNames: { principals: [], vicePrincipals: ['Phó HT 1', 'Phó HT 2'] } });
  assert.equal(yearSigners(plan, staff)[1].name, '');
  // Người đã ban hành thì luôn in tên người đó
  assert.equal(yearSigners({ ...plan, issued: { role: 'VICE_PRINCIPAL', name: 'Phó HT 2' } }, staff)[1].name, 'Phó HT 2');
  assert.equal(leaderNameOf(staff, 'ag-4'), 'Nguyễn Quang Tiền');
  // Tổ trưởng đang phụ trách nhóm tuổi theo cấu hình BE (không phụ thuộc năm học đang chọn ở đầu trang)
  applyEduConfig({ signerNames: { principals: [], vicePrincipals: [], teamLeaders: { '2027-2028': { 'ag-5': ['Tổ trưởng 5 tuổi'] } } } });
  assert.equal(leaderNameOf([], 'ag-5', '2027 – 2028'), 'Tổ trưởng 5 tuổi');
  assert.equal(leaderNameOf([], 'ag-5', '2026-2027'), '');
  assert.equal(yearSigners({ ...plan, ageGroupId: 'ag-5' }, [])[0].name, 'Tổ trưởng 5 tuổi');
  assert.equal(leaderNameOf(staff, 'ag-3'), '');
});

test('bản xem trước dùng đúng HTML sẽ xuất, có chức danh và họ tên dưới chỗ ký', () => {
  applyEduConfig({});
  const file = yearPlanFile(plan, {}, staff);
  // Như mẫu Tiền gửi: chức danh in đậm, khoảng ký, họ tên in thường
  assert.match(file.html, /<b>Tổ trưởng<\/b><br\/><div class="sign"><\/div>Nguyễn Quang Tiền<\/td>/);
  assert.ok(file.name);
});
