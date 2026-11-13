import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { buildDayBoardRows, nextBoardTask } = await import('@/utils/boarding/dayBoardRows');
const { createDayBoardApi } = await import('@/services/dayBoardApi');
const { INTEGRATION_MODULES } = await import('@/config/integrationModules');

const DATE = '2026-11-03';

// Một điểm trường trong GET /nutrition/day-board (id đã đổi sang chuỗi)
const campus = (over = {}) => ({
  campusId: '1',
  campusName: 'Điểm trường chính',
  menu: { weekStart: '2026-11-02', status: 'PUBLISHED', dayOff: false, nextWeekStart: '2026-11-09', nextWeekStatus: 'NONE' },
  mealCounts: {
    status: 'CONFIRMED',
    totalServings: 120,
    sessions: [
      { session: 'LUNCH', servings: 60 },
      { session: 'AFTERNOON', servings: 60 },
    ],
  },
  dryStock: { status: 'DEDUCTED', foodCount: 8, shortfallFoodCount: 0, openShortfallCount: 0 },
  freshReceiptStatus: 'ROUND1_PENDING',
  foodSampleStatus: 'NONE',
  ...over,
});
const rowOf = (rows, key) => rows.find((row) => row.key === key);

test('hub luôn có đúng 5 dòng theo thứ tự thực đơn tuần, số suất, kho khô, hàng tươi, lưu mẫu', () => {
  const rows = buildDayBoardRows(campus(), { date: DATE });
  assert.deepEqual(
    rows.map((row) => [row.key, row.title]),
    [
      ['menu', 'Thực đơn tuần'],
      ['mealCount', 'Số suất'],
      ['dryStock', 'Kho khô'],
      ['freshReceipt', 'Hàng tươi lần 1/2'],
      ['foodSample', 'Lưu mẫu chờ duyệt'],
    ],
  );
  assert.equal(buildDayBoardRows({}, {}).length, 5, 'điểm trường thiếu dữ liệu vẫn đủ 5 dòng');
  rows.forEach((row) => assert.ok(row.actions.length > 0 && row.actions.every((a) => a.to.startsWith('/')), row.key));
});

test('AC-3 NUT-11, P-38: kho khô đã trừ n thực phẩm, link lịch sử nhập/trừ', () => {
  const row = rowOf(buildDayBoardRows(campus(), { date: DATE }), 'dryStock');
  assert.deepEqual([row.tone, row.status], ['green', 'Đã trừ 8 thực phẩm']);
  assert.equal(row.actions[0].to, '/kitchen/stock-history?campusId=1');
  const withOpen = rowOf(
    buildDayBoardRows(campus({ dryStock: { status: 'DEDUCTED', foodCount: 8, shortfallFoodCount: 0, openShortfallCount: 2 } })),
    'dryStock',
  );
  assert.match(withOpen.detail, /2 phần thiếu chờ bổ sung/);
  assert.equal(withOpen.actions[0].to, '/kitchen/stock-history?campusId=1');
});

test('P-38: trừ kho sau xác nhận suất từng lỗi ⇒ báo chưa trừ, nút đồng bộ kho kèm link lịch sử', () => {
  const row = rowOf(
    buildDayBoardRows(campus({ dryStock: { status: 'NOT_SYNCED', foodCount: 2, shortfallFoodCount: 0, openShortfallCount: 0 } })),
    'dryStock',
  );
  assert.deepEqual([row.tone, row.status], ['red', 'Chưa trừ 2 thực phẩm']);
  assert.match(row.detail, /Đồng bộ kho/);
  assert.deepEqual(
    row.actions.map((a) => [a.label, !!a.syncStock]),
    [
      ['Đồng bộ kho', true],
      ['Lịch sử nhập/trừ', false],
    ],
  );
});

test('AC-3: kho khô thiếu n thực phẩm, link phần thiếu chờ bổ sung', () => {
  const row = rowOf(
    buildDayBoardRows(campus({ dryStock: { status: 'SHORTFALL', foodCount: 8, shortfallFoodCount: 3, openShortfallCount: 4 } })),
    'dryStock',
  );
  assert.deepEqual([row.tone, row.status], ['red', 'Thiếu 3 thực phẩm']);
  assert.match(row.detail, /4 phần thiếu/);
  assert.deepEqual(row.actions, [{ label: 'Phần thiếu', to: '/kitchen/stock-shortfalls?campusId=1' }]);
});

test('AC-3: kho khô chờ suất, ngày nghỉ, không có thực đơn, không có hàng khô cần trừ', () => {
  const stock = (status) => rowOf(buildDayBoardRows(campus({ dryStock: { status } })), 'dryStock');
  assert.deepEqual([stock('WAITING_COUNT').tone, stock('WAITING_COUNT').status], ['orange', 'Chờ suất']);
  assert.equal(stock('WAITING_COUNT').actions[0].to, '/kitchen/stock-history?campusId=1');
  assert.equal(stock('DAY_OFF').status, 'Ngày nghỉ');
  assert.equal(stock('NO_MENU').status, 'Không có thực đơn');
  assert.equal(stock('NOTHING_TO_DEDUCT').tone, 'gray');
  assert.equal(stock('MỚI').status, 'Chưa có thông tin', 'trạng thái BE lạ không hiện mã kỹ thuật');
});

test('số suất: chữ theo trạng thái, tổng và số theo bữa, link sổ suất ăn theo ngày', () => {
  const row = rowOf(buildDayBoardRows(campus(), { date: DATE }), 'mealCount');
  assert.deepEqual([row.tone, row.status], ['green', 'Đã xác nhận']);
  assert.equal(row.detail, '120 suất · Bữa trưa 60, Bữa chiều 60');
  assert.deepEqual(row.actions, [{ label: 'Sổ suất ăn', to: '/attendance/meal-count?date=2026-11-03' }]);
  const status = (code, counts = {}) =>
    rowOf(buildDayBoardRows(campus({ mealCounts: { status: code, totalServings: 0, sessions: [], ...counts } })), 'mealCount');
  assert.deepEqual([status('NONE').tone, status('NONE').status, status('NONE').detail], ['gray', 'Chưa tổng hợp', 'Chưa có số suất.']);
  assert.deepEqual([status('PENDING_CONFIRMATION').tone, status('PENDING_CONFIRMATION').status], ['purple', 'Chờ xác nhận']);
  assert.deepEqual([status('NEEDS_RECONFIRMATION').tone, status('NEEDS_RECONFIRMATION').status], ['red', 'Cần xác nhận lại']);
  assert.equal(rowOf(buildDayBoardRows(campus(), {}), 'mealCount').actions[0].to, '/attendance/meal-count');
});

test('thực đơn tuần: tuần này / tuần sau, ngày nghỉ, link kế hoạch tuần theo tuần', () => {
  const row = rowOf(buildDayBoardRows(campus(), { date: DATE }), 'menu');
  assert.deepEqual([row.tone, row.status], ['green', 'Đã công bố']);
  assert.equal(row.detail, 'Tuần này: Đã công bố · Tuần sau: Chưa lập');
  assert.deepEqual(
    row.actions.map((a) => a.to),
    ['/menu/weekly?week=2026-11-02', '/menu/weekly?week=2026-11-09'],
  );
  const draft = rowOf(buildDayBoardRows(campus({ menu: { weekStart: '2026-11-02', status: 'DRAFT', dayOff: false } })), 'menu');
  assert.deepEqual([draft.tone, draft.status], ['orange', 'Bản nháp']);
  assert.equal(draft.actions.length, 1, 'không có tuần sau thì không có nút tuần sau');
  const off = rowOf(buildDayBoardRows(campus({ menu: { weekStart: '2026-11-02', status: 'NONE', dayOff: true } })), 'menu');
  assert.deepEqual([off.tone, off.status], ['gray', 'Ngày nghỉ']);
  assert.match(off.detail, /Tuần này: Chưa lập/);
});

test('hàng tươi: nhãn, tông và nút theo từng trạng thái BE, không còn nhãn demo', () => {
  const fresh = (status, date = DATE) => rowOf(buildDayBoardRows(campus({ freshReceiptStatus: status }), { date }), 'freshReceipt');
  const expected = {
    ROUND1_PENDING: ['orange', 'Chờ kiểm lần 1'],
    ROUND1_DONE: ['blue', 'Đã kiểm lần 1'],
    ROUND2_PENDING: ['orange', 'Chờ kiểm lần 2'],
    DONE: ['green', 'Đã kiểm đủ 2 lần'],
    DAY_OFF: ['gray', 'Ngày nghỉ'],
    NO_FORECAST: ['gray', 'Chưa có bản dự trù'],
  };
  for (const [code, [tone, status]] of Object.entries(expected)) {
    const row = fresh(code);
    assert.deepEqual([row.tone, row.status], [tone, status], code);
    assert.ok(!('demo' in row.actions[0]) && !/demo/.test(row.actions[0].label), code);
    assert.ok(row.detail, code);
  }
  assert.deepEqual(fresh('ROUND1_PENDING').actions, [{ label: 'Kiểm nhận', to: '/kitchen/fresh-receipts?campusId=1&date=2026-11-03' }]);
  assert.match(fresh('ROUND1_DONE').detail, /suất/);
  assert.deepEqual(fresh('NO_FORECAST').actions, [{ label: 'Lập bản dự trù', to: '/kitchen/forecast?campusId=1' }]);
  assert.equal(fresh('ROUND2_PENDING', null).actions[0].to, '/kitchen/fresh-receipts?campusId=1');
  const unknown = fresh('MỚI');
  assert.deepEqual([unknown.tone, unknown.status, unknown.detail], ['gray', 'Chưa có thông tin', '']);
});

test('lưu mẫu: chờ duyệt kèm số việc và link hàng chờ, đã duyệt hết, chưa có; không còn nhãn demo', () => {
  const sample = (over, date = DATE) => rowOf(buildDayBoardRows(campus(over), { date }), 'foodSample');
  const pending = sample({ foodSampleStatus: 'PENDING_APPROVAL', foodSamplePendingCount: 3 });
  assert.deepEqual([pending.tone, pending.status], ['purple', '3 chờ duyệt']);
  assert.deepEqual(pending.actions, [{ label: 'Duyệt lưu mẫu', to: '/kitchen/food-samples?campusId=1&status=pending' }]);
  const upToDate = sample({ foodSampleStatus: 'UP_TO_DATE' });
  assert.deepEqual([upToDate.tone, upToDate.status], ['green', 'Đã duyệt hết']);
  assert.equal(upToDate.actions[0].to, '/kitchen/food-samples?campusId=1&to=2026-11-03&from=2026-11-03');
  const none = sample({ foodSampleStatus: 'NONE' });
  assert.deepEqual([none.tone, none.status], ['gray', 'Chưa có bản lưu mẫu']);
  [pending, upToDate, none].forEach((row) => assert.ok(!('demo' in row.actions[0]) && !/demo/.test(row.actions[0].label)));
  assert.equal(sample({ foodSampleStatus: 'NONE' }, null).actions[0].to, '/kitchen/food-samples?campusId=1');
  const unknown = sample({ foodSampleStatus: 'MỚI' });
  assert.deepEqual([unknown.tone, unknown.status, unknown.detail], ['gray', 'Chưa có thông tin', '']);
});

test('adapter: GET /nutrition/day-board với date, campusId tùy chọn; thiếu campuses thì rỗng', async () => {
  const calls = [];
  const client = {
    get: async (url, config) => {
      calls.push({ url, params: config.params });
      return { date: DATE, campuses: calls.length === 1 ? [campus()] : undefined };
    },
  };
  const api = createDayBoardApi({ client });
  const board = await api.getDayBoard({ date: DATE, campusId: '' });
  assert.deepEqual(calls[0], { url: '/nutrition/day-board', params: { date: DATE } });
  assert.equal(board.campuses.length, 1);
  await api.getDayBoard({ date: DATE, campusId: '2' });
  assert.deepEqual(calls[1].params, { date: DATE, campusId: '2' });
  assert.deepEqual((await api.getDayBoard({ date: DATE })).campuses, []);
});

test('adapter: đồng bộ kho gọi POST /nutrition/stock/days/{date}/sync?campusId=', async () => {
  const calls = [];
  const client = { post: async (url, body, config) => calls.push({ url, body, params: config.params }) };
  await createDayBoardApi({ client }).syncStockDay({ date: DATE, campusId: '1' });
  assert.deepEqual(calls, [{ url: `/nutrition/stock/days/${DATE}/sync`, body: null, params: { campusId: '1' } }]);
});

test('module day-board khai source api cho /boarding', () => {
  const mod = INTEGRATION_MODULES['day-board'];
  assert.equal(mod.source, 'api');
  assert.deepEqual(mod.routes, ['/boarding']);
  assert.deepEqual(mod.files, ['src/services/dayBoardApi.js']);
});

test('summarizeBoardRows đếm việc theo nhóm tông trạng thái của mọi điểm trường', async () => {
  const { summarizeBoardRows } = await import('@/utils/boarding/dayBoardRows');
  const rows = [{ tone: 'red' }, { tone: 'orange' }, { tone: 'purple' }, { tone: 'green' }, { tone: 'gray' }, { tone: 'unknown' }];
  assert.deepEqual(summarizeBoardRows([rows, [{ tone: 'green' }]]), { attention: 1, waiting: 2, done: 2, idle: 2 });
});

test('NUT-11: kho khô sắp thiếu ⇒ thêm câu nhắc ngày bắt đầu thiếu và nút Bản dự trù; đủ kho thì không nhắc', () => {
  const row = rowOf(
    buildDayBoardRows(
      campus({
        dryStock: {
          status: 'DEDUCTED',
          foodCount: 8,
          shortfallFoodCount: 0,
          openShortfallCount: 0,
          upcomingShortFoodCount: 3,
          upcomingShortFrom: '2026-11-11',
        },
      }),
    ),
    'dryStock',
  );
  assert.equal(row.tone, 'green');
  assert.match(row.detail, /Sắp thiếu 3 thực phẩm khô từ thứ Tư 11\/11/);
  assert.deepEqual(
    row.actions.map((a) => a.to),
    ['/kitchen/stock-history?campusId=1', '/kitchen/forecast?campusId=1'],
  );

  const enough = rowOf(
    buildDayBoardRows(campus({ dryStock: { status: 'DEDUCTED', foodCount: 8, upcomingShortFoodCount: 0, upcomingShortFrom: null } })),
    'dryStock',
  );
  assert.doesNotMatch(enough.detail, /Sắp thiếu/);
  assert.equal(enough.actions.length, 1);
});

test('AC-9: việc tiếp theo ưu tiên ô đỏ trước ô cam/tím, theo thứ tự hàng rồi điểm trường', () => {
  const c1 = campus();
  const c2 = campus({ campusId: '2', campusName: 'Cơ sở 2', dryStock: { status: 'SHORTFALL', shortfallFoodCount: 2 } });
  const rows = [c1, c2].map((c) => buildDayBoardRows(c, { date: DATE }));
  const next = nextBoardTask(rows, [c1, c2]);
  assert.deepEqual([next.row.key, next.campus.campusId, next.action.to], ['dryStock', '2', '/kitchen/stock-shortfalls?campusId=2']);

  const orangeOnly = [campus()].map((c) => buildDayBoardRows(c, { date: DATE }));
  assert.equal(nextBoardTask(orangeOnly, [campus()]).row.key, 'freshReceipt');
});

test('AC-9: mọi việc xanh hoặc xám ⇒ không có việc tiếp theo', () => {
  const done = campus({ freshReceiptStatus: 'DONE', foodSampleStatus: 'UP_TO_DATE' });
  assert.equal(nextBoardTask([buildDayBoardRows(done, { date: DATE })], [done]), null);
  assert.equal(nextBoardTask([], []), null);
});
