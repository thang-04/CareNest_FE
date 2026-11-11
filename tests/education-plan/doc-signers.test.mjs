import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const { applyEduConfig } = await import('@/models/education-plan/eduConfig');
const { yearSigners, yearPlanFile } = await import('@/utils/education-plan/yearPlanDoc');
const { leaderNameOf, branchFile } = await import('@/utils/education-plan/classPlanDoc');

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

test('T043 [US3]: Bản đã ban hành in đúng từ review.printSnapshot bất biến khi cấu hình toàn trường sau đó thay đổi', () => {
  const publishedPlan = {
    ...plan,
    review: {
      printSnapshot: {
        schemaVersion: 1,
        capturedAt: '2026-10-01T08:00:00Z',
        origin: 'PUBLICATION',
        documentType: 'year',
        policyRevision: 1,
        slots: [
          { roleKey: 'TEAM_LEADER', label: 'Tổ trưởng chuyên môn', names: ['Tổ trưởng Lúc Ban Hành'] },
          { roleKey: 'VICE_PRINCIPAL', label: 'Phó Hiệu trưởng', names: ['Phó HT Duyệt Thật'] },
        ],
      },
    },
  };

  // Cấu hình toàn trường sau đó thay đổi: đổi danh sách Phó HT và đổi cả chuỗi ký
  applyEduConfig({
    signers: { year: ['PRINCIPAL'] },
    signerNames: { principals: ['Hiệu trưởng Mới'], vicePrincipals: ['Phó HT Mới Đổi'] },
  });

  const signers = yearSigners(publishedPlan, staff);
  assert.deepEqual(
    signers.map((s) => [s.title, s.name]),
    [
      ['Tổ trưởng chuyên môn', 'Tổ trưởng Lúc Ban Hành'],
      ['Phó Hiệu trưởng', 'Phó HT Duyệt Thật'],
    ],
  );
});

test('T043 [US3]: Bản hoàn tất do đổi chính sách (completionMode POLICY_CHANGE) không bịa tên người duyệt cho bước không có approval', () => {
  const policyCompletedPlan = {
    ...plan,
    review: {
      completionMode: 'POLICY_CHANGE',
      printSnapshot: {
        schemaVersion: 1,
        capturedAt: '2026-10-01T08:00:00Z',
        origin: 'PUBLICATION',
        documentType: 'year',
        policyRevision: 2,
        slots: [{ roleKey: 'VICE_PRINCIPAL', label: 'Phó Hiệu trưởng', names: ['Phó HT Thực Tế'] }],
      },
    },
  };

  const signers = yearSigners(policyCompletedPlan, staff);
  assert.equal(signers.length, 1);
  assert.equal(signers[0].title, 'Phó Hiệu trưởng');
  assert.equal(signers[0].name, 'Phó HT Thực Tế');
});

test('T043 [US3]: Snapshot bản in LEGACY_BASELINE giữ nguyên nhãn và người ký nguồn gốc chuyển đổi kể cả dạng JSON string', () => {
  const legacyPlan = {
    ...plan,
    review: {
      authorCoverage: 'LEGACY_BASELINE',
      printSnapshot: JSON.stringify({
        schemaVersion: 1,
        origin: 'LEGACY_BASELINE',
        documentType: 'year',
        slots: [{ roleKey: 'VICE_PRINCIPAL', label: 'Phó hiệu trưởng', names: ['PHT Thời Baseline'] }],
      }),
    },
  };

  const signers = yearSigners(legacyPlan, staff);
  assert.equal(signers.length, 1);
  assert.equal(signers[0].name, 'PHT Thời Baseline');
});

test('T043 [US3]: Không in tên Hiệu trưởng lưu cấu hình thành người duyệt / PHT', () => {
  applyEduConfig({
    signers: { year: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
    signerNames: { principals: ['Nguyễn Hiệu Trưởng'], vicePrincipals: [] },
  });
  const draftPlan = { ...plan, review: null };
  const signers = yearSigners(draftPlan, staff);
  const vpSigner = signers.find((s) => s.role === 'VICE_PRINCIPAL');
  assert.notEqual(vpSigner?.name, 'Nguyễn Hiệu Trưởng');
  assert.equal(vpSigner?.name, '');
});

test('approved branch separates frozen creator and reviewer slots from live staff', () => {
  const doc = { names: {}, notes: {}, status: 'APPROVED', review: { printSnapshot: { schemaVersion: 1, slots: [
    { roleKey: 'CREATOR', label: 'Người soạn', names: ['Người Soạn Lúc Hoàn Tất'] },
    { roleKey: 'PRINCIPAL', label: 'Hiệu trưởng', names: ['Người Duyệt Lúc Hoàn Tất'] },
  ] } } };
  const html = branchFile({ doc, cls: { name: 'Lớp Demo' }, yearPlan: plan, teachers: [{ fullName: 'Người Soạn Sau Này' }] }).html;
  assert.equal(html.split('Người Soạn Lúc Hoàn Tất').length - 1, 1);
  assert.match(html, /Người Duyệt Lúc Hoàn Tất/);
  assert.doesNotMatch(html, /Người Soạn Sau Này/);
  const divider = html.indexOf('<b>Người xây dựng kế hoạch</b>');
  assert.ok(html.indexOf('Người Soạn Lúc Hoàn Tất') > divider);
});
