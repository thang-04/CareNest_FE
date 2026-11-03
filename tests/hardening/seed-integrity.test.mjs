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

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { ensureSchoolSeeded } = await import('@/mocks/schoolMockRepository');
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { legacyTeacherPhoneOf } = await import('@/mocks/teacherSeed');

/*
 * Dữ liệu mẫu (dữ liệu giả): FE-BUG-261021-seed-guardian-staff-phone-overlap (SĐT giáo viên trùng phụ huynh ⇒ kích hoạt 409)
 * và FE-BUG-261023-seed-duplicate-child-id-ch037 (hai trẻ cùng id ch_037).
 */
const digits = (v) => String(v || '').replace(/[\s.\-()]/g, '');
const dupes = (list, key) => {
  const count = new Map();
  list.forEach((x) => count.set(key(x), (count.get(key(x)) || 0) + 1));
  return [...count].filter(([k, n]) => k && n > 1).map(([k]) => k);
};

const checkIntegrity = (db) => {
  assert.deepEqual(
    dupes(db.children, (c) => c.id),
    [],
    'id trẻ duy nhất',
  );
  assert.deepEqual(
    dupes(db.children, (c) => c.code),
    [],
    'mã trẻ duy nhất',
  );
  assert.deepEqual(
    dupes(db.healthMeasurements || [], (m) => m.id),
    [],
    'id kết quả đo duy nhất',
  );
  const staff = db.users.filter((u) => u.role !== 'PARENT');
  const staffPhones = new Set(staff.map((u) => digits(u.phone)).filter(Boolean));
  const staffEmails = new Set(staff.map((u) => (u.email || '').toLowerCase()).filter(Boolean));
  const guardians = db.children.flatMap((c) => c.guardians || []);
  assert.deepEqual(
    guardians.filter((g) => staffPhones.has(digits(g.phone))).map((g) => g.phone),
    [],
    'SĐT phụ huynh không trùng nhân sự',
  );
  assert.deepEqual(
    guardians.filter((g) => staffEmails.has((g.email || '').toLowerCase())).map((g) => g.email),
    [],
    'email phụ huynh không trùng nhân sự',
  );
  assert.deepEqual(
    dupes(db.parentAccounts || [], (a) => (a.email || '').toLowerCase()),
    [],
    'email tài khoản phụ huynh duy nhất',
  );
};

test('DB demo mới: id/mã trẻ duy nhất, SĐT/email phụ huynh không trùng nhân sự; trẻ 27 tháng có phiếu "nguy cơ tự kỷ"', () => {
  resetDb();
  ensureChildRecordsSeeded();
  const db = readDb();
  checkIntegrity(db);
  const young = db.children.find((c) => c.fullName === 'Phạm Gia Khánh');
  assert.equal(young.id, 'ch_902');
  const exam = db.healthMeasurements.find((m) => m.childId === young.id && m.id === 'hm_ch_902_open');
  assert.equal(exam.exam.development.autismRisk, 'YES');
  assert.ok(db.healthFollowUps.some((f) => f.childId === young.id && f.measurementIds.includes(exam.id)));
});

test('DB demo cũ (SĐT giáo viên theo công thức cũ, hai trẻ cùng ch_037) được nâng cấp một lần', () => {
  resetDb();
  ensureChildRecordsSeeded();
  // Dựng lại tình trạng cũ trên dữ liệu giả.
  writeDb((d) => {
    d.users.forEach((u) => {
      const n = Number(/^u_gv(\d{3})$/.exec(u.id)?.[1]);
      if (n) u.phone = legacyTeacherPhoneOf(n);
    });
    const young = d.children.find((c) => c.id === 'ch_902');
    Object.assign(young, { id: 'ch_037', code: 'HS26037' });
    young.guardians[0].email = 'phuhuynh037@example.com';
    const acc = d.parentAccounts.find((a) => a.childIds.includes('ch_902'));
    acc.childIds = acc.childIds.map((id) => (id === 'ch_902' ? 'ch_037' : id));
    acc.email = 'phuhuynh037@example.com';
    d.healthMeasurements.forEach((m) => {
      if (m.childId !== 'ch_902') return;
      m.childId = 'ch_037';
      m.id = m.id.replace('ch_902', 'ch_037');
    });
    // Phiếu "nguy cơ tự kỷ" từng gắn nhầm cho cả trẻ bổ sung ch_037 (đứng trước trong danh sách).
    const open = d.healthMeasurements.find((m) => m.id === 'hm_ch_037_open');
    const firstOld = d.healthMeasurements.findIndex((m) => m.childId === 'ch_037');
    d.healthMeasurements.splice(firstOld, 0, structuredClone(open));
    d.healthFollowUps.forEach((f) => {
      if (f.childId !== 'ch_902') return;
      f.childId = 'ch_037';
      f.measurementIds = f.measurementIds.map((id) => id.replace('ch_902', 'ch_037'));
    });
    d.healthDeclarations.forEach((x) => {
      if (x.childId === 'ch_902') x.childId = 'ch_037';
    });
    delete d.teacherPhones08;
    delete d.childIdFix037;
  });
  assert.equal(readDb().children.filter((c) => c.id === 'ch_037').length, 2, 'đã dựng trùng');

  ensureSchoolSeeded();
  const db = readDb();
  checkIntegrity(db);
  const young = db.children.find((c) => c.fullName === 'Phạm Gia Khánh');
  assert.equal(young.id, 'ch_902');
  assert.equal(young.code, 'HS26902');
  assert.ok(db.healthMeasurements.some((m) => m.id === 'hm_ch_902_open' && m.childId === 'ch_902'));
  assert.ok(!db.healthMeasurements.some((m) => m.id === 'hm_ch_037_open'), 'bỏ phiếu gắn nhầm cho trẻ bổ sung');
  assert.equal(db.healthDeclarations.filter((x) => x.childId === 'ch_037').length, 1);
  assert.ok(db.healthFollowUps.some((f) => f.childId === 'ch_902' && f.measurementIds.includes('hm_ch_902_open')));
  assert.ok(db.parentAccounts.some((a) => a.childIds.includes('ch_902')));
});
