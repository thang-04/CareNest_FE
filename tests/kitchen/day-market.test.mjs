import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { splitByWeight } = await import('@/services/kitchen/mock/dayMarket');
const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { dayMarketCsvRows } = await import('@/utils/kitchen/kitchenExport');
const { todayInput } = await import('@/utils/format');
const { addDays } = await import('@/models/menu-planning/menuPlanningConstants');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const TEACHER = { id: 'u_teacher', role: 'TEACHER', campusId: 'c1' };
const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);
const close = (a, b) => Math.abs(a - b) < 0.011;

// Ngày học gần nhất đã qua: dữ liệu mẫu luôn có thực đơn đã công bố
let SCHOOL_DAY = addDays(todayInput(), -1);
while ([0, 6].includes(new Date(`${SCHOOL_DAY}T00:00:00`).getDay())) SCHOOL_DAY = addDays(SCHOOL_DAY, -1);
const readyDay = () => repo.getDayMarket({ campusId: 'c1', date: SCHOOL_DAY }, VP);

test('chia theo tỷ lệ: các phần cộng lại đúng bằng tổng, phần lẻ dồn nhóm cuối có phần', () => {
  const r2 = (n) => Math.round(n * 100) / 100;
  assert.deepEqual(splitByWeight(10, [1, 1, 1], r2), [3.33, 3.33, 3.34]);
  assert.deepEqual(splitByWeight(12.6, [26, 100, 0], r2), [2.6, 10, 0]);
  assert.deepEqual(splitByWeight(1000, [1, 2], Math.round), [333, 667]);
  assert.deepEqual(splitByWeight(5, [0, 0], r2), [0, 0]);
  assert.deepEqual(splitByWeight(null, [1, 2], Math.round), [null, null], 'chưa có đơn giá thì không có tiền');
});

test('NUT-07: mỗi thực phẩm có đơn giá, lượng, thành tiền; tổng chi bằng tổng các dòng', async () => {
  const day = await readyDay();
  assert.equal(day.status, 'READY');
  assert.ok(day.lines.length > 0 && day.groups.length > 0);
  day.lines.forEach((l) => {
    assert.ok(l.quantity > 0 && l.unit, l.name);
    if (l.unitPrice != null) assert.equal(l.amount, Math.round(l.quantity * l.unitPrice), l.name);
  });
  const sum = day.lines.reduce((n, l) => n + (l.amount || 0), 0);
  assert.equal(day.totals.cost, sum);
  assert.equal(day.totals.marketCost + day.totals.stockCost, sum);
});

test('NUT-07: số lượng và tiền các nhóm tuổi cộng lại bằng dòng tổng của thực phẩm', async () => {
  const day = await readyDay();
  day.lines.forEach((l) => {
    assert.equal(l.groups.length, day.groups.length);
    assert.ok(close(l.groups.reduce((n, g) => n + g.quantity, 0), l.quantity), `${l.name}: số lượng`);
    if (l.amount != null) assert.equal(l.groups.reduce((n, g) => n + g.amount, 0), l.amount, `${l.name}: tiền`);
  });
  assert.equal(day.totals.groups.reduce((n, g) => n + g.cost, 0), day.totals.cost);
});

test('NUT-11: có cả hàng mua chợ và đồ khô xuất kho; mua chợ xếp trước', async () => {
  const day = await readyDay();
  const sources = day.lines.map((l) => l.source);
  assert.ok(sources.includes('MARKET') && sources.includes('STOCK'));
  assert.ok(sources.lastIndexOf('MARKET') < sources.indexOf('STOCK'));
});

test('thu–chi và thực đơn: thu = số suất × giá từng nhóm, chênh = thu − chi, mỗi bữa có món', async () => {
  const day = await readyDay();
  day.groups.forEach((g) => {
    assert.ok(g.servings > 0, g.name);
    if (g.price != null) assert.equal(g.revenue, g.servings * g.price);
  });
  assert.equal(day.totals.revenue, day.groups.reduce((n, g) => n + (g.revenue || 0), 0));
  assert.equal(day.totals.balance, day.totals.revenue - day.totals.cost);
  assert.ok(day.menu.length > 0 && day.menu.every((m) => m.groups.every((g) => g.dishes.length > 0)));
  assert.ok(['CONFIRMED', 'FORECAST'].includes(day.basis));
});

test('ngày nghỉ trả trạng thái nghỉ; điểm trường và quyền', async () => {
  let sunday = todayInput();
  while (new Date(`${sunday}T00:00:00`).getDay() !== 0) sunday = addDays(sunday, 1);
  const off = await repo.getDayMarket({ campusId: 'c1', date: sunday }, VP);
  assert.equal(off.status, 'HOLIDAY');
  assert.deepEqual(off.lines, []);

  const vp = await readyDay();
  assert.deepEqual(vp.campuses.map((c) => c.id), ['c1'], 'PHT chỉ thấy cơ sở mình');
  const principal = await repo.getDayMarket({ campusId: '', date: SCHOOL_DAY }, PRINCIPAL);
  assert.ok(principal.campuses.length > 1 && principal.campusId === principal.campuses[0].id, 'bỏ trống ⇒ cơ sở đầu tiên');
  await rejects(repo.getDayMarket({ campusId: 'c2', date: SCHOOL_DAY }, VP), 403);
  await rejects(repo.getDayMarket({ campusId: 'c1', date: SCHOOL_DAY }, TEACHER), 403);
});

test('dòng Excel chép đúng số của bảng', async () => {
  const day = await readyDay();
  const rows = dayMarketCsvRows(day);
  assert.equal(rows[1].length, 7 + day.groups.length * 2);
  const first = rows[2];
  assert.deepEqual([first[1], first[2], first[6]], [day.lines[0].name, day.lines[0].unit, day.lines[0].amount ?? '']);
  const total = rows.find((r) => r[1] === 'Tổng chi');
  assert.equal(total[6], day.totals.cost);
  assert.ok(rows.some((r) => r[0] === 'Tổng thu' && r[3] === day.totals.revenue));
});
