import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { menuPlanningMockRepository: repo } = await import('@/services/menu-planning/mock/menuPlanningMockRepository');
const { checkDayMenu } = await import('@/utils/menu-planning/menuChecks');
const { byId } = await import('@/utils/menu-planning/menuCalculations');
const { addDays, schoolWeekStart } = await import('@/models/menu-planning/menuPlanningConstants');
const { todayInput } = await import('@/utils/format');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
// Seed tự có thực đơn tuần trước, tuần này, tuần sau so với hôm nay (buildRecentWeeklyMenus): test dùng từ 2 tuần sau.
const WEEK = addDays(schoolWeekStart(todayInput()), 14);

beforeEach(() => values.clear());

test('AI soạn tuần: bản nháp 5 ngày có lý do từng ngày, chỉ số trẻ dị ứng tổng hợp (không tên trẻ)', async () => {
  const d = await repo.generateAiSuggestion({ kind: 'WEEKLY', ageGroupId: 'ag-4', weekStart: WEEK, noRepeatDays: 7, season: 'Thu' }, VP);
  assert.equal(d.status, 'PENDING_REVIEW');
  assert.equal(d.days.length, 5);
  assert.ok(d.days.every((x) => x.reasons === undefined && d.reasons[x.date]));
  assert.ok(d.allergyCounts.every((r) => Object.keys(r).sort().join() === 'allergen,childCount'));
  assert.ok(!JSON.stringify(d).includes('fullName'));
  const wm = await repo.saveWeeklyMenu(null, { ageGroupId: 'ag-4', weekStart: WEEK, days: d.days, aiDraftId: d.id }, VP);
  assert.equal(wm.aiDraftId, d.id);
});

test('AI đề xuất sửa ngày: bữa trống thì thêm món; áp dụng ghi vào ngày và đánh dấu bản nháp đã dùng; xử lý lại bị chặn', async () => {
  // Dữ liệu mock giữ trong bộ nhớ giữa các test: dùng tuần khác test trước
  const week2 = addDays(WEEK, 7);
  const draftWeek = await repo.generateAiSuggestion({ kind: 'WEEKLY', ageGroupId: 'ag-4', weekStart: week2 }, VP);
  const wm = await repo.saveWeeklyMenu(null, { ageGroupId: 'ag-4', weekStart: week2, days: draftWeek.days }, VP);
  const day = wm.days[0];
  const meals = day.meals.map((m) => (m.session === 'AFTERNOON' ? { ...m, items: [] } : m));
  const fix = await repo.generateAiSuggestion({ kind: 'DAY_FIX', ageGroupId: 'ag-4', date: day.date, meals, weeklyMenuId: wm.id }, VP);
  assert.equal(fix.proposal.session, 'AFTERNOON');
  assert.equal(fix.proposal.fromDishId, null);
  assert.match(fix.reason, /đang trống nên thêm một món/);
  const after = await repo.applyDayFix(fix.id, wm.id, VP);
  const afternoon = after.days[0].meals.find((m) => m.session === 'AFTERNOON');
  assert.ok(afternoon.items.some((i) => i.dishId === fix.proposal.toDishId));
  await assert.rejects(repo.applyDayFix(fix.id, wm.id, VP), (e) => e.status === 409);
});

test('AI soạn tuần ưu tiên ngày đạt kiểm tra; ngày không có mẫu đạt thì nói rõ thiếu thực đơn mẫu', async () => {
  const week3 = addDays(WEEK, 14);
  const d = await repo.generateAiSuggestion({ kind: 'WEEKLY', ageGroupId: 'ag-4', weekStart: week3 }, VP);
  const c = await repo.getCatalog(VP);
  const catalog = { ...c, dishById: byId(c.dishes), foodById: byId(c.foods) };
  const allergyRows = await repo.getAllergyContext('ag-4', VP);
  // Kiểm tra giống màn hình: tính cả trẻ dị ứng và suất thay thế của thực đơn mẫu
  const problemsOf = (meals, date, menuId) =>
    checkDayMenu({
      meals,
      ageGroupId: 'ag-4',
      catalog,
      date,
      allergyRows,
      allergyMenus: c.allergyMenus.filter((a) => a.baseMenuId === menuId),
    }).problems;
  const passing = c.menus.filter((m) => m.ageGroupId === 'ag-4' && m.status === 'ACTIVE' && !problemsOf(m.meals, week3, m.id).length);
  d.days.forEach((day) => {
    const ok = !problemsOf(day.meals, day.date, day.menuId).length;
    if (ok) assert.match(d.reasons[day.date], /^Đủ chất/);
    else assert.match(d.reasons[day.date], /^Không có thực đơn mẫu nào đạt/);
  });
  // Có mẫu đạt thì ít nhất một ngày dùng mẫu đạt; shortage khớp số ngày chưa đạt và có lời nhắn
  if (passing.length) assert.ok(d.days.some((day) => passing.some((m) => m.id === day.menuId)));
  assert.equal(Boolean(d.note), d.shortage > 0);
});

test('gợi ý sửa ngày không bao giờ đưa món có chất mà nhóm có trẻ dị ứng', async () => {
  const week4 = addDays(WEEK, 21);
  const d = await repo.generateAiSuggestion({ kind: 'WEEKLY', ageGroupId: 'ag-4', weekStart: week4 }, VP);
  const c = await repo.getCatalog(VP);
  const foodById = byId(c.foods);
  const allergyRows = await repo.getAllergyContext('ag-4', VP);
  const { dishAllergens, sameAllergen } = await import('@/utils/menu-planning/menuCalculations');
  for (const day of d.days) {
    const fix = await repo
      .generateAiSuggestion({ kind: 'DAY_FIX', ageGroupId: 'ag-4', date: day.date, meals: day.meals, menuId: day.menuId }, VP)
      .catch(() => null);
    if (!fix) continue;
    const to = c.dishes.find((x) => x.id === fix.proposal.toDishId);
    assert.ok(!dishAllergens(to, foodById).some((a) => allergyRows.some((r) => sameAllergen(r.allergen, a))), to.name);
  }
});

test('đề xuất sửa ngày cần có ngày và món của ngày đó', async () => {
  await assert.rejects(repo.generateAiSuggestion({ kind: 'DAY_FIX', ageGroupId: 'ag-4' }, VP), (e) => e.status === 422);
});
