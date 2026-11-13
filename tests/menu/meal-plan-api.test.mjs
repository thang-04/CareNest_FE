import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { createMealPlanApi } = await import('@/services/mealPlanApi');
const {
  addDish,
  blockSessions,
  cellItems,
  dayAllergenNotes,
  dayResult,
  draftFromPlan,
  evaluationGroups,
  evaluationSessions,
  gridSections,
  groupIssuesByDate,
  isDirty,
  issuesBySeverity,
  planBlocks,
  removeDish,
  resolveWeekStart,
  rowItems,
  setDayNote,
  setDayOff,
  toPlanRequest,
} = await import('@/utils/menu-planning/mealPlanGrid');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

const WEEK = '2026-11-02';
const DAYS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];

// MealPlanResponse theo contract BE sau khi beClient đổi id số sang chuỗi
const bePlan = (over = {}) => ({
  id: '5',
  weekStart: WEEK,
  status: 'DRAFT',
  publishedAt: null,
  canEdit: true,
  canPublish: true,
  publishable: false,
  blocks: [
    { block: 'NURSERY', sessions: ['MORNING', 'LUNCH', 'AFTERNOON'], ageGroupIds: ['11'] },
    { block: 'KINDERGARTEN', sessions: ['LUNCH', 'AFTERNOON'], ageGroupIds: ['13', '14'] },
  ],
  days: DAYS.map((date, i) => ({
    date,
    off: i === 4,
    note: i === 4 ? 'Nghỉ lễ' : null,
    items:
      i === 0
        ? [
            { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '30', dishName: 'Cơm trắng', dishType: 'CARB' },
            { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '31', dishName: 'Trứng hấp', dishType: 'MAIN' },
            { session: 'LUNCH', block: 'NURSERY', dishId: '30', dishName: 'Cơm trắng', dishType: 'CARB' },
          ]
        : [],
  })),
  evaluations: [
    {
      date: DAYS[0],
      ageGroupId: '13',
      ageGroupName: 'Mẫu giáo 4-5 tuổi',
      block: 'KINDERGARTEN',
      status: 'LOW',
      cost: 28000,
      mealPrice: 30000,
      rows: [],
    },
    {
      date: DAYS[1],
      ageGroupId: '13',
      ageGroupName: 'Mẫu giáo 4-5 tuổi',
      block: 'KINDERGARTEN',
      status: 'OK',
      cost: 29000,
      mealPrice: 30000,
      rows: [],
      sessions: [
        { session: 'AFTERNOON', kcal: 180, percent: 30, min: 25, max: 35, status: 'OK' },
        { session: 'LUNCH', kcal: 420, percent: 70, min: 40, max: 50, status: 'HIGH' },
      ],
    },
    {
      date: DAYS[0],
      ageGroupId: '11',
      ageGroupName: 'Nhà trẻ 24-36 tháng',
      block: 'NURSERY',
      status: 'OK',
      cost: 20000,
      mealPrice: 25000,
      rows: [],
    },
  ],
  issues: [
    {
      severity: 'WARNING',
      code: 'OVER_BUDGET',
      date: DAYS[1],
      ageGroupId: '13',
      block: 'KINDERGARTEN',
      dishId: null,
      message: 'Vượt giá suất ăn',
    },
    {
      severity: 'BLOCKING',
      code: 'NORM_NOT_SET',
      date: DAYS[0],
      ageGroupId: '13',
      block: 'KINDERGARTEN',
      dishId: null,
      message: 'Chưa đặt định mức',
    },
    { severity: 'BLOCKING', code: 'NO_DISHES', date: DAYS[0], ageGroupId: '11', block: 'NURSERY', dishId: null, message: 'Chưa có món' },
    { severity: 'INFO', code: 'ALLERGENS', date: null, ageGroupId: null, block: null, dishId: null, message: 'Cả tuần còn trống' },
  ],
  ...over,
});

const fakeClient = (responses = {}) => {
  const calls = [];
  const call = (method) => async (url, a, b) => {
    const isBody = method === 'post' || method === 'put';
    calls.push({ method, url, body: isBody ? a : undefined, params: isBody ? b?.params : a?.params });
    return responses[`${method.toUpperCase()} ${url}`];
  };
  return { calls, get: call('get'), post: call('post'), put: call('put') };
};

test('AC-2 NUT-13: lưới lưu theo khối, body PUT đúng { days[{ date, off, note, items[{ session, block, dishId }] }] }', () => {
  const draft = draftFromPlan(bePlan());
  assert.deepEqual(toPlanRequest(draft), {
    days: [
      {
        date: DAYS[0],
        off: false,
        note: '',
        items: [
          { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '30' },
          { session: 'LUNCH', block: 'KINDERGARTEN', dishId: '31' },
          { session: 'LUNCH', block: 'NURSERY', dishId: '30' },
        ],
      },
      { date: DAYS[1], off: false, note: '', items: [] },
      { date: DAYS[2], off: false, note: '', items: [] },
      { date: DAYS[3], off: false, note: '', items: [] },
      { date: DAYS[4], off: true, note: 'Nghỉ lễ', items: [] },
    ],
  });
  // Tên món chỉ để hiện, không gửi đi
  assert.ok(draft.days[0].items.every((item) => item.dishName));
  assert.ok(
    toPlanRequest(draft).days.every((day) => day.items.every((item) => Object.keys(item).sort().join() === 'block,dishId,session')),
  );
});

test('thêm / bỏ món theo ô (khối, bữa); món trùng trong ô bị bỏ qua; ô các khối không lẫn nhau', () => {
  let draft = draftFromPlan(bePlan());
  draft = addDish(draft, DAYS[1], 'NURSERY', 'MORNING', { id: 40, name: 'Sữa chua', type: 'DESSERT' });
  draft = addDish(draft, DAYS[1], 'NURSERY', 'MORNING', { id: '40', name: 'Sữa chua', type: 'DESSERT' });
  draft = addDish(draft, DAYS[1], 'KINDERGARTEN', 'LUNCH', { id: '40', name: 'Sữa chua', type: 'DESSERT' });
  const day = draft.days[1];
  assert.deepEqual(
    cellItems(day, 'NURSERY', 'MORNING').map((i) => i.dishId),
    ['40'],
  );
  assert.deepEqual(
    cellItems(day, 'KINDERGARTEN', 'LUNCH').map((i) => i.dishId),
    ['40'],
  );
  assert.equal(day.items[0].dishName, 'Sữa chua');
  draft = removeDish(draft, DAYS[1], 'NURSERY', 'MORNING', 40);
  assert.deepEqual(cellItems(draft.days[1], 'NURSERY', 'MORNING'), []);
  assert.equal(cellItems(draft.days[1], 'KINDERGARTEN', 'LUNCH').length, 1);
});

test('ngày nghỉ: yêu cầu gửi đi không mang món nhưng bản nháp giữ món để bỏ nghỉ thì khôi phục', () => {
  const saved = draftFromPlan(bePlan());
  let draft = setDayOff(saved, DAYS[0], true);
  draft = setDayNote(draft, DAYS[0], '  Nghỉ họp  ');
  const request = toPlanRequest(draft).days[0];
  assert.deepEqual(request, { date: DAYS[0], off: true, note: 'Nghỉ họp', items: [] });
  assert.equal(draft.days[0].items.length, 3);
  assert.equal(isDirty(draft, saved), true);
  const restored = setDayNote(setDayOff(draft, DAYS[0], false), DAYS[0], '');
  assert.equal(isDirty(restored, saved), false);
  assert.equal(isDirty(saved, saved), false);
});

test('đồng bộ BE: khối, bữa từng khối theo thứ tự trong ngày, đánh giá gom theo nhóm tuổi', () => {
  const plan = bePlan();
  assert.deepEqual(planBlocks(plan), ['NURSERY', 'KINDERGARTEN']);
  assert.deepEqual(blockSessions(plan, 'NURSERY'), ['MORNING', 'LUNCH', 'AFTERNOON']);
  assert.deepEqual(blockSessions(plan, 'KINDERGARTEN'), ['LUNCH', 'AFTERNOON']);
  assert.deepEqual(blockSessions(plan, 'OTHER'), []);
  const groups = evaluationGroups(plan, 'KINDERGARTEN');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].ageGroupName, 'Mẫu giáo 4-5 tuổi');
  assert.deepEqual(Object.keys(groups[0].byDate), [DAYS[0], DAYS[1]]);
  assert.deepEqual(evaluationSessions(groups[0]), ['LUNCH', 'AFTERNOON'], 'bữa có % năng lượng (NUT-25), theo thứ tự trong ngày');
  assert.deepEqual(evaluationSessions(evaluationGroups(plan, 'NURSERY')[0]), []);
  assert.deepEqual(planBlocks(null), []);
});

test('AC-1 NUT-08: lỗi chặn gom theo ngày kèm nhóm tuổi và lý do; cảnh báo / lưu ý tách riêng', () => {
  const plan = bePlan();
  const { blocking, warning, info } = issuesBySeverity(plan.issues);
  assert.deepEqual([blocking.length, warning.length, info.length], [2, 1, 1]);
  const groups = groupIssuesByDate(blocking);
  assert.deepEqual(
    groups.map((g) => [g.date, g.label, g.issues.length]),
    [[DAYS[0], 'Thứ Hai 02/11', 2]],
  );
  const all = groupIssuesByDate(plan.issues);
  assert.deepEqual(
    all.map((g) => g.label),
    ['Thứ Hai 02/11', 'Thứ Ba 03/11', 'Cả tuần'],
  );
  assert.equal(all[0].issues[0].severity, 'BLOCKING');
});

test('bố cục sổ thực đơn: dải theo bữa, bữa trưa tách loại món; bản chỉ xem ẩn loại món không dùng', () => {
  const draft = draftFromPlan(bePlan());
  const sessions = ['LUNCH', 'AFTERNOON'];
  const edit = gridSections(draft, 'KINDERGARTEN', sessions);
  assert.deepEqual(
    edit.map((s) => [s.session, s.rows.map((r) => r.label)]),
    [
      ['LUNCH', ['Cơm', 'Món mặn', 'Canh', 'Món rau', 'Tráng miệng']],
      ['AFTERNOON', ['Món']],
    ],
  );
  const view = gridSections(draft, 'KINDERGARTEN', sessions, { keepEmpty: false });
  assert.deepEqual(
    view[0].rows.map((r) => r.type),
    ['CARB', 'MAIN'],
  );
  const monday = draft.days[0];
  assert.deepEqual(
    rowItems(monday, 'KINDERGARTEN', 'LUNCH', view[0].rows[1]).map((i) => i.dishName),
    ['Trứng hấp'],
  );
  assert.deepEqual(rowItems(monday, 'KINDERGARTEN', 'AFTERNOON', edit[1].rows[0]), []);
});

test('đầu cột: nhãn theo kết quả BE đã lưu; hàng dị ứng lấy chất của món theo danh mục', () => {
  const plan = bePlan();
  assert.deepEqual(dayResult(plan, DAYS[0]), { tone: 'red', label: '2 lưu ý' });
  assert.deepEqual(dayResult(plan, DAYS[1]), { tone: 'orange', label: '1 lưu ý' });
  // Ngày chưa được BE kiểm (không có đánh giá) thì không gắn nhãn "Đạt"
  assert.equal(dayResult(plan, DAYS[2]), null);
  assert.deepEqual(dayResult({ ...plan, issues: [] }, DAYS[1]), { tone: 'green', label: 'Đạt' });
  const draft = draftFromPlan(plan);
  const dishById = { 31: { id: '31', allergens: ['Trứng'] }, 30: { id: '30', allergens: [] } };
  assert.deepEqual(dayAllergenNotes(draft.days[0], 'KINDERGARTEN', dishById), [
    { key: 'LUNCH|31', dish: 'Trứng hấp', allergens: ['Trứng'] },
  ]);
  assert.deepEqual(dayAllergenNotes(draft.days[0], 'NURSERY', dishById), []);
});

test('tuần mở từ URL luôn quy về thứ Hai; thiếu hoặc sai ngày thì lấy tuần hôm nay', () => {
  assert.equal(resolveWeekStart('2026-11-04', '2026-11-03'), '2026-11-02');
  assert.equal(resolveWeekStart('2026-11-02', '2026-11-10'), '2026-11-02');
  assert.equal(resolveWeekStart(null, '2026-11-05'), '2026-11-02');
  assert.equal(resolveWeekStart('abc', '2026-11-08'), '2026-11-09');
});

test('adapter: đúng đường dẫn BE; lưu nháp gửi body từ bản nháp; công bố POST /publish', async () => {
  const published = bePlan({ status: 'PUBLISHED', canEdit: false, canPublish: false, publishable: false });
  const client = fakeClient({
    'GET /nutrition/meal-plans': [{ id: '5', weekStart: WEEK, status: 'DRAFT', publishedAt: null }],
    [`GET /nutrition/meal-plans/${WEEK}`]: bePlan({ blocks: undefined, issues: undefined }),
    [`PUT /nutrition/meal-plans/${WEEK}`]: bePlan(),
    [`POST /nutrition/meal-plans/${WEEK}/publish`]: published,
  });
  const api = createMealPlanApi({ client });
  assert.equal((await api.listPlans({ from: WEEK, to: '2026-11-30' })).length, 1);
  assert.deepEqual(client.calls[0].params, { from: WEEK, to: '2026-11-30' });
  const plan = await api.getPlan(WEEK);
  assert.deepEqual([plan.blocks, plan.issues], [[], []], 'thiếu mảng thì chuẩn hóa về rỗng');
  assert.equal(plan.days.length, 5);

  const saved = await api.savePlan(WEEK, draftFromPlan(bePlan()));
  assert.equal(client.calls[2].method, 'put');
  assert.deepEqual(client.calls[2].body, toPlanRequest(draftFromPlan(bePlan())));
  assert.equal(saved.canEdit, true);

  const done = await api.publishPlan(WEEK);
  assert.deepEqual([client.calls[3].method, client.calls[3].url], ['post', `/nutrition/meal-plans/${WEEK}/publish`]);
  assert.equal(done.status, 'PUBLISHED');
  assert.equal(done.canEdit, false);
});

test('công bố bị BE từ chối (409) thì lỗi giữ nguyên status để màn nạp lại và hiện issues', async () => {
  const conflict = Object.assign(new Error('Tuần còn lỗi chặn: chưa đặt định mức'), { status: 409, errorCode: 6039 });
  const client = { get: async () => bePlan(), post: async () => Promise.reject(conflict) };
  const api = createMealPlanApi({ client });
  await assert.rejects(
    () => api.publishPlan(WEEK),
    (error) => error.status === 409 && error.errorCode === 6039 && /định mức/.test(error.message),
  );
  const refreshed = await api.getPlan(WEEK);
  assert.equal(groupIssuesByDate(issuesBySeverity(refreshed.issues).blocking).length, 1);
});

test('module meal-plan khai source api cho /menu/weekly, /menu/statistics và /menu/nutrition (Cân đối khẩu phần)', () => {
  const mod = INTEGRATION_MODULES['meal-plan'];
  assert.equal(mod.source, 'api');
  assert.deepEqual(mod.routes, ['/menu/weekly', '/menu/statistics', '/menu/nutrition']);
  assert.deepEqual(mod.files, ['src/services/mealPlanApi.js']);
});
