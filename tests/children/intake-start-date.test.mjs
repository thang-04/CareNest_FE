import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { readDb, resetDb, writeDb } = await import('@/mocks/mockDatabase');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { activeYearId } = await import('@/mocks/roomManagers');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { addDays, todayInput } = await import('@/utils/format');
const {
  defaultStartDate,
  earliestPlacementDate,
  firstSchoolDay,
  hasScheduledTransfer,
  isNotStarted,
  isSchoolDay,
  placementDateError,
  scheduledTransferLabel,
  startDateError,
} = await import('@/utils/children/startDate');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * G94-180/CHD-14 (BE:docs/business/BUSINESS_RULES.md): ngày bắt đầu đi học khi tiếp nhận, ngày vào lớp / ngày chuyển lớp
 * là ngày học; ngày tương lai là lịch (trẻ ở lớp cũ tới hết ngày trước đó); hủy / thay lịch; nhãn tới ngày đi học.
 */
const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: 'c1' };
test('planned intake accepts an empty start date and omits the blank payload field', () => {
  assert.equal(startDateError('', { status: 'PLANNED' }, todayInput()), '');
  assert.equal(startDateError('', { status: 'ACTIVE' }, todayInput()), 'Chọn ngày bắt đầu đi học');
  const field = readFileSync('src/components/children/IntakeStartFields.jsx', 'utf8');
  assert.match(field, /required=\{!planned\}/);
  assert.ok(field.includes('Để trống = ngày học đầu tiên của năm học'));
  for (const path of ['src/pages/children/EnrollChildPage.jsx', 'src/components/children/ImportChildrenModal.jsx']) {
    assert.ok(readFileSync(path, 'utf8').includes('...(startDate ? { startDate } : {})'));
  }
});
const HOLIDAY = { startDate: '2026-11-24', endDate: '2026-11-24', name: 'Nghỉ giả' };

const saturdayFrom = (from) => {
  let day = from;
  while (new Date(`${day}T00:00:00`).getDay() !== 6) day = addDays(day, 1);
  return day;
};
const yearHolidays = () => (readDb().schoolHolidays || {})[activeYearId(readDb())] || [];
// Ngày học tương lai, cách hôm nay ít nhất `days` ngày (theo lịch nghỉ của năm đang hoạt động trong mock)
const schoolDayIn = (days) => firstSchoolDay(addDays(todayInput(), days), yearHolidays());

const guardian = (n) => ({
  fullName: `Phụ huynh ngày học ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 9${String(n).padStart(2, '0')}`,
  idNumber: `9999000009${String(n).padStart(2, '0')}`,
  email: '',
});
const payload = (n, patch = {}) => ({
  child: {
    ...emptyChildInfo(),
    fullName: `Trẻ ngày học ${n}`,
    dateOfBirth: '2023-05-17',
    gender: 'FEMALE',
    guardians: [guardian(n)],
    profile: filledProfile(),
  },
  declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  campusId: 'c1',
  classId: '',
  schoolYearId: activeYearId(readDb()),
  ...patch,
});
const freeClass = (exceptIds = []) => {
  const db = readDb();
  const year = activeYearId(db);
  return db.classes.find(
    (c) =>
      c.schoolYear === year &&
      c.campusId === 'c1' &&
      c.status !== 'INACTIVE' &&
      !exceptIds.includes(c.id) &&
      db.children.filter((k) => k.classId === c.id && k.status === 'ACTIVE').length < c.capacity - 2,
  );
};
const activeChildInC1 = () => {
  const db = readDb();
  const year = activeYearId(db);
  return db.children.find(
    (c) =>
      c.status === 'ACTIVE' &&
      c.campusId === 'c1' &&
      db.classes.find((k) => k.id === c.classId)?.schoolYear === year &&
      db.healthDeclarations.some((d) => d.childId === c.id) &&
      !(db.plannedAdmissions || []).some((a) => a.childId === c.id && a.status !== 'CANCELLED'),
  );
};

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('ngày học: thứ 2–6, không trùng ngày nghỉ; ngày học đầu tiên bỏ qua thứ 7, chủ nhật, ngày nghỉ', () => {
  assert.equal(isSchoolDay('2026-11-21'), false);
  assert.equal(isSchoolDay('2026-11-23'), true);
  assert.equal(isSchoolDay('2026-11-24', [HOLIDAY]), false);
  assert.equal(firstSchoolDay('2026-11-21'), '2026-11-23');
  assert.equal(firstSchoolDay('2026-11-23', [{ startDate: '2026-11-23', endDate: '2026-11-24', name: 'x' }]), '2026-11-25');
});

test('ngày bắt đầu mặc định: năm đang học = ngày học gần nhất từ hôm nay; năm sau = ngày học đầu tiên từ ngày bắt đầu năm', () => {
  assert.equal(defaultStartDate({ status: 'ACTIVE', endDate: '2027-05-31' }, '2026-11-21'), '2026-11-23');
  assert.equal(defaultStartDate({ status: 'PLANNED', startDate: '2027-09-05', endDate: '2028-05-31' }, '2026-11-21'), '2027-09-06');
  assert.equal(defaultStartDate(null, '2026-11-21'), '');
});

test('lỗi ô ngày bắt đầu đi học cùng câu BE', () => {
  const active = { status: 'ACTIVE', endDate: '2027-05-31' };
  const planned = { status: 'PLANNED', startDate: '2027-09-06', endDate: '2028-05-31' };
  assert.equal(startDateError('', active, '2026-11-23'), 'Chọn ngày bắt đầu đi học');
  assert.equal(startDateError('2026-11-20', active, '2026-11-23'), 'Ngày bắt đầu đi học không được trước hôm nay');
  assert.equal(startDateError('2027-06-01', active, '2026-11-23'), 'Ngày bắt đầu đi học không được sau ngày kết thúc năm học (31/05/2027)');
  assert.equal(
    startDateError('2026-11-28', active, '2026-11-23'),
    'Ngày bắt đầu đi học 28/11/2026 là thứ Bảy. Chọn ngày từ thứ 2 tới thứ 6.',
  );
  assert.equal(
    startDateError('2026-11-29', active, '2026-11-23'),
    'Ngày bắt đầu đi học 29/11/2026 là Chủ nhật. Chọn ngày từ thứ 2 tới thứ 6.',
  );
  assert.match(
    startDateError('2026-11-24', active, '2026-11-23', [HOLIDAY]),
    /trùng ngày nghỉ của trường: .* \(24\/11\/2026\)\. Chọn ngày học khác\.$/,
  );
  assert.equal(startDateError('5/09/2027', planned, '2026-11-23'), 'Nhập ngày bắt đầu đi học theo dạng dd/mm/yyyy');
  assert.equal(startDateError('2027-9-5', active, '2026-11-23'), 'Nhập ngày bắt đầu đi học theo dạng dd/mm/yyyy');
  assert.equal(startDateError('2026-11-25', active, '2026-11-23'), '');
  assert.equal(startDateError('2027-09-01', planned, '2026-11-23'), 'Ngày bắt đầu phải nằm trong thời gian năm học đã chọn');
  assert.equal(startDateError('2027-09-06', planned, '2026-11-23'), '');
});

test('lỗi ô ngày vào lớp / ngày chuyển lớp cùng câu BE', () => {
  const base = { earliest: '2026-11-23', today: '2026-11-23', yearEnd: '2027-05-31' };
  assert.equal(placementDateError('2026-11-20', { ...base, transfer: true }), 'Ngày chuyển lớp không được trước hôm nay');
  assert.equal(
    placementDateError('2026-11-25', { ...base, earliest: '2026-11-30' }),
    'Ngày vào lớp không được trước ngày bắt đầu đi học (30/11/2026)',
  );
  assert.equal(
    placementDateError('2027-06-01', { ...base, transfer: true }),
    'Ngày chuyển lớp không được sau ngày kết thúc năm học (31/05/2027)',
  );
  assert.equal(
    placementDateError('2026-11-28', { ...base, transfer: true }),
    'Ngày chuyển lớp 28/11/2026 là thứ Bảy. Chọn ngày từ thứ 2 tới thứ 6.',
  );
  assert.equal(placementDateError('2026-11-28', base), 'Ngày vào lớp 28/11/2026 là thứ Bảy. Chọn ngày từ thứ 2 tới thứ 6.');
  const dayOff = { startDate: '2026-12-09', endDate: '2026-12-09', name: 'Nghỉ thử' };
  assert.equal(
    placementDateError('2026-12-09', { ...base, holidays: [dayOff] }),
    'Ngày vào lớp 09/12/2026 trùng ngày nghỉ của trường: Nghỉ thử (09/12/2026). Chọn ngày học khác.',
  );
  assert.equal(
    placementDateError('2026-12-10', { ...base, holidays: [{ ...dayOff, startDate: '2026-12-10', endDate: '2026-12-11' }] }),
    'Ngày vào lớp 10/12/2026 trùng ngày nghỉ của trường: Nghỉ thử (10/12/2026 – 11/12/2026). Chọn ngày học khác.',
  );
  assert.equal(placementDateError('9/12/2026', base), 'Nhập ngày vào lớp theo dạng dd/mm/yyyy');
  assert.equal(placementDateError('2026-11-25', base), '');
});

test('mốc sớm nhất: xếp lần đầu không trước ngày bắt đầu đi học; chuyển lớp từ hôm nay', () => {
  assert.equal(earliestPlacementDate({ classId: null, startDate: '2026-12-01' }, '2026-11-23'), '2026-12-01');
  assert.equal(earliestPlacementDate({ classId: null, startDate: '2026-11-01' }, '2026-11-23'), '2026-11-23');
  assert.equal(earliestPlacementDate({ classId: 'a', startDate: '2026-12-01' }, '2026-11-23'), '2026-11-23');
  const notStarted = { classId: 'a', startDate: '2026-12-01', nextClass: { classId: 'a', from: '2026-12-01' } };
  assert.equal(isNotStarted(notStarted), true);
  assert.equal(earliestPlacementDate(notStarted, '2026-11-23'), '2026-12-01');
  const scheduled = { classId: 'a', nextClass: { classId: 'b', className: 'Chồi 2', from: '2026-12-07' } };
  assert.equal(hasScheduledTransfer(scheduled), true);
  assert.equal(scheduledTransferLabel(scheduled), 'Sẽ chuyển sang Chồi 2 từ 07/12/2026');
});

test('BE giả: tiếp nhận năm đang học lưu ngày bắt đầu đi học; ngày đã qua, thứ 7 ⇒ 422 ô startDate', async () => {
  const start = schoolDayIn(10);
  const saved = await children.enrollChild(payload(1, { startDate: start }), PRINCIPAL);
  assert.equal(saved.startDate, start);
  assert.equal(saved.startDue, false);

  await assert.rejects(
    children.enrollChild(payload(2, { startDate: addDays(todayInput(), -1) }), PRINCIPAL),
    (err) => err.status === 422 && err.details.startDate === 'Ngày bắt đầu đi học không được trước hôm nay',
  );
  await assert.rejects(
    children.enrollChild(payload(3, { startDate: saturdayFrom(addDays(todayInput(), 1)) }), PRINCIPAL),
    (err) => err.status === 422 && /là thứ Bảy\. Chọn ngày từ thứ 2 tới thứ 6\.$/.test(err.details.startDate),
  );
});

test('BE giả: xếp lần đầu không ghi ngày ⇒ lớp từ ngày bắt đầu đi học (chưa bắt đầu); ngày trước đó ⇒ 422', async () => {
  const start = schoolDayIn(10);
  const pending = await children.enrollChild(payload(4, { startDate: start }), PRINCIPAL);
  const cls = freeClass();

  await assert.rejects(
    children.placeChild(pending.id, { classId: cls.id, effectiveDate: addDays(start, -1) }, PRINCIPAL),
    (err) => err.status === 422 && /không được trước ngày bắt đầu đi học/.test(err.details.effectiveDate),
  );
  const placed = await children.placeChild(pending.id, { classId: cls.id }, PRINCIPAL);
  assert.equal(placed.classId, cls.id);
  assert.deepEqual(placed.nextClass, { classId: cls.id, className: cls.name, from: start });
  const row = readDb().childPlacements.findLast((p) => p.childId === pending.id);
  assert.equal(row.effectiveFrom, start);
});

test('BE giả: chuyển lớp ngày tương lai ⇒ lịch, trẻ ở lớp cũ; chuyển lần nữa thay lịch; hủy lịch ⇒ ở lại lớp cũ', async () => {
  const child = activeChildInC1();
  const first = freeClass([child.classId]);
  const second = freeClass([child.classId, first.id]);
  const day = schoolDayIn(7);

  const scheduled = await children.placeChild(child.id, { classId: first.id, reason: 'Đổi lớp', effectiveDate: day }, PRINCIPAL);
  assert.equal(scheduled.classId, child.classId);
  assert.deepEqual(scheduled.nextClass, { classId: first.id, className: first.name, from: day });

  const later = firstSchoolDay(addDays(day, 1), yearHolidays());
  const replaced = await children.placeChild(child.id, { classId: second.id, reason: 'Đổi lần nữa', effectiveDate: later }, PRINCIPAL);
  assert.equal(replaced.nextClass.classId, second.id);
  const rows = readDb().childPlacements.filter((p) => p.childId === child.id && p.effectiveFrom);
  assert.ok(rows.find((p) => p.toClassId === first.id).cancelledAt);
  assert.equal(rows.find((p) => p.toClassId === second.id).cancelledAt, undefined);

  const cancelled = await children.cancelScheduledPlacement(child.id, PRINCIPAL);
  assert.equal(cancelled.classId, child.classId);
  assert.equal(cancelled.nextClass, null);
  await assert.rejects(
    children.cancelScheduledPlacement(child.id, PRINCIPAL),
    (err) => err.status === 422 && err.details.classId === 'Trẻ không có lịch vào lớp hoặc chuyển lớp chưa tới ngày',
  );
});

test('BE giả: tới ngày của lịch ⇒ lớp mới thành lớp hiện tại; cho nghỉ khi có lịch ⇒ xóa lịch', async () => {
  const child = activeChildInC1();
  const target = freeClass([child.classId]);
  const day = schoolDayIn(7);
  await children.placeChild(child.id, { classId: target.id, reason: 'Đổi lớp', effectiveDate: day }, PRINCIPAL);
  writeDb((d) => {
    d.children.find((c) => c.id === child.id).nextClass.from = todayInput();
  });
  const due = (await children.getChildDetail(child.id, PRINCIPAL)).child;
  assert.equal(due.classId, target.id);
  assert.equal(due.nextClass, null);

  const other = activeChildInC1();
  await children.placeChild(other.id, { classId: freeClass([other.classId]).id, reason: 'Đổi lớp', effectiveDate: day }, PRINCIPAL);
  const left = await children.withdrawChild(other.id, { leftAt: todayInput(), reason: 'Chuyển nhà' }, PRINCIPAL);
  assert.equal(left.status, 'LEFT');
  assert.equal(left.nextClass, null);
});

test('BE giả: trẻ chờ xếp lớp đã tới ngày bắt đầu đi học ⇒ startDue ở hồ sơ và danh sách', async () => {
  const pending = await children.enrollChild(payload(5, { startDate: schoolDayIn(10) }), PRINCIPAL);
  assert.equal(pending.startDue, false);
  writeDb((d) => {
    d.children.find((c) => c.id === pending.id).startDate = addDays(todayInput(), -1);
  });
  assert.equal((await children.getChildDetail(pending.id, PRINCIPAL)).child.startDue, true);
  const list = await children.listChildren({ schoolYear: activeYearId(readDb()) }, PRINCIPAL);
  assert.equal(list.find((c) => c.id === pending.id).startDue, true);
});
