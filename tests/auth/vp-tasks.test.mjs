import assert from 'node:assert/strict';
import { test } from 'node:test';

const {
  VP_AREA_STATE,
  applyVpPreset,
  setVpArea,
  setVpTask,
  setVpTaskScope,
  removeVpPreset,
  setVpCell,
  vpAreasView,
  vpCellOptions,
  vpChangePreview,
  vpDraftChanges,
  vpDraftOf,
  vpMatrixAreas,
  vpOverridesFromDraft,
  vpPresetsOf,
  vpTaskGaps,
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
  assert.deepEqual(
    overrides.find((o) => o.permission === 'STOCK_MANAGE'),
    { permission: 'STOCK_MANAGE', effect: 'GRANT', scope: 'CAMPUS' },
  );
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
  assert.deepEqual(
    areas.find((a) => a.key === 'other').tasks.map((t) => t.code),
    ['NEW_CODE'],
  );
  assert.equal(
    areas.flatMap((a) => a.tasks).some((t) => t.code === 'CHILD_PROFILE_VIEW'),
    false,
  );
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
  assert.deepEqual(
    vpDraftChanges(list, draft).map((i) => i.code),
    ['MENU_MANAGE', 'MEAL_COUNT_CONFIRM'],
  );
});

test('AUTH-20: ô chỉ cho chọn cả trường ở mã campusScoped; chọn Được sửa · Cả trường lưu GRANT SCHOOL', () => {
  const list = items();
  const tasks = new Map(
    vpAreasView(list)
      .flatMap((a) => a.tasks)
      .map((t) => [t.code, t]),
  );
  assert.deepEqual(vpCellOptions(tasks.get('STOCK_MANAGE')), ['VIEW', 'CAMPUS', 'SCHOOL']);
  assert.deepEqual(vpCellOptions(tasks.get('MENU_MANAGE')), ['VIEW', 'SCHOOL']);
  assert.deepEqual(vpCellOptions(tasks.get('CHILD_ENROLL')), ['VIEW', 'CAMPUS']);
  const draft = setVpCell(vpDraftOf(list), 'STOCK_MANAGE', 'SCHOOL');
  assert.deepEqual(vpOverridesFromDraft(list, draft), [{ permission: 'STOCK_MANAGE', effect: 'GRANT', scope: 'SCHOOL' }]);
  assert.equal(setVpCell(draft, 'STOCK_MANAGE', 'VIEW').STOCK_MANAGE.on, false);
});

test('AUTH-10: giao nhanh xong người đó mang nhãn, bỏ nhãn thì mảng về chỉ xem', () => {
  const list = items();
  const before = vpPresetsOf(list);
  assert.deepEqual(
    before.map((p) => [p.key, p.applied]),
    [
      ['nutrition', false],
      ['academic', true],
    ],
  );
  const draft = applyVpPreset(vpDraftOf(list), 'nutrition', list);
  assert.equal(vpPresetsOf(list, draft).find((p) => p.key === 'nutrition').applied, true);
  const off = removeVpPreset(draft, 'nutrition', list);
  assert.equal(areaOf(list, off, 'meals').state, VP_AREA_STATE.VIEW_ONLY);
  assert.equal(vpPresetsOf(list, setVpTask(draft, 'STOCK_MANAGE', false)).find((p) => p.key === 'nutrition').applied, false);
});

test('AUTH-14: bản xem trước nêu việc trước → sau và nhãn được thêm', () => {
  const list = items();
  const draft = applyVpPreset(vpDraftOf(list), 'nutrition', list);
  const preview = vpChangePreview(list, setVpCell(draft, 'STOCK_MANAGE', 'SCHOOL'), 'Cơ sở 1');
  assert.deepEqual(
    preview.rows.find((r) => r.code === 'STOCK_MANAGE'),
    {
      code: 'STOCK_MANAGE',
      label: preview.rows.find((r) => r.code === 'STOCK_MANAGE').label,
      before: 'Chỉ xem',
      after: 'Được sửa · Cả trường',
    },
  );
  assert.equal(preview.rows.find((r) => r.code === 'MENU_MANAGE').after, 'Được sửa · Cả trường');
  assert.equal(
    preview.rows.some((r) => r.code === 'MEAL_COUNT_CONFIRM'),
    false,
  );
  assert.deepEqual(preview.labelsAdded, ['Phụ trách dinh dưỡng']);
  // BE trả mã lộn thứ tự thì bản xem trước vẫn theo thứ tự việc trên bảng
  const reversed = vpChangePreview([...list].reverse(), draft, 'Cơ sở 1').rows.map((r) => r.code);
  assert.deepEqual(reversed, ['MENU_MANAGE', 'NUTRITION_MANAGE', 'STOCK_MANAGE', 'FOOD_SAFETY_APPROVE']);
  assert.deepEqual(preview.labelsRemoved, []);
});

test('AUTH-20: cảnh báo việc chưa ai được sửa theo điểm trường; GRANT SCHOOL phủ mọi điểm trường; Nhân sự không cảnh báo', () => {
  const campuses = [
    { id: '1', shortName: 'Cơ sở 1' },
    { id: '2', shortName: 'Cơ sở 2' },
  ];
  const a = { campusId: '1', items: items() };
  const b = { campusId: 2, items: items() };
  a.draft = setVpCell(vpDraftOf(a.items), 'STOCK_MANAGE', 'SCHOOL');
  b.draft = vpDraftOf(b.items);
  const gaps = vpTaskGaps([a, b], campuses);
  assert.equal(gaps.STOCK_MANAGE, undefined);
  assert.equal(gaps.MEAL_COUNT_CONFIRM, undefined);
  assert.deepEqual(gaps.FOOD_SAFETY_APPROVE, { campuses: ['Cơ sở 1', 'Cơ sở 2'] });
  assert.deepEqual(gaps.MENU_MANAGE, { all: true });
  assert.equal(gaps.ACCOUNT_MANAGE, undefined);
});

test('AUTH-10: dòng bảng gom mã của mọi người theo thứ tự mảng', () => {
  const a = { items: items().filter((i) => i.code !== 'STOCK_MANAGE') };
  const b = { items: items() };
  a.draft = vpDraftOf(a.items);
  b.draft = vpDraftOf(b.items);
  const areas = vpMatrixAreas([a, b]);
  assert.deepEqual(
    areas.map((area) => area.key),
    ['meals', 'children', 'staff'],
  );
  assert.deepEqual(
    areas[0].tasks.map((t) => t.code),
    ['MENU_MANAGE', 'NUTRITION_MANAGE', 'MEAL_COUNT_CONFIRM', 'STOCK_MANAGE', 'FOOD_SAFETY_APPROVE'],
  );
});
