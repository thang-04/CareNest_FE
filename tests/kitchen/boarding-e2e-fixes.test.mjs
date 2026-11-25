import assert from 'node:assert/strict';
import { test } from 'node:test';

const { PERIOD_FROM_PAST, markEnough, validateForecastForm, weekPeriod } = await import('@/utils/kitchen/freshGoodsForm');
const { pendingSampleCount, sameMealCount, sampleSignBlock } = await import('@/utils/kitchen/kitchenRecords');
const { campusTitle } = await import('@/utils/campusLabel');
const { validateNutritionSetup } = await import('@/utils/menu-planning/menuPlanningValidation');
const { dishInUseNote } = await import('@/utils/menu-planning/catalogUsage');

const TODAY = '2026-11-25';
// Bữa lấy từ Cấu hình trường nên không kiểm ở đây
const RO = { mealsReadOnly: true };

test('dự trù: Từ ngày trước hôm nay báo lỗi tại ô, hôm nay thì không', () => {
  const form = { periodFrom: '2026-11-24', periodTo: '2026-11-27', counts: [] };
  assert.equal(validateForecastForm(form, TODAY).periodFrom, PERIOD_FROM_PAST);
  assert.deepEqual(validateForecastForm({ ...form, periodFrom: TODAY }, TODAY), {});
  // Không truyền hôm nay ⇒ giữ hành vi cũ (chỉ kiểm định dạng, thứ tự)
  assert.deepEqual(validateForecastForm(form), {});
});

test('dự trù: "Tuần này" giữa tuần bắt đầu từ hôm nay; tuần sau giữ Thứ 2', () => {
  assert.deepEqual(weekPeriod('2026-11-23', TODAY), { periodFrom: TODAY, periodTo: '2026-11-27' });
  assert.deepEqual(weekPeriod('2026-11-30', TODAY), { periodFrom: '2026-11-30', periodTo: '2026-12-04' });
});

test('kiểm nhận: đánh dấu Đủ điền số cần nhận vào ô trống, giữ ô đã nhập', () => {
  const form = { lines: [{ receivedQty: '' }, { receivedQty: '3' }, { receivedQty: '' }] };
  const round = [{ purchaseExpectedQty: 2 }, { purchaseExpectedQty: 5 }, { purchaseExpectedQty: null }];
  const all = markEnough(form, round);
  assert.deepEqual(
    all.lines.map((l) => [l.result, l.receivedQty]),
    [
      ['ENOUGH', '2'],
      ['ENOUGH', '3'],
      ['ENOUGH', ''],
    ],
  );
  const one = markEnough(form, round, 0);
  assert.equal(one.lines[0].receivedQty, '2');
  assert.equal(one.lines[2].result, undefined);
});

test('lưu mẫu: đếm số mẫu cùng ngày cùng bữa', () => {
  const samples = [
    { date: TODAY, session: 'LUNCH' },
    { date: TODAY, session: 'LUNCH' },
    { date: TODAY, session: 'AFTERNOON' },
  ];
  const countOf = sameMealCount(samples);
  assert.equal(countOf(samples[0]), 2);
  assert.equal(countOf(samples[2]), 1);
  assert.equal(sameMealCount(undefined)({ date: TODAY, session: 'LUNCH' }), 0);
});

test('cấu hình nhóm tuổi: gam tối thiểu vượt năng lượng × cơ cấu báo tại ô (số liệu VPS), số hợp lý thì không', () => {
  const group = (norms) => ({
    ageGroupId: 'ag-4',
    enabled: true,
    price: '30000',
    meals: [{ code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' }],
    norms,
  });
  const core = { kcal: ['615', '726'], protein: ['13', '20'], lipid: ['25', '35'], glucid: ['52', '60'] };
  const vps = { ...core, animalProteinG: ['300', '400'], plantProteinG: ['300', '400'] };
  const err = validateNutritionSetup({ effectiveFrom: TODAY, groups: [group(vps)] }, TODAY, RO)['ag-4.norms.animalProteinG'];
  assert.match(err, /600 g/);
  assert.match(err, /37 g/);
  const ok = { ...core, animalProteinG: ['10', '20'], plantProteinG: ['8', '15'] };
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: TODAY, groups: [group(ok)] }, TODAY, RO), {});
  // Chưa nhập năng lượng/cơ cấu ⇒ không đối chiếu gam
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: TODAY, groups: [group({ animalProteinG: ['5000', '6000'] })] }, TODAY, RO), {});
});

test('ngừng dùng món: câu xác nhận liệt kê thực đơn mẫu và tuần chưa qua', () => {
  assert.equal(dishInUseNote({ usedInMenus: [], usedInWeeks: [] }), '');
  const note = dishInUseNote({ usedInMenus: [{ id: '6', name: 'Mẫu 6' }], usedInWeeks: [{ weekStart: '2026-11-30', status: 'DRAFT' }] });
  assert.match(note, /Mẫu 6/);
  assert.match(note, /30\/11\/2026 chưa công bố/);
});

test('sổ M5: còn mẫu chờ duyệt lưu mẫu thì có lý do khóa nút Ký; hủy mẫu chờ duyệt không tính', () => {
  const samples = [
    { status: 'RECORDED', disposalStatus: 'NONE' },
    { status: 'APPROVED', disposalStatus: 'RECORDED' },
    { status: 'APPROVED', disposalStatus: 'NONE' },
  ];
  assert.equal(pendingSampleCount(samples), 1);
  assert.equal(pendingSampleCount(undefined), 0);
  assert.match(sampleSignBlock(1), /Còn 1 bản lưu mẫu của ngày chưa duyệt/);
  assert.equal(sampleSignBlock(0), '');
});

test('sổ suất ăn: luôn ghi tên điểm trường, kể cả khi chỉ có một; tên trùng thì kèm mã', () => {
  assert.equal(campusTitle('2', [{ id: 2, name: 'Cơ sở 2', shortName: 'Cơ sở 2' }]), 'Cơ sở 2');
  const twins = [
    { id: 1, code: 'CS-A', shortName: 'Cơ sở 1' },
    { id: 3, code: 'CS-C', shortName: 'Cơ sở 1' },
  ];
  assert.equal(campusTitle(3, twins), 'CS-C – Cơ sở 1');
  assert.equal(campusTitle('9', []), '9');
});
