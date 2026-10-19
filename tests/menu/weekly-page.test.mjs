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
const { weekIssues } = await import('@/utils/menu-planning/menuChecks');
const { byId } = await import('@/utils/menu-planning/menuCalculations');
const { getMenuForRole } = await import('@/layouts/menuConfig');
const { ROLES } = await import('@/models/User');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL' };
const HT = { id: 'u_hung', role: 'PRINCIPAL' };
const keysOf = (role) => getMenuForRole(role).flatMap((m) => (m.children || []).map((c) => c.key));

beforeEach(() => values.clear());

test('menu mới: HT có thực đơn tuần, PHT vào Quy trình và Thiết lập dinh dưỡng', () => {
  assert.ok(keysOf(ROLES.PRINCIPAL).includes('weeklyMenus'));
  assert.ok(keysOf(ROLES.PRINCIPAL).includes('nutritionSetup'));
  const vp = keysOf(ROLES.VICE_PRINCIPAL);
  assert.ok(vp.includes('menuFlow') && vp.includes('nutritionSetup'));
});

test('ngày cần xử lý: ngày chưa chọn thực đơn, món mặn lặp trong 7 ngày; ngày nghỉ bỏ qua', async () => {
  const c = await repo.getCatalog(VP);
  const catalog = { ...c, dishById: byId(c.dishes), foodById: byId(c.foods) };
  const menu = catalog.menus.find((m) => m.ageGroupId === 'ag-4');
  const day = (date, extra = {}) => ({ date, holiday: false, note: '', menuId: menu.id, meals: menu.meals, ...extra });
  const wm = {
    ageGroupId: 'ag-4',
    weekStart: '2026-10-19',
    days: [
      day('2026-10-19'),
      day('2026-10-20'),
      day('2026-10-21', { menuId: null, meals: [] }),
      day('2026-10-22', { holiday: true, menuId: null, meals: [], note: 'Nghỉ' }),
      day('2026-10-23'),
    ],
  };
  const issues = weekIssues({ wm, catalog });
  assert.ok(issues.some((x) => x.date === '2026-10-21' && x.tone === 'bad' && /Chưa chọn thực đơn/.test(x.text)));
  // Món lặp nêu rõ ngày đã ăn trước đó
  assert.ok(issues.some((x) => /^Món .+ lặp lại \(đã ăn Thứ (Hai|Ba|Tư|Năm|Sáu) \d\d\/10\)$/.test(x.text)));
  assert.ok(!issues.some((x) => x.date === '2026-10-22'));
  assert.deepEqual(
    issues.map((x) => x.date),
    [...issues.map((x) => x.date)].sort(),
  );
});

test('HT chỉ đọc được bản đã xuất bản của nhóm tuổi', async () => {
  const list = await repo.listWeeklyMenus({ ageGroupId: 'ag-4' }, HT);
  assert.ok(list.length > 0);
  assert.ok(list.every((w) => w.status === 'PUBLISHED'));
  await assert.rejects(repo.saveWeeklyMenu(null, { ageGroupId: 'ag-4', weekStart: '2026-11-02', days: [] }, HT), (e) => e.status === 403);
});
