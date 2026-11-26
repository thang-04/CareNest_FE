import assert from 'node:assert/strict';
import { test } from 'node:test';

const { createDayBalanceApi } = await import('@/services/dayBalanceApi');
const { balanceBlocks, childrenOfCampus, dayMark, foodRowsOf, mealGroupsOf, nutritionTableOf, toBalanceRequest, verdictOf } = await import(
  '@/utils/menu-planning/dayBalance'
);

const view = () => ({
  date: '2026-11-23',
  version: 3,
  roundingStep: 0.1,
  campuses: [{ campusId: '1', name: 'Cơ sở 1' }],
  ageGroups: [
    { ageGroupId: '2', name: 'Nhà trẻ', block: 'NURSERY', sessions: ['MORNING', 'LUNCH'] },
    { ageGroupId: '3', name: 'MG bé', block: 'KINDERGARTEN', sessions: ['LUNCH'] },
    { ageGroupId: '4', name: 'MG nhỡ', block: 'KINDERGARTEN', sessions: ['LUNCH'] },
  ],
  counts: [
    { campusId: '1', ageGroupId: '2', children: 10 },
    { campusId: '1', ageGroupId: '3', children: 20 },
  ],
  lines: [
    { ageGroupId: '3', session: 'LUNCH', dishId: '5', dishName: 'Cơm', foodId: '7', baseGrams: 60, grams: 61.5 },
    { ageGroupId: '3', session: 'LUNCH', dishId: '6', dishName: 'Thịt', foodId: '8', baseGrams: 40, grams: 40 },
  ],
  foods: [
    { foodId: '7', code: 'GAO', name: 'Gạo', storage: 'DRY', wastePct: 0, purchaseUnit: 'kg', purchaseUnitSize: 1000, unitPrice: 18000 },
  ],
  groups: [
    {
      ageGroupId: '3',
      children: 20,
      rows: [{ foodId: '7', gramsPerChild: 61.5, totalGrams: 1230, purchaseTotal: 1230, purchaseQuantity: 1.23, cost: 22140 }],
    },
  ],
});

test('thân yêu cầu gửi đủ số trẻ, dòng gam và phiên bản; không gửi tên món', () => {
  const body = toBalanceRequest(view());
  assert.equal(body.version, 3);
  assert.equal(body.roundingStep, 0.1);
  assert.equal(body.applyRounding, false);
  assert.equal(body.fromRecipe, false);
  assert.deepEqual(body.edits, []);
  assert.deepEqual(body.counts, view().counts);
  assert.deepEqual(body.lines[0], { ageGroupId: '3', session: 'LUNCH', dishId: '5', foodId: '7', baseGrams: 60, grams: 61.5 });
});

test('sửa gam, lượng mua hay số trẻ thì bỏ dấu đã làm tròn; làm tròn gửi bước đã chọn', () => {
  const edit = { ageGroupId: '3', foodId: '7', gramsPerChild: 70 };
  const edited = toBalanceRequest(view(), { edits: [edit] });
  assert.deepEqual(edited.edits, [edit]);
  assert.equal(edited.roundingStep, null);
  const counted = toBalanceRequest(view(), { count: { campusId: '1', ageGroupId: '3', children: 25 } });
  assert.equal(counted.counts[1].children, 25);
  assert.equal(counted.counts[0].children, 10);
  assert.equal(counted.roundingStep, null);
  const rounded = toBalanceRequest(view(), { roundingStep: 0.5, applyRounding: true });
  assert.equal(rounded.applyRounding, true);
  assert.equal(rounded.roundingStep, 0.5);
  assert.equal(toBalanceRequest(view(), { fromRecipe: true }).lines.length, 0, 'về công thức không gửi dòng đã sửa');
});

test('kết luận: nhãn theo tiêu chí, tiền nói vượt / thiếu', () => {
  assert.deepEqual(verdictOf('OK'), { tone: 'green', label: 'Đạt' });
  assert.deepEqual(verdictOf('HIGH'), { tone: 'red', label: 'Cao' });
  assert.deepEqual(verdictOf('HIGH', 'money'), { tone: 'red', label: 'Vượt' });
  assert.deepEqual(verdictOf('LOW', 'money'), { tone: 'red', label: 'Thiếu' });
  assert.equal(verdictOf('NA').label, 'Chưa có định mức');
  assert.equal(verdictOf('INCOMPLETE').label, 'Thiếu số liệu');
  assert.equal(verdictOf('NO_DISHES').label, 'Chưa có món');
  assert.equal(verdictOf(undefined).tone, 'gray');
});

test('khối, dòng thực phẩm, bữa món và tổng số trẻ theo điểm trường', () => {
  const v = view();
  assert.deepEqual(balanceBlocks(v), ['NURSERY', 'KINDERGARTEN']);
  const [row] = foodRowsOf(v, '3');
  assert.deepEqual([row.name, row.gramsPerChild, row.purchaseQuantity, row.storage, row.unitPrice], ['Gạo', 61.5, 1.23, 'DRY', 18000]);
  assert.deepEqual(foodRowsOf(v, '2'), []);
  assert.deepEqual(row.meals, [{ session: 'LUNCH', dishName: 'Cơm', grams: 61.5 }]);
  const plan = {
    items: [
      { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '5', dishName: 'Cơm' },
      { session: 'LUNCH', block: 'NURSERY', dishId: '9', dishName: 'Cháo' },
    ],
  };
  assert.deepEqual(mealGroupsOf(plan, 'KINDERGARTEN', ['LUNCH', 'AFTERNOON']), [
    { session: 'LUNCH', items: [plan.items[0]] },
    { session: 'AFTERNOON', items: [] },
  ]);
  assert.equal(childrenOfCampus(v.counts, '1'), 30);
});

test('bảng dinh dưỡng: tổng, định mức, % đạt và cơ cấu P:L:G lấy nguyên từ BE', () => {
  const evaluation = {
    totals: { kcal: 656.96, animalProtein: 16.68, plantProtein: 9.46, animalLipid: 13.96, plantLipid: 6.14, glucid: 88.5 },
    rows: [
      { key: 'kcal', min: 615, max: 726, attainment: 98 },
      { key: 'protein', percent: 16.3, min: 13, max: 20 },
      { key: 'lipid', percent: 28.5, min: 25, max: 35 },
      { key: 'glucid', percent: 55.2, min: 52, max: 60 },
    ],
  };
  const table = nutritionTableOf(evaluation);
  assert.deepEqual(
    table.map((r) => r.key),
    ['total', 'norm', 'attainment', 'ratio', 'ratioNorm'],
  );
  assert.equal(table[0].animalProtein, '16,68');
  assert.equal(table[1].kcal, '615 – 726');
  assert.equal(table[1].animalProtein, '—');
  assert.equal(table[2].kcal, '98%');
  assert.equal(table[3].animalProtein, '16,3%');
  assert.equal(table[4].glucid, '52 – 60%');
  assert.deepEqual(nutritionTableOf(null), []);
});

test('dấu trên tab ngày theo trạng thái BE', () => {
  assert.equal(dayMark({ dayOff: true }), ' · nghỉ');
  assert.equal(dayMark({ saved: true, passed: true }), ' ✓');
  assert.equal(dayMark({ saved: true, passed: false }), ' !');
  assert.equal(dayMark({ saved: false }), ' ·');
  assert.equal(dayMark(undefined), '');
});

test('adapter: đúng đường dẫn và tham số lần cân đối', async () => {
  const calls = [];
  const client = {
    get: async (url, config) => (calls.push(['get', url, config?.params]), []),
    post: async (url, body, config) => (calls.push(['post', url, config?.params, body]), {}),
    put: async (url, body, config) => (calls.push(['put', url, config?.params, body]), {}),
  };
  const api = createDayBalanceApi({ client });
  await api.getStatuses('2026-11-23', '2026-11-27');
  await api.getBalance('2026-11-23', 1);
  await api.preview('2026-11-23', 1, { a: 1 });
  await api.save('2026-11-23', 1, { a: 2 });
  assert.deepEqual(calls, [
    ['get', '/nutrition/day-balances', { from: '2026-11-23', to: '2026-11-27' }],
    ['get', '/nutrition/day-balances/2026-11-23', { round: 1 }],
    ['post', '/nutrition/day-balances/2026-11-23/preview', { round: 1 }, { a: 1 }],
    ['put', '/nutrition/day-balances/2026-11-23', { round: 1 }, { a: 2 }],
  ]);
});
