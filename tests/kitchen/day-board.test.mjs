import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { buildDayBoardRows } = await import('@/utils/boarding/dayBoardRows');
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
  freshReceiptStatus: 'NOT_AVAILABLE',
  foodSampleStatus: 'NOT_AVAILABLE',
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

test('hàng tươi và lưu mẫu chưa triển khai: nhãn rõ, nút tới màn demo', () => {
  const rows = buildDayBoardRows(campus());
  const fresh = rowOf(rows, 'freshReceipt');
  const sample = rowOf(rows, 'foodSample');
  [fresh, sample].forEach((row) => {
    assert.deepEqual([row.tone, row.status], ['gray', 'Chưa triển khai']);
    assert.equal(row.actions[0].demo, true);
    assert.match(row.actions[0].label, /demo/);
  });
  assert.equal(fresh.actions[0].to, '/kitchen/fresh-receipts');
  assert.equal(sample.actions[0].to, '/kitchen/food-samples');
  const other = rowOf(buildDayBoardRows(campus({ freshReceiptStatus: 'WAITING' })), 'freshReceipt');
  assert.equal(other.status, 'Chưa có thông tin');
  assert.equal(other.detail, '');
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

test('module day-board khai source api cho /boarding', () => {
  const mod = INTEGRATION_MODULES['day-board'];
  assert.equal(mod.source, 'api');
  assert.deepEqual(mod.routes, ['/boarding']);
  assert.deepEqual(mod.files, ['src/services/dayBoardApi.js']);
});
