import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { createMenuAiDraftApi, MENU_AI_DRAFT_TIMEOUT_MS } = await import('@/services/menuAiDraftApi');
const { fillTemplateDay, fixOptions, isPendingDraft, isUnmetDraft, sourceText, swapDish } = await import(
  '@/utils/menu-planning/menuAiDraft'
);
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

const fakeClient = (reply = {}) => {
  const calls = [];
  const record = (method) => async (url, payload, config) => {
    calls.push({ method, url, payload, config });
    return reply;
  };
  return { calls, client: { get: record('GET'), post: record('POST'), put: record('PUT') } };
};

test('AC-1, AC-4: tạo nháp gửi đúng route, bỏ ô trống; kết quả chuẩn hóa mảng', async () => {
  const { calls, client } = fakeClient({ id: '12', status: 'PENDING_REVIEW', days: [{ date: '2026-11-16' }] });
  const api = createMenuAiDraftApi({ client });

  const draft = await api.createDraft({
    kind: 'MENU_DAY_FIX',
    block: 'KINDERGARTEN',
    weekStart: '2026-11-16',
    season: '',
    wishes: null,
    targetDate: '2026-11-16',
    targetSession: 'LUNCH',
    fromDishId: '31',
  });

  assert.deepEqual(calls[0], {
    method: 'POST',
    url: '/nutrition/menu-ai-drafts',
    payload: {
      kind: 'MENU_DAY_FIX',
      block: 'KINDERGARTEN',
      weekStart: '2026-11-16',
      targetDate: '2026-11-16',
      targetSession: 'LUNCH',
      fromDishId: '31',
    },
    config: { timeout: MENU_AI_DRAFT_TIMEOUT_MS },
  });
  assert.deepEqual(draft.days[0].items, []);
  assert.deepEqual(draft.checks, []);
  assert.deepEqual(draft.issues, []);
});

test('NUT-11: thực phẩm đang thiếu gửi kèm khi có chọn, không chọn thì không gửi trường này', async () => {
  const { calls, client } = fakeClient({ id: '13', status: 'PENDING_REVIEW' });
  const api = createMenuAiDraftApi({ client });

  await api.createDraft({ kind: 'MENU_WEEKLY', block: 'NURSERY', weekStart: '2026-11-23', unavailableFoodIds: [4, 9] });
  await api.createDraft({ kind: 'MENU_WEEKLY', block: 'NURSERY', weekStart: '2026-11-23', unavailableFoodIds: [] });

  assert.deepEqual(calls[0].payload.unavailableFoodIds, [4, 9]);
  assert.equal('unavailableFoodIds' in calls[1].payload, false);
});

test('dùng, bỏ, đánh dấu đã dùng mẫu ngày, xem nháp gọi đúng route BE', async () => {
  const { calls, client } = fakeClient({});
  const api = createMenuAiDraftApi({ client });

  await api.getDraft('7');
  await api.dismissDraft('7');
  await api.applyDraft('7');
  await api.markDailyUsed('7');

  assert.deepEqual(
    calls.map((c) => `${c.method} ${c.url}`),
    [
      'GET /nutrition/menu-ai-drafts/7',
      'POST /nutrition/menu-ai-drafts/7/dismiss',
      'POST /nutrition/menu-ai-drafts/7/apply',
      'POST /nutrition/menu-ai-drafts/7/mark-used',
    ],
  );
});

test('AC-1, AC-2: nguồn kèm lý do dự phòng; chỉ nháp chờ duyệt mới dùng được', () => {
  assert.equal(sourceText({ source: 'AI' }), 'AI gợi ý');
  assert.equal(sourceText({ source: 'RULE_BASED', fallbackReason: 'AI_DISABLED' }), 'Theo quy tắc · AI đang tắt');
  assert.equal(sourceText({ status: 'NO_FEASIBLE', source: null }), '');
  assert.equal(isPendingDraft({ status: 'PENDING_REVIEW' }), true);
  assert.equal(isPendingDraft({ status: 'NO_FEASIBLE' }), false);
  assert.equal(isPendingDraft(null), false);
});

test('AC-7: nháp chưa đạt định mức vẫn hiện món kèm cảnh báo và dùng được; không có phương án thì không', () => {
  assert.equal(isUnmetDraft({ status: 'PENDING_REVIEW', feasible: false }), true);
  assert.equal(isUnmetDraft({ status: 'PENDING_REVIEW', feasible: true }), false);
  assert.equal(isUnmetDraft({ status: 'PENDING_REVIEW' }), false);
  assert.equal(isUnmetDraft({ status: 'NO_FEASIBLE', feasible: false }), false);
  assert.equal(isPendingDraft({ status: 'PENDING_REVIEW', feasible: false }), true);

  const result = readFileSync('src/components/menu-planning/MenuAiDraftResult.jsx', 'utf8');
  assert.match(result, /isUnmetDraft\(draft\) && \(\s*<div className="alert alert--warning">/);
  assert.match(result, /\{!noPlan && \(\s*<MenuAiDraftGrid/);
});

test('AC-4: món để thay lấy từ bản đã lưu của đúng khối, bỏ ngày nghỉ', () => {
  const plan = {
    days: [
      {
        date: '2026-11-16',
        off: false,
        items: [
          { session: 'LUNCH', block: 'KINDERGARTEN', dishId: 31, dishName: 'Thịt rim' },
          { session: 'LUNCH', block: 'NURSERY', dishId: 32, dishName: 'Cháo' },
        ],
      },
      { date: '2026-11-17', off: true, items: [{ session: 'LUNCH', block: 'KINDERGARTEN', dishId: 33 }] },
    ],
  };

  assert.deepEqual(fixOptions(plan, 'KINDERGARTEN'), [
    { key: '2026-11-16|LUNCH|31', date: '2026-11-16', session: 'LUNCH', dishId: '31', dishName: 'Thịt rim' },
  ]);
  assert.deepEqual(fixOptions(null, 'KINDERGARTEN'), []);
});

test('AC-5: mẫu ngày thay toàn bộ món của ngày đang sửa, giữ ngày khác', () => {
  const day = { weekNo: 1, weekday: 2 };
  const items = [
    { weekNo: 1, weekday: 1, session: 'LUNCH', dishId: '1', dishName: 'Cơm' },
    { weekNo: 1, weekday: 2, session: 'LUNCH', dishId: '2', dishName: 'Cũ' },
  ];
  const draft = { days: [{ date: null, items: [{ session: 'LUNCH', dishId: 9, dishName: 'Mới', dishType: 'MAIN' }] }] };

  assert.deepEqual(fillTemplateDay(items, day, draft), [
    { weekNo: 1, weekday: 1, session: 'LUNCH', dishId: '1', dishName: 'Cơm' },
    { weekNo: 1, weekday: 2, session: 'LUNCH', dishId: '9', dishName: 'Mới', dishType: 'MAIN' },
  ]);
});

test('module menu-ai nối BE thật, route chưa vào dev khai pending đủ 7 lời gọi', () => {
  const module = INTEGRATION_MODULES['menu-ai'];
  assert.equal(module.source, 'api');
  assert.deepEqual(module.files, ['src/services/menuAiDraftApi.js']);
  assert.equal(module.pending.length, 7);
});

test('AC-3, AC-6: nút AI chỉ hiện khi sửa được; dùng gợi ý tuần bị khóa khi còn thay đổi chưa lưu', () => {
  const weekly = readFileSync('src/pages/menu-planning/WeeklyPlanPage.jsx', 'utf8');
  const template = readFileSync('src/pages/menu-planning/MenuTemplateEditorPage.jsx', 'utf8');
  const modal = readFileSync('src/components/menu-planning/MenuAiWeekModal.jsx', 'utf8');

  assert.match(weekly, /\{editable && block && \(\s*<Button[^>]*onClick=\{\(\) => setAiOpen\(true\)\}/);
  assert.match(template, /\{editable && \(\s*<Button[^>]*onClick=\{\(\) => setAiOpen\(true\)\}/);
  assert.match(modal, /disabled=\{busy \|\| running \|\| dirty \|\| unchecked\}/);
  // Chấm lại lỗi hoặc đang chấm ⇒ chưa cho dùng bản đang sửa
  assert.match(modal, /const unchecked = editor\.editable && \(editor\.evaluating \|\| !!editor\.evaluateError\)/);
});

const {
  cellsOf,
  columnsOf,
  sectionsOf,
  replaceCell,
  swapCells,
  editedCount,
  candidatesBySlot,
  dropBlocker,
  toGridRequest,
  unmetDays,
  paletteDishes,
  nutritionRows,
  dataLimitNote,
  swapPool,
  swapOutcome,
  rankSwaps,
} = await import('@/utils/menu-planning/menuAiDraftGrid');

const weekDraft = {
  slots: [
    { key: 'LUNCH.1', session: 'LUNCH', index: 0, dishTypes: ['CARB'] },
    { key: 'LUNCH.2', session: 'LUNCH', index: 1, dishTypes: ['MAIN'] },
    { key: 'AFTERNOON.1', session: 'AFTERNOON', index: 0, dishTypes: ['SNACK'] },
  ],
  days: [
    {
      date: '2026-11-16',
      off: false,
      reason: 'Đổi món mặn',
      items: [
        { slot: 'LUNCH.1', session: 'LUNCH', dishId: 1, dishName: 'Cơm', dishType: 'CARB' },
        { slot: 'LUNCH.2', session: 'LUNCH', dishId: 31, dishName: 'Thịt rim', dishType: 'MAIN' },
        { slot: 'AFTERNOON.1', session: 'AFTERNOON', dishId: 50, dishName: 'Sữa', dishType: 'SNACK' },
      ],
    },
    { date: '2026-11-17', off: true, items: [] },
    {
      date: '2026-11-18',
      off: false,
      items: [
        { slot: 'LUNCH.1', session: 'LUNCH', dishId: 1, dishName: 'Cơm', dishType: 'CARB' },
        { slot: 'LUNCH.2', session: 'LUNCH', dishId: 32, dishName: 'Cá hấp', dishType: 'MAIN' },
        { slot: 'AFTERNOON.1', session: 'AFTERNOON', dishId: 50, dishName: 'Sữa', dishType: 'SNACK' },
      ],
    },
  ],
};
const candidates = {
  slots: [
    { key: 'LUNCH.1', dishes: [{ dishId: 1, dishName: 'Cơm', dishType: 'CARB' }] },
    {
      key: 'LUNCH.2',
      dishes: [
        { dishId: 31, dishName: 'Thịt rim', dishType: 'MAIN' },
        { dishId: 32, dishName: 'Cá hấp', dishType: 'MAIN' },
        { dishId: 33, dishName: 'Đậu sốt', dishType: 'MAIN' },
      ],
    },
    { key: 'AFTERNOON.1', dishes: [{ dishId: 50, dishName: 'Sữa', dishType: 'SNACK' }] },
  ],
};

test('AC-8: bảng gợi ý dựng đúng cột ngày, hàng theo bữa và ô; ngày nghỉ không có ô', () => {
  const cells = cellsOf(weekDraft);
  assert.deepEqual(Object.keys(cells), ['2026-11-16', '2026-11-18']);
  assert.deepEqual(cells['2026-11-16']['LUNCH.2'], { dishId: '31', dishName: 'Thịt rim', dishType: 'MAIN' });
  assert.deepEqual(
    columnsOf(weekDraft).map((c) => [c.key, c.off]),
    [
      ['2026-11-16', false],
      ['2026-11-17', true],
      ['2026-11-18', false],
    ],
  );
  assert.deepEqual(
    sectionsOf(weekDraft.slots).map((sec) => [sec.session, sec.slots.map((slot) => slot.key)]),
    [
      ['LUNCH', ['LUNCH.1', 'LUNCH.2']],
      ['AFTERNOON', ['AFTERNOON.1']],
    ],
  );
  // Mẫu ngày không có ngày ⇒ một cột khóa 'day'
  assert.deepEqual(Object.keys(cellsOf({ days: [{ date: null, items: [{ slot: 'LUNCH.1', dishId: 1 }] }] })), ['day']);
});

test('AC-9: thay món, đổi chỗ cùng hàng, đếm ô đã sửa và dựng request chấm thử', () => {
  const original = cellsOf(weekDraft);
  const replaced = replaceCell(original, '2026-11-16', 'LUNCH.2', { dishId: 33, dishName: 'Đậu sốt', dishType: 'MAIN' });
  assert.equal(replaced['2026-11-16']['LUNCH.2'].dishId, '33');
  assert.equal(original['2026-11-16']['LUNCH.2'].dishId, '31');
  assert.equal(editedCount(replaced, original), 1);
  assert.equal(editedCount(original, original), 0);

  const swapped = swapCells(original, '2026-11-16', '2026-11-18', 'LUNCH.2');
  assert.equal(swapped['2026-11-16']['LUNCH.2'].dishId, '32');
  assert.equal(swapped['2026-11-18']['LUNCH.2'].dishId, '31');
  assert.equal(editedCount(swapped, original), 2);

  assert.deepEqual(toGridRequest(replaced).days[0], {
    date: '2026-11-16',
    items: [
      { slot: 'LUNCH.1', dishId: 1 },
      { slot: 'LUNCH.2', dishId: 33 },
      { slot: 'AFTERNOON.1', dishId: 50 },
    ],
  });
});

test('AC-9: chỉ thả được món thuộc ứng viên của ô (hoặc món gợi ý gốc của ô), không lặp trong cùng bữa', () => {
  const original = cellsOf(weekDraft);
  const bySlot = candidatesBySlot(candidates);
  const at = (slot, dishId, cells = original) => dropBlocker({ cells, original, bySlot, day: '2026-11-16', slot, dishId });

  assert.equal(at('LUNCH.2', 33), '');
  assert.match(at('LUNCH.2', 50), /không dùng được/);
  assert.match(at('LUNCH.1', 31), /không dùng được/);
  // Món gợi ý gốc của chính ô đó vẫn đặt lại được dù không còn trong ứng viên
  assert.equal(dropBlocker({ cells: original, original, bySlot: {}, day: '2026-11-16', slot: 'LUNCH.2', dishId: 31 }), '');
  // Cùng bữa đã có món này ở ô khác
  const twoMains = { ...bySlot, 'LUNCH.1': [...bySlot['LUNCH.1'], { dishId: 31 }] };
  assert.match(dropBlocker({ cells: original, original, bySlot: twoMains, day: '2026-11-16', slot: 'LUNCH.1', dishId: 31 }), /cùng bữa/);
});

test('AC-10: số ngày chưa đạt theo lỗi chặn BE trả; cột món lọc theo ô đang chọn, không lặp khi chưa chọn', () => {
  const issues = [
    { severity: 'BLOCKING', date: '2026-11-16', message: 'Thừa năng lượng' },
    { severity: 'BLOCKING', date: '2026-11-16', message: 'Thiếu béo' },
    { severity: 'WARNING', date: '2026-11-18', message: 'Lặp món' },
  ];
  assert.equal(unmetDays(issues, columnsOf(weekDraft)), 1);
  assert.equal(unmetDays([], columnsOf(weekDraft)), 0);
  assert.deepEqual(
    paletteDishes(candidates, 'LUNCH.2').map((d) => d.dishId),
    [31, 32, 33],
  );
  assert.equal(paletteDishes(candidates).length, 5);
  assert.deepEqual(paletteDishes(null, 'LUNCH.2'), []);
});

test('AC-9: client gọi candidates, evaluate và apply kèm lưới đã sửa; apply không lưới giữ lời gọi cũ', async () => {
  const calls = [];
  const client = {
    get: async (url) => (calls.push({ method: 'GET', url }), { slots: [{ key: 'LUNCH.2' }] }),
    post: async (url, payload) => (calls.push({ method: 'POST', url, payload }), {}),
  };
  const api = createMenuAiDraftApi({ client });
  const grid = toGridRequest(cellsOf(weekDraft));

  assert.deepEqual(await api.getCandidates('7'), { slots: [{ key: 'LUNCH.2', dishes: [] }] });
  await api.evaluateDraft('7', grid);
  await api.applyDraft('7', grid);
  await api.applyDraft('7');

  assert.deepEqual(
    calls.map((c) => [c.method, c.url, c.payload === undefined ? 'none' : 'grid']),
    [
      ['GET', '/nutrition/menu-ai-drafts/7/candidates', 'none'],
      ['POST', '/nutrition/menu-ai-drafts/7/evaluate', 'grid'],
      ['POST', '/nutrition/menu-ai-drafts/7/apply', 'grid'],
      ['POST', '/nutrition/menu-ai-drafts/7/apply', 'none'],
    ],
  );
  assert.deepEqual(calls[1].payload, grid);
});

test('AC-10: dinh dưỡng cả ngày — hàng lõi luôn có, hàng gam chỉ khi có ngày lệch, không có vi chất', () => {
  const day = (date, lipidStatus) => ({
    date,
    ageGroupId: 3,
    ageGroupName: 'Nhà trẻ (24–36 tháng)',
    rows: [
      { key: 'kcal', value: 509.8, min: 600, max: 651, status: 'LOW', optional: false },
      { key: 'protein', value: 20, percent: 15.1, min: 13, max: 20, status: 'OK', optional: false },
      { key: 'lipid', value: 9, percent: 16.2, min: 25, max: 35, status: 'LOW', optional: false },
      { key: 'glucid', value: 80, percent: 67.5, min: 52, max: 60, status: 'HIGH', optional: false },
      { key: 'animalLipidG', value: 5.4, min: 8.7, max: 14.6, status: lipidStatus, optional: true },
      { key: 'plantLipidG', value: 8, min: 7, max: 12.2, status: 'OK', optional: true },
      { key: 'calcium', value: 100, min: 300, max: null, status: 'LOW', optional: true },
    ],
  });
  const evaluations = [day('2026-11-16', 'OK'), day('2026-11-17', 'LOW')];

  const { rows, ageGroupName, multiGroup } = nutritionRows(evaluations, ['2026-11-16', '2026-11-17', '2026-11-18'], { id: 3 });
  assert.deepEqual(
    rows.map((row) => row.key),
    ['kcal', 'protein', 'lipid', 'glucid', 'animalLipidG'],
  );
  // Cơ cấu đạm–béo–bột đường đọc % năng lượng BE trả, dòng khác đọc giá trị
  assert.deepEqual(rows[2], {
    key: 'lipid',
    share: true,
    min: 25,
    max: 35,
    cells: { '2026-11-16': { value: 16.2, status: 'LOW' }, '2026-11-17': { value: 16.2, status: 'LOW' } },
  });
  assert.deepEqual(rows[0].cells['2026-11-16'], { value: 509.8, status: 'LOW' });
  assert.equal(rows[4].cells['2026-11-17'].status, 'LOW');
  assert.equal(ageGroupName, 'Nhà trẻ (24–36 tháng)');
  assert.equal(multiGroup, false);
  // Không có nhóm tuổi đang xem ⇒ lấy nhóm đầu của ngày; chưa có số liệu ⇒ không có hàng
  assert.equal(nutritionRows(evaluations, ['2026-11-16'], { id: 99 }).rows.length, 4);
  assert.deepEqual(nutritionRows([], ['2026-11-16'], { id: 3 }).rows, []);
});

test('giới hạn dữ liệu: chỉ lấy câu của tiêu chí KCAL_REACH khi BE báo FAIL', () => {
  const detail = 'Nhà trẻ: chọn món nhiều năng lượng nhất ở mọi ô cũng chỉ đạt 539 kcal/ngày, dưới mức tối thiểu 600 kcal';
  assert.equal(
    dataLimitNote([
      { code: 'NORM_BALANCE', status: 'FAIL', detail: 'x' },
      { code: 'KCAL_REACH', status: 'FAIL', detail },
    ]),
    detail,
  );
  assert.equal(dataLimitNote([{ code: 'NORM_BALANCE', status: 'FAIL', detail: 'x' }]), '');
  assert.equal(dataLimitNote(null), '');
});

test('AI-07, P-39: swapDish đổi đúng món trong bữa, giữ thứ tự và món khác; nháp rỗng hoặc món cũ không còn ⇒ giữ nguyên', () => {
  const items = [
    { session: 'LUNCH', dishId: '1', dishName: 'Cơm', dishType: 'CARB', block: 'NURSERY' },
    { session: 'LUNCH', dishId: '2', dishName: 'Thịt rim', dishType: 'MAIN', block: 'NURSERY' },
    { session: 'AFTERNOON', dishId: '2', dishName: 'Thịt rim', dishType: 'MAIN', block: 'NURSERY' },
  ];
  const draft = { days: [{ items: [{ session: 'LUNCH', dishId: 9, dishName: 'Cá hấp', dishType: 'MAIN' }] }] };
  const swapped = swapDish(items, { session: 'LUNCH', fromDishId: 2 }, draft);

  assert.deepEqual(
    swapped.map((i) => [i.session, i.dishId, i.dishName]),
    [
      ['LUNCH', '1', 'Cơm'],
      ['LUNCH', '9', 'Cá hấp'],
      ['AFTERNOON', '2', 'Thịt rim'],
    ],
  );
  assert.equal(swapped[1].block, 'NURSERY');
  assert.equal(swapDish(items, { session: 'LUNCH', fromDishId: 2 }, { days: [] }), items);
  assert.equal(swapDish(items, { session: 'MORNING', fromDishId: 2 }, draft), items);
});

test('AI-02, NUT-05: swapPool bỏ món đang ở ô, món trùng bữa và món ngoài ứng viên; swapOutcome/rankSwaps chỉ đọc số BE chấm', () => {
  const day = '2026-11-16';
  const dish = (dishId, extra = {}) => ({ dishId, dishName: `Món ${dishId}`, dishType: 'MAIN', ...extra });
  const cells = { [day]: { 'LUNCH.1': dish('1'), 'LUNCH.2': dish('2') } };
  const bySlot = { 'LUNCH.1': [dish('1'), dish('2'), dish('3'), dish('4')] };

  // 1 là món đang ở ô, 2 đã nằm ở ô khác của bữa trưa
  assert.deepEqual(
    swapPool({ cells, original: cells, bySlot, day, slot: 'LUNCH.1' }).map((d) => d.dishId),
    ['3', '4'],
  );
  assert.equal(swapPool({ cells, original: cells, bySlot, day, slot: 'LUNCH.1', limit: 1 }).length, 1);

  const result = (kcalStatus, issues, total) => ({
    score: { total },
    issues,
    evaluations: [
      { date: day, ageGroupId: 7, rows: [{ key: 'kcal', value: 612.4, status: kcalStatus }] },
      { date: '2026-11-17', ageGroupId: 7, rows: [{ key: 'kcal', value: 1, status: 'LOW' }] },
    ],
  });
  const blocking = [{ severity: 'BLOCKING', date: day }];
  const ok = swapOutcome({ dish: dish('3'), result: result('OK', [], 80), date: day, baselineTotal: 75, ageGroup: { id: 7 } });
  assert.deepEqual([ok.blocking, ok.total, ok.delta, ok.kcal, ok.kcalStatus], [0, 80, 5, 612.4, 'OK']);
  // Lỗi chặn của ngày khác không tính vào ô đang xét
  const other = swapOutcome({
    dish: dish('4'),
    result: result('LOW', [{ severity: 'BLOCKING', date: '2026-11-17' }], 90),
    date: day,
    baselineTotal: null,
    ageGroup: { id: 7 },
  });
  assert.deepEqual([other.blocking, other.delta], [0, null]);

  const bad = swapOutcome({ dish: dish('5'), result: result('LOW', blocking, 99), date: day, baselineTotal: 75, ageGroup: { id: 7 } });
  const stockOut = swapOutcome({ dish: dish('6', { outOfStock: true }), result: result('OK', [], 80), date: day, baselineTotal: 75, ageGroup: {} });
  // Ít lỗi chặn thắng điểm cao; cùng kết quả thì món kho khô hết xuống sau
  assert.deepEqual(
    rankSwaps([bad, stockOut, ok]).map((o) => o.dish.dishId),
    ['3', '6', '5'],
  );
});
test('tạo nháp AI chờ lâu hơn hạn AI của BE, không bị cắt ở 15 giây mặc định', async () => {
  const { calls, client } = fakeClient({ id: '1', status: 'PENDING_REVIEW' });
  await createMenuAiDraftApi({ client }).createDraft({ kind: 'MENU_WEEKLY', block: 'KINDERGARTEN', weekStart: '2026-11-16' });
  assert.equal(calls[0].config.timeout, MENU_AI_DRAFT_TIMEOUT_MS);
  assert.ok(MENU_AI_DRAFT_TIMEOUT_MS > 30000 + 15000);
});
