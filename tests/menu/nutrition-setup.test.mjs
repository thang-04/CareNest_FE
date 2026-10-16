import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// Mock DB đọc/ghi localStorage và phát sự kiện trên window: dựng bản giả trước khi nạp module
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { validateNutritionSetup } = await import('@/utils/menu-planning/menuPlanningValidation');
const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { addDays } = await import('@/models/menu-planning/menuPlanningConstants');
const { todayInput } = await import('@/utils/format');
const { toSetupForm, toSetupPayload } = await import('@/utils/menu-planning/nutritionSetup');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const HT = { id: 'u_hung', role: 'PRINCIPAL' };
const TODAY = todayInput();
const group = (over = {}) => ({
  ageGroupId: 'ag-4',
  enabled: true,
  price: '30000',
  meals: [
    { code: 'LUNCH', name: 'Bữa trưa', countAs: 'LUNCH' },
    { code: 'AFTERNOON', name: 'Bữa chiều', countAs: 'AFTERNOON' },
  ],
  norms: { kcal: ['615', '726'], protein: ['13', '20'], lipid: ['25', '35'], glucid: ['52', '60'] },
  ...over,
});

beforeEach(() => values.clear());

test('kiểm tra nhập: khoảng ngược, ngày đã qua, giá ngày, tên trống, bỏ bữa gốc, bữa thêm thiếu bữa tính suất', () => {
  const e = validateNutritionSetup(
    {
      effectiveFrom: addDays(TODAY, -1),
      groups: [
        group({ norms: { kcal: ['800', '700'], protein: ['13', '120'] } }),
        group({
          ageGroupId: 'ag-3',
          price: '0',
          meals: [
            { code: 'LUNCH', name: '', countAs: 'LUNCH' },
            { code: '', name: 'Phụ', countAs: 'X' },
          ],
        }),
      ],
    },
    TODAY,
  );
  assert.match(e.effectiveFrom, /hôm nay/);
  assert.ok(e['ag-4.norms.kcal']);
  assert.match(e['ag-4.norms.protein'], /100%/);
  assert.ok(e['ag-3.meals'], 'thiếu bữa chiều gốc');
  assert.ok(e['ag-3.meals.0.name']);
  assert.ok(e['ag-3.price'], 'giá ngày phải lớn hơn 0');
  assert.ok(e['ag-3.meals.1.countAs']);
});

test('dữ liệu hợp lệ không có lỗi', () => {
  assert.deepEqual(validateNutritionSetup({ effectiveFrom: TODAY, groups: [group()] }, TODAY), {});
});

test('đổi giá từ ngày mai: tạo mức giá mới, đóng mức cũ hôm nay, định mức áp dụng ngay', async () => {
  const setups = await repo.listNutritionSetups(VP);
  const form = toSetupForm(setups, TODAY);
  const tomorrow = addDays(TODAY, 1);
  const ag4 = form.groups.find((g) => g.ageGroupId === 'ag-4');
  ag4.price = '35000';
  ag4.meals.push({ code: '', name: 'Bữa phụ chiều', countAs: 'AFTERNOON' });
  ag4.norms.kcal = ['620', '730'];
  await repo.saveNutritionSetups(toSetupPayload({ ...form, effectiveFrom: tomorrow }), VP);

  const after = (await repo.listNutritionSetups(VP)).find((s) => s.ageGroupId === 'ag-4');
  const [next, prev] = after.prices;
  assert.equal(next.price, 35000);
  assert.equal(next.effectiveFrom, tomorrow);
  assert.equal(prev.effectiveTo, TODAY);
  assert.equal(after.meals.length, 3);
  assert.ok(after.meals[2].code, 'bữa thêm có mã');
  assert.equal(after.meals[2].countAs, 'AFTERNOON');
  const catalog = await repo.getCatalog(VP);
  assert.deepEqual(catalog.norms['ag-4'].kcal, [620, 730]);
  // Nhóm không đổi giá thì không sinh mức giá mới
  assert.equal(catalog.mealPrices.filter((p) => p.ageGroupId === 'ag-3').length, 2);
});

test('sửa lại giá đã áp dụng từ hôm nay phải có lý do', async () => {
  const form = toSetupForm(await repo.listNutritionSetups(VP), TODAY);
  form.groups[0].price = '33000';
  await repo.saveNutritionSetups(toSetupPayload(form), VP);
  form.groups[0].price = '33500';
  await assert.rejects(repo.saveNutritionSetups(toSetupPayload(form), VP), (e) => e.status === 422 && !!e.details.reason);
  await repo.saveNutritionSetups(toSetupPayload({ ...form, reason: 'Giá chợ tăng' }), VP);
  const ag = (await repo.listNutritionSetups(VP)).find((s) => s.ageGroupId === form.groups[0].ageGroupId);
  assert.equal(ag.prices[0].price, 33500);
});

test('HT chỉ xem được, không lưu được', async () => {
  const setups = await repo.listNutritionSetups(HT);
  assert.equal(setups.length, 4);
  // Số trẻ đang học của từng nhóm (để hiển thị), là số không âm
  assert.ok(setups.every((x) => Number.isInteger(x.childCount) && x.childCount >= 0));
  await assert.rejects(repo.saveNutritionSetups(toSetupPayload(toSetupForm(setups, TODAY)), HT), (e) => e.status === 403);
});
