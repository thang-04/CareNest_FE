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

const { writeDb } = await import('@/mocks/mockDatabase');
const { kitchenMockRepository: repo } = await import('@/services/kitchen/mock/kitchenMockRepository');
const { todayInput } = await import('@/utils/format');
const { addDays, schoolWeekStart } = await import('@/models/menu-planning/menuPlanningConstants');

const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const PRINCIPAL = { id: 'u_principal', role: 'PRINCIPAL', campusId: null };
const COOK_A = { id: 'u_cook_a', role: 'KITCHEN_STAFF', campusId: 'c1' };
const COOK_B = { id: 'u_cook_b', role: 'KITCHEN_STAFF', campusId: 'c2' };
const THIS_WEEK = schoolWeekStart(todayInput());
// Tuần xa ở tương lai: chép thực đơn tuần đã xuất bản sang để mọi ngày còn sửa được, chưa có số chốt
const FUTURE_WEEK = addDays(THIS_WEEK, 70);

const rejects = (promise, status) => assert.rejects(promise, (err) => err.status === status);

const publishFutureWeek = async () => {
  await repo.getWeeklyForecast({ campusId: 'c1', weekStart: THIS_WEEK }, VP);
  writeDb((db) => {
    if (db.weeklyMenus.some((w) => w.weekStart === FUTURE_WEEK)) return;
    const copies = db.weeklyMenus
      .filter((w) => w.weekStart === THIS_WEEK && w.status === 'PUBLISHED')
      .map((w) => ({
        ...JSON.parse(JSON.stringify(w)),
        id: `${w.id}_future`,
        weekStart: FUTURE_WEEK,
        days: w.days.map((d, i) => ({ ...JSON.parse(JSON.stringify(d)), date: addDays(FUTURE_WEEK, i) })),
      }));
    db.weeklyMenus.push(...copies);
  });
};

test('tuần đang chạy: đã gửi NCC theo dữ liệu mẫu, có lưới suất và phiếu tươi; quyền xem theo cơ sở', async () => {
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: THIS_WEEK }, VP);
  assert.equal(week.status, 'READY');
  assert.equal(week.days.length, 5);
  assert.ok(week.classes.length > 0 && week.classes.every((c) => c.registered > 0));
  assert.ok(week.fresh.length > 0, 'có hàng tươi cần đặt');
  assert.ok(week.sent?.at, 'dữ liệu mẫu: phiếu tuần đã gửi NCC');
  assert.equal(week.canEdit, true);
  week.days.filter((d) => d.confirmed).forEach((d) => assert.equal(d.editable, false, `${d.date} đã chốt thì khóa`));

  const forCook = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: THIS_WEEK }, COOK_A);
  assert.equal(forCook.canEdit, false);
  const forPrincipal = await repo.getWeeklyForecast({ campusId: 'c2', weekStart: THIS_WEEK }, PRINCIPAL);
  assert.equal(forPrincipal.canEdit, false);
  await rejects(repo.getWeeklyForecast({ campusId: 'c1', weekStart: THIS_WEEK }, COOK_B), 403);
});

test('ngày đã chốt: suất là số chốt, chênh lệch với phiếu đã gửi thành dòng báo NCC "sau chốt"; không sửa được', async () => {
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: THIS_WEEK }, VP);
  const confirmed = week.days.find((d) => d.confirmed && !d.holiday);
  if (!confirmed) return; // đầu tuần chưa có ngày chốt
  const group = week.changes.find((g) => g.date === confirmed.date);
  if (group) assert.equal(group.kind, 'AFTER_CONFIRM');
  const cls = week.classes[0];
  const cell = cls.cells.find((c) => c.date === confirmed.date);
  await rejects(
    repo.saveWeeklyForecast({ campusId: 'c1', weekStart: THIS_WEEK, cells: { [cls.classId]: { [confirmed.date]: cell.value + 1 } } }, VP),
    409,
  );
});

test('PHT sửa suất ngày chưa chốt: phiếu tính lại, ô có dấu đã sửa; vượt số đăng ký hoặc sai quyền bị chặn', async () => {
  await publishFutureWeek();
  const before = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP);
  assert.equal(before.status, 'READY');
  assert.equal(before.sent, null);
  const day = before.days[0];
  assert.ok(day.editable);
  const cls = before.classes[0];
  const cell = cls.cells[0];
  assert.equal(cell.value, cell.suggested, 'chưa sửa thì bằng gợi ý');
  assert.equal(cell.suggested, cls.registered, 'tuần tương lai chưa ai báo nghỉ');

  const after = await repo.saveWeeklyForecast(
    { campusId: 'c1', weekStart: FUTURE_WEEK, cells: { [cls.classId]: { [day.date]: cell.value - 5 } } },
    VP,
  );
  const edited = after.classes.find((c) => c.classId === cls.classId).cells[0];
  assert.equal(edited.value, cell.value - 5);
  assert.equal(edited.edited, true);
  assert.equal(after.days[0].total, before.days[0].total - 5);
  const sum = (w) => w.fresh.reduce((n, f) => n + f.days[0].qty, 0);
  assert.ok(sum(after) <= sum(before), 'ít suất thì không đặt nhiều hơn');

  await rejects(
    repo.saveWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK, cells: { [cls.classId]: { [day.date]: cls.registered + 1 } } }, VP),
    422,
  );
  await rejects(repo.saveWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK, cells: { [cls.classId]: { [day.date]: 1.5 } } }, VP), 422);
  await rejects(repo.saveWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK, cells: { [cls.classId]: { [day.date]: 3 } } }, COOK_A), 403);
});

test('gửi NCC rồi đổi suất ⇒ dòng báo NCC; đánh dấu đã báo; đổi lại về số cũ vẫn phải báo lại', async () => {
  await publishFutureWeek();
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP);
  const cls = week.classes[0];
  const date = week.days[1].date;
  const original = cls.cells[1].value;

  await repo.markWeeklyOrderSent({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP);
  await rejects(repo.markWeeklyOrderSent({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP), 409);
  let view = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP);
  assert.ok(view.sent?.at);
  assert.equal(view.changes.length, 0, 'vừa gửi thì chưa có gì cần báo');

  view = await repo.saveWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK, cells: { [cls.classId]: { [date]: original - Math.min(3, original) } } }, VP);
  const group = view.changes.find((g) => g.date === date);
  assert.ok(group, 'có dòng báo NCC cho ngày đã đổi');
  assert.equal(group.kind, 'FORECAST_CHANGED');
  assert.ok(group.lines.every((l) => !l.notified && l.diff < 0 && Math.abs(l.needed - l.ordered - l.diff) < 1e-6));
  assert.equal(view.pendingChanges, view.changes.reduce((n, g) => n + g.lines.length, 0));

  const line = group.lines[0];
  await repo.setSupplierNotified({ campusId: 'c1', weekStart: FUTURE_WEEK, date, foodId: line.foodId, notified: true }, VP);
  view = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP);
  const marked = view.changes.find((g) => g.date === date).lines.find((l) => l.foodId === line.foodId);
  assert.equal(marked.notified, true);
  assert.ok(marked.notifiedAt);
  await rejects(repo.setSupplierNotified({ campusId: 'c1', weekStart: FUTURE_WEEK, date, foodId: line.foodId, notified: true }, COOK_A), 403);

  // Về lại số đã gửi: NCC đã được báo số giảm nên phải báo tăng lại
  view = await repo.saveWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK, cells: { [cls.classId]: { [date]: original } } }, VP);
  const back = view.changes.find((g) => g.date === date)?.lines.find((l) => l.foodId === line.foodId);
  assert.ok(back && !back.notified && back.diff > 0, 'báo lại phần tăng');
});

test('đồ khô: cần mua = cần cho các ngày chưa chốt − tồn, không âm', async () => {
  await publishFutureWeek();
  const week = await repo.getWeeklyForecast({ campusId: 'c1', weekStart: FUTURE_WEEK }, VP);
  assert.ok(week.dry.length > 0, 'thực đơn có đồ khô');
  week.dry.forEach((f) => {
    assert.ok(f.toBuy >= 0);
    if (f.stock >= f.need) assert.equal(f.toBuy, 0, f.name);
    else assert.ok(f.toBuy >= f.need - f.stock - 1e-9, f.name);
  });
});
