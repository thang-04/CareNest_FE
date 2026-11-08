import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  VP_AREA_STATE,
  applyVpPreset,
  setVpArea,
  setVpTask,
  setVpTaskScope,
  vpAreasView,
  vpCoverage,
  vpDraftChanges,
  vpDraftOf,
  vpOverridesFromDraft,
  vpViewOff,
} = await import('@/utils/account/vpTasks');

const item = (code, { roleOn = false, on = roleOn, effect = 'INHERIT', scope = null, campusScoped = false } = {}) => ({
  code,
  label: code,
  roleOn,
  on,
  effect,
  scope,
  campusScoped,
});

// Mặc định của PHT theo seed: số suất và hồ sơ trẻ bật, mã bán trú còn lại tắt
const items = () => [
  item('CHILD_PROFILE_VIEW', { roleOn: true }),
  item('MENU_MANAGE'),
  item('NUTRITION_MANAGE'),
  item('MEAL_COUNT_CONFIRM', { roleOn: true, campusScoped: true }),
  item('STOCK_MANAGE', { campusScoped: true }),
  item('FOOD_SAFETY_APPROVE', { campusScoped: true }),
  item('CHILD_ENROLL', { roleOn: true }),
  item('CHILD_PROFILE_EDIT', { roleOn: true }),
  item('CHILD_PLACEMENT', { roleOn: true }),
  item('PARENT_ACCOUNT_MANAGE', { roleOn: true }),
  item('STAFF_ASSIGNMENT_MANAGE', { roleOn: true }),
  item('ACCOUNT_MANAGE'),
  item('ACCOUNT_STATUS_MANAGE'),
];

const areaOf = (list, draft, key) => vpAreasView(list, draft).find((area) => area.key === key);

test('AUTH-10: giữ nguyên mặc định thì không lưu ngoại lệ nào', () => {
  const list = items();
  assert.deepEqual(vpOverridesFromDraft(list, vpDraftOf(list)), []);
});

test('AUTH-10: bật mã mặc định tắt là GRANT, tắt mã mặc định bật là REVOKE', () => {
  const list = items();
  let draft = setVpTask(vpDraftOf(list), 'MENU_MANAGE', true);
  draft = setVpTask(draft, 'CHILD_ENROLL', false);
  assert.deepEqual(vpOverridesFromDraft(list, draft), [
    { permission: 'MENU_MANAGE', effect: 'GRANT' },
    { permission: 'CHILD_ENROLL', effect: 'REVOKE' },
  ]);
});

test('AUTH-20: mã mặc định bật chọn cả trường vẫn phải lưu GRANT SCHOOL, chọn lại điểm trường thì bỏ', () => {
  const list = items();
  const school = setVpTaskScope(vpDraftOf(list), 'MEAL_COUNT_CONFIRM', 'SCHOOL');
  assert.deepEqual(vpOverridesFromDraft(list, school), [{ permission: 'MEAL_COUNT_CONFIRM', effect: 'GRANT', scope: 'SCHOOL' }]);

  const saved = list.map((i) => (i.code === 'MEAL_COUNT_CONFIRM' ? { ...i, effect: 'GRANT', scope: 'SCHOOL' } : i));
  assert.equal(vpDraftOf(saved).MEAL_COUNT_CONFIRM.scope, 'SCHOOL');
  assert.deepEqual(vpOverridesFromDraft(saved, setVpTaskScope(vpDraftOf(saved), 'MEAL_COUNT_CONFIRM', 'CAMPUS')), []);
});

test('AUTH-20: giữ phạm vi đã lưu của ngoại lệ khác khi chỉ sửa một việc', () => {
  const list = items().map((i) => (i.code === 'STOCK_MANAGE' ? { ...i, on: true, effect: 'GRANT', scope: 'SCHOOL' } : i));
  const overrides = vpOverridesFromDraft(list, setVpTask(vpDraftOf(list), 'MENU_MANAGE', true));
  assert.deepEqual(
    overrides.find((o) => o.permission === 'STOCK_MANAGE'),
    { permission: 'STOCK_MANAGE', effect: 'GRANT', scope: 'SCHOOL' },
  );
});

test('AUTH-20: REVOKE và mã không theo mảng không gửi scope; GRANT theo mảng gửi CAMPUS tường minh', () => {
  const list = items();
  let draft = setVpTask(vpDraftOf(list), 'STOCK_MANAGE', true);
  draft = setVpTask(draft, 'NUTRITION_MANAGE', true);
  draft = setVpTask(draft, 'MEAL_COUNT_CONFIRM', false);
  const overrides = vpOverridesFromDraft(list, draft);
  assert.deepEqual(overrides.find((o) => o.permission === 'STOCK_MANAGE'), { permission: 'STOCK_MANAGE', effect: 'GRANT', scope: 'CAMPUS' });
  assert.equal('scope' in overrides.find((o) => o.permission === 'NUTRITION_MANAGE'), false);
  assert.equal('scope' in overrides.find((o) => o.permission === 'MEAL_COUNT_CONFIRM'), false);
});

test('AUTH-20: chỉ mã campusScoped mới chọn được nơi áp dụng; thực đơn cố định cả trường', () => {
  const list = items();
  const meals = areaOf(list, vpDraftOf(list), 'meals');
  assert.equal(meals.tasks.find((t) => t.code === 'MENU_MANAGE').choosable, false);
  assert.equal(meals.tasks.find((t) => t.code === 'MENU_MANAGE').place, 'SCHOOL');
  assert.equal(meals.tasks.find((t) => t.code === 'STOCK_MANAGE').choosable, true);
  assert.equal(areaOf(list, vpDraftOf(list), 'children').tasks[0].place, 'CAMPUS');
});

test('AUTH-10: giao nhanh dinh dưỡng bật đủ 5 việc bán trú, không đổi mảng khác', () => {
  const list = items();
  const base = setVpTask(vpDraftOf(list), 'CHILD_ENROLL', false);
  const draft = applyVpPreset(base, 'nutrition', list);
  const meals = areaOf(list, draft, 'meals');
  assert.equal(meals.onCount, 5);
  assert.equal(meals.state, VP_AREA_STATE.ALL);
  assert.equal(draft.CHILD_ENROLL.on, false);
  assert.equal(draft.ACCOUNT_MANAGE.on, false);
});

test('AUTH-10: trạng thái mảng theo số việc đang bật; tắt cả mảng về Chỉ xem', () => {
  const list = items();
  const draft = vpDraftOf(list);
  assert.equal(areaOf(list, draft, 'meals').state, VP_AREA_STATE.PARTIAL);
  assert.equal(areaOf(list, setVpArea(draft, areaOf(list, draft, 'meals'), false), 'meals').state, VP_AREA_STATE.VIEW_ONLY);
});

test('AUTH-10: mã BE mới chưa xếp mảng hiện ở Việc khác; quyền xem hồ sơ không là việc để giao', () => {
  const list = [...items(), item('NEW_CODE')];
  const areas = vpAreasView(list);
  assert.deepEqual(areas.find((a) => a.key === 'other').tasks.map((t) => t.code), ['NEW_CODE']);
  assert.equal(areas.flatMap((a) => a.tasks).some((t) => t.code === 'CHILD_PROFILE_VIEW'), false);
});

test('AUTH-20: quyền xem hồ sơ trẻ bị tắt thì báo để không ghi là xem được cả trường', () => {
  const list = items();
  assert.equal(vpViewOff(list), false);
  assert.equal(vpViewOff(list.map((i) => (i.code === 'CHILD_PROFILE_VIEW' ? { ...i, on: false } : i))), true);
});

test('AUTH-14: danh sách thay đổi gồm việc đổi bật/tắt và đổi nơi áp dụng', () => {
  const list = items();
  assert.deepEqual(vpDraftChanges(list, vpDraftOf(list)), []);
  let draft = setVpTask(vpDraftOf(list), 'MENU_MANAGE', true);
  draft = setVpTaskScope(draft, 'MEAL_COUNT_CONFIRM', 'SCHOOL');
  assert.deepEqual(vpDraftChanges(list, draft).map((i) => i.code), ['MENU_MANAGE', 'MEAL_COUNT_CONFIRM']);
});

test('AUTH-20: bảng ai phụ trách gì: chưa ai giữ mã là rỗng, GRANT SCHOOL tính cho mọi điểm trường', () => {
  const campuses = [{ id: '1' }, { id: '2' }];
  const a = {
    fullName: 'A',
    campusId: '1',
    items: items().map((i) => (i.code === 'STOCK_MANAGE' ? { ...i, on: true, effect: 'GRANT', scope: 'SCHOOL' } : i)),
  };
  const b = { fullName: 'B', campusId: 2, items: items() };
  const rows = Object.fromEntries(vpCoverage([a, b], campuses).map((row) => [row.key, row.cells]));
  assert.deepEqual(rows.stock.map((c) => c.names), [['A'], ['A']]);
  assert.deepEqual(rows.mealCount.map((c) => c.names), [['A'], ['B']]);
  assert.deepEqual(rows.foodSafety.map((c) => c.names), [[], []]);
  assert.deepEqual(rows.menu, [{ key: 'all', names: [] }]);
});
