import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
globalThis.window = new EventTarget();

const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { authMockRepository: auth, DEMO_PASSWORD } = await import('@/mocks/authMockRepository');
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { guardianMockRepository: guardians } = await import('@/services/account/mock/guardianMockRepository');
const { readEnrollmentCsv } = await import('@/services/children/mock/enrollmentImport');
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');
const { CITIZEN_ID_TAKEN, PHONE_HAS_OTHER_ID, fillMissingCitizenIds, seedCitizenIdFor } = await import('@/mocks/guardianIdentity');
const { IMPORT_COLUMNS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { filledImportColumns, filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * Kịch bản backend giả cho plan docs/plans/completed/2026-10-21-guardian-citizen-id-required.md.
 * Mọi số CCCD, SĐT ở đây là số giả (CCCD bắt đầu bằng 999, không có mã tỉnh này).
 */
const loginAs = async (predicate) => (await auth.login({ email: readDb().users.find(predicate).email, password: DEMO_PASSWORD })).user; // carenest:allow-secret – mật khẩu demo của dữ liệu giả
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));
const digits = (phone) => phone.replace(/\s/g, '');

let vp;
beforeEach(async () => {
  resetDb();
  ensureChildRecordsSeeded();
  vp = await loginAs((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === 'c1');
});

let seq = 0;
/** Hồ sơ tiếp nhận tối thiểu; họ tên, ngày sinh khác nhau để không trùng hồ sơ. */
const payload = (guardianList) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ Thử ${seq}`,
      dateOfBirth: `2023-01-${String(seq).padStart(2, '0')}`,
      gender: 'MALE',
      guardians: guardianList,
      profile: filledProfile(),
    },
    classId: '',
    declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
  };
};
const newGuardian = (patch = {}) => ({
  fullName: 'Phụ huynh thử',
  relation: 'Mẹ',
  phone: '0900 000 001',
  idNumber: '999900000001',
  email: '',
  ...patch,
});
/** Bỏ CCCD của tài khoản và mọi bản ghi phụ huynh cùng SĐT (dữ liệu trước quy định). */
const clearIdOfAccount = (accountId) =>
  writeDb((d) => {
    const a = d.parentAccounts.find((x) => x.id === accountId);
    a.idNumber = '';
    d.children.forEach((c) =>
      (c.guardians || []).forEach((g) => {
        if (digits(g.phone) === a.phone) g.idNumber = '';
      }),
    );
  });

const CCCD = /^\d{12}$/;
const companionsFromGuardian = (d) => d.healthMeasurements.filter((m) => m.exam?.admin?.companion?.guardianIndex != null);

test('AC-10: mọi phụ huynh, tài khoản, người đi cùng là phụ huynh trong dữ liệu mẫu có CCCD', () => {
  const db = readDb();
  const all = db.children.flatMap((c) => c.guardians || []);
  assert.ok(all.length > 0 && all.every((g) => g.idNumber === seedCitizenIdFor(g.phone)));
  assert.ok(db.parentAccounts.every((a) => a.idNumber === seedCitizenIdFor(a.phone)));
  const exams = companionsFromGuardian(db);
  assert.ok(exams.length > 0 && exams.every((m) => CCCD.test(m.exam.admin.companion.idNumber)));
});

test('AC-10: DB demo cũ được bổ sung một lần, kể cả phụ huynh người dùng nhập trước quy định', () => {
  const db = readDb();
  const linked = db.children.find((c) => c.guardians[0]?.accountStatus === 'ACTIVE');
  const accountId = db.parentAccounts.find((a) => a.phone === digits(linked.guardians[0].phone)).id;
  const exam = companionsFromGuardian(db)[0];
  writeDb((d) => {
    d.children.find((c) => c.id === linked.id).guardians[0].idNumber = '';
    const copy = structuredClone(d.children[1]);
    d.children.push({ ...copy, id: 'ch_user_demo', guardians: [{ ...copy.guardians[0], phone: '0900 000 099', idNumber: '' }] });
    d.parentAccounts.push({ ...structuredClone(d.parentAccounts[0]), id: 'pa_user_demo', phone: '0900000098', idNumber: '', childIds: [] });
    d.healthMeasurements.find((m) => m.id === exam.id).exam.admin.companion.idNumber = '';
    d.guardianIdSeeded = true;
    delete d.guardianIdVersion;
  });
  ensureChildRecordsSeeded();
  const after = readDb();
  const account = after.parentAccounts.find((a) => a.id === accountId);
  assert.equal(after.children.find((c) => c.id === linked.id).guardians[0].idNumber, account.idNumber, 'cùng SĐT ⇒ CCCD của tài khoản');
  assert.equal(after.children.find((c) => c.id === 'ch_user_demo').guardians[0].idNumber, seedCitizenIdFor('0900 000 099'));
  assert.equal(after.parentAccounts.find((a) => a.id === 'pa_user_demo').idNumber, seedCitizenIdFor('0900000098'));
  const companion = after.healthMeasurements.find((m) => m.id === exam.id).exam.admin.companion;
  assert.equal(companion.idNumber, after.children.find((c) => c.id === exam.childId).guardians[companion.guardianIndex].idNumber);
  assert.equal(after.guardianIdSeeded, undefined, 'bỏ cờ bản cũ');
});

test('AC-10: số giả không trùng CCCD đã có của SĐT khác; cùng SĐT lấy CCCD đã ghi', () => {
  const db = {
    parentAccounts: [{ phone: '0900000096', idNumber: '999900000097' }],
    children: [
      {
        id: 'x',
        guardians: [
          { phone: '0900 000 097', idNumber: '' },
          { phone: '0900 000 096', idNumber: '' },
        ],
      },
    ],
  };
  fillMissingCitizenIds(db);
  assert.equal(db.children[0].guardians[0].idNumber, '999900000098');
  assert.equal(db.children[0].guardians[1].idNumber, '999900000097');
});

test('Phiếu khám: người đi cùng là phụ huynh mang CCCD của phụ huynh; danh sách chọn phụ huynh có CCCD', async () => {
  const view = await exams.getHealthExam('hc_c1_open', 'ch_020', { id: 'u_hoa', role: 'TEACHER', campusId: 'c1' });
  assert.ok(view.child.guardians.every((g) => CCCD.test(g.idNumber)));
  const companion = (view.draft || view.measurement).exam.admin.companion;
  assert.equal(companion.guardianIndex, 0);
  assert.equal(companion.idNumber, view.child.guardians[0].idNumber);
});

test('AC-1, AC-2: thiếu/sai CCCD ⇒ 422 theo ô; trùng trong trẻ ⇒ 422; hợp lệ ⇒ lưu đã bỏ dấu cách', async () => {
  await rejects(children.enrollChild(payload([newGuardian({ idNumber: '' })]), vp), 422, 'guardians.0.idNumber');
  await rejects(children.enrollChild(payload([newGuardian({ idNumber: '12345' })]), vp), 422, 'guardians.0.idNumber');
  await rejects(children.enrollChild(payload([newGuardian({ idNumber: 'B1234567' })]), vp), 422, 'guardians.0.idNumber');
  const two = [newGuardian(), newGuardian({ fullName: 'Phụ huynh thử 2', relation: 'Bố', phone: '0900 000 002' })];
  await rejects(children.enrollChild(payload(two), vp), 422, 'guardians');
  const saved = await children.enrollChild(payload([newGuardian({ idNumber: '9999 0000 0001' })]), vp);
  assert.equal(saved.guardians[0].idNumber, '999900000001');
});

test('AC-4: CCCD ghi cho phụ huynh khác (không có tài khoản, SĐT khác) ⇒ 409 dưới ô CCCD; SĐT đã có CCCD khác ⇒ 409 dưới ô SĐT', async () => {
  const db = readDb();
  const acc = db.parentAccounts[0];
  const lone = db.children
    .flatMap((c) => c.guardians || [])
    .find((g) => g.accountStatus === 'NOT_ACTIVATED' && !db.parentAccounts.some((a) => a.idNumber === g.idNumber));
  const at = (key, message) => (err) => err.status === 409 && err.details?.[key] === message;
  await assert.rejects(
    children.enrollChild(payload([newGuardian({ idNumber: lone.idNumber })]), vp),
    at('guardians.0.idNumber', CITIZEN_ID_TAKEN),
  );
  await assert.rejects(children.enrollChild(payload([newGuardian({ phone: acc.phone })]), vp), at('guardians.0.phone', PHONE_HAS_OTHER_ID));
  // CCCD của tài khoản: liên kết tài khoản; SĐT gõ khác ⇒ tài khoản đổi tên đăng nhập sang số đó (user chốt 2026-10-28, thay 2026-10-23).
  const sent = newGuardian({ idNumber: acc.idNumber });
  const same = await children.enrollChild(payload([sent]), vp);
  assert.equal(digits(same.guardians[0].phone), digits(sent.phone));
  assert.equal(readDb().parentAccounts.find((a) => a.id === acc.id).username, digits(sent.phone));
});

test('AC-5: tài khoản có sẵn theo CCCD nhận thông tin sửa ở form; tài khoản cũ chưa có CCCD khớp theo SĐT và được bổ sung', async () => {
  const [withId, noId] = readDb().parentAccounts;
  const linked = await children.enrollChild(payload([newGuardian({ idNumber: withId.idNumber, fullName: 'Tên gõ khác' })]), vp);
  // Sửa ở form ⇒ tài khoản đổi theo (user chốt 2026-10-28, thay "họ tên theo tài khoản" 2026-10-23).
  assert.equal(linked.guardians[0].fullName, 'Tên gõ khác');
  assert.equal(readDb().parentAccounts.find((a) => a.id === withId.id).fullName, 'Tên gõ khác');
  assert.ok(
    readDb()
      .parentAccounts.find((a) => a.id === withId.id)
      .childIds.includes(linked.id),
  );
  clearIdOfAccount(noId.id);
  const filled = await children.enrollChild(payload([newGuardian({ phone: noId.phone, idNumber: '999911113333' })]), vp);
  assert.equal(filled.guardians[0].idNumber, '999911113333');
  assert.equal(readDb().parentAccounts.find((a) => a.id === noId.id).idNumber, '999911113333');
});

const COLUMNS = IMPORT_COLUMNS;
const csvOf = (rows, columns = COLUMNS) =>
  [columns.map((c) => c.label), ...rows.map((r) => columns.map((c) => r[c.key] ?? ''))]
    .map((cells) => cells.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
const row = (n, patch = {}) => ({
  fullName: `Trẻ Nhập ${n}`,
  dateOfBirth: `0${n}/02/2023`,
  gender: 'Nam',
  guardianName: `Phụ huynh nhập ${n}`,
  relation: 'Mẹ',
  phone: `0900 001 00${n}`,
  guardianIdNumber: `99990000100${n}`,
  ...filledImportColumns(),
  ...patch,
});

test('AC-6: Excel bắt cột "Số CCCD phụ huynh"; ô trống, trùng dòng khác SĐT ⇒ dòng lỗi', async () => {
  const noColumn = readEnrollmentCsv(
    csvOf(
      [row(1)],
      COLUMNS.filter((c) => c.key !== 'guardianIdNumber'),
    ),
  );
  assert.ok(noColumn.missingColumns.includes('Số CCCD phụ huynh'));
  const file = (text) => ({ name: 'tiep-nhan.csv', text: async () => text });
  const text = csvOf([row(1), row(2, { guardianIdNumber: '' }), row(3, { guardianIdNumber: row(1).guardianIdNumber })]);
  const { rows } = await children.previewImport(file(text), vp);
  const [r1, r2, r3] = rows;
  assert.deepEqual(r1.errors, []);
  assert.equal(r1.payload.child.guardians[0].idNumber, row(1).guardianIdNumber);
  assert.ok(r2.errors.includes('Nhập số CCCD của phụ huynh'));
  assert.ok(r3.errors.some((e) => e.startsWith('Số CCCD phụ huynh trùng dòng 2')));
  await rejects(children.importChildren([r1.payload, r3.payload], vp), 422, 'file');
  const done = await children.importChildren([r1.payload], vp);
  assert.equal(done.created, 1);
});

test('AC-7: sửa hồ sơ: thiếu CCCD phải nhập; phụ huynh có tài khoản đã có CCCD giữ số của tài khoản', async () => {
  const db = readDb();
  const form = (c, patch) => ({
    fullName: c.fullName,
    dateOfBirth: c.dateOfBirth,
    gender: c.gender,
    guardians: c.guardians.map((g) => ({ fullName: g.fullName, relation: g.relation, phone: g.phone, email: g.email || '', ...patch })),
    profile: c.profile,
  });
  const linked = db.children.find((c) => c.campusId === 'c1' && c.status === 'ACTIVE' && c.guardians[0]?.accountStatus === 'ACTIVE');
  const kept = await children.updateChild(linked.id, { child: form(linked, { idNumber: '999955556666' }), reason: 'Thử sửa' }, vp);
  assert.equal(kept.guardians[0].idNumber, linked.guardians[0].idNumber);
  const account = db.parentAccounts.find((a) => a.phone === digits(linked.guardians[0].phone));
  clearIdOfAccount(account.id);
  await children.updateChild(linked.id, { child: form(linked, { idNumber: '999955558888' }), reason: 'Bổ sung CCCD' }, vp);
  assert.equal(readDb().parentAccounts.find((a) => a.id === account.id).idNumber, '999955558888', 'bổ sung vào tài khoản');
  const open = db.children.find((c) => c.campusId === 'c1' && c.status !== 'LEFT' && c.guardians[0]?.accountStatus === 'NOT_ACTIVATED');
  await rejects(children.updateChild(open.id, { child: form(open, { idNumber: '' }), reason: 'Thử sửa' }, vp), 422, 'guardians.0.idNumber');
  const fixed = await children.updateChild(open.id, { child: form(open, { idNumber: '999955557777' }), reason: 'Sửa CCCD' }, vp);
  assert.equal(fixed.guardians[0].idNumber, '999955557777');
});

// Phụ huynh nhập ở hồ sơ trẻ rồi kích hoạt ở màn tài khoản (AUTH-20; thêm kèm tạo tài khoản ngay đã bỏ — user chốt 2026-10-28, C-4 A).
test('AC-8: kích hoạt ở màn tài khoản: bắt CCCD; lệch ⇒ 409; tài khoản thiếu CCCD được bổ sung', async () => {
  const child = (await guardians.searchChildren({ campusId: 'c1' }, vp)).items.find((r) => r.canManage);
  const base = structuredClone(readDb().children.find((c) => c.id === child.id).guardians);
  const activateWith = (patch = {}) => {
    writeDb((d) => {
      d.children.find((c) => c.id === child.id).guardians = [
        ...structuredClone(base),
        {
          fullName: 'Liên hệ thử',
          relation: 'Mẹ',
          phone: '0900000003',
          email: '',
          idNumber: '999900000003',
          accountStatus: 'NOT_ACTIVATED',
          ...patch,
        },
      ];
    });
    return guardians.activateGuardians(child.id, vp);
  };
  await rejects(activateWith({ idNumber: '' }), 400);
  const other = readDb().parentAccounts.find((a) => !a.childIds.includes(child.id));
  await rejects(activateWith({ idNumber: other.idNumber }), 409, 'idNumber');
  await rejects(activateWith({ phone: other.phone }), 409, 'idNumber');
  clearIdOfAccount(other.id);
  const linked = (await activateWith({ phone: other.phone, idNumber: '999900000004' })).find((r) => r.phone === other.phone);
  assert.equal(linked.newAccount, false);
  assert.equal(linked.idNumber, '999900000004');
  assert.equal(readDb().parentAccounts.find((a) => a.id === other.id).idNumber, '999900000004');
});

test('AC-4: kích hoạt tạo tài khoản mang CCCD của hồ sơ; CCCD thuộc phụ huynh khác ⇒ 409', async () => {
  const db = readDb();
  const child = db.children.find((c) => c.campusId === 'c1' && c.status !== 'LEFT' && c.guardians[0]?.accountStatus === 'NOT_ACTIVATED');
  const setId = (value) =>
    writeDb((d) => {
      d.children.find((c) => c.id === child.id).guardians[0].idNumber = value;
    });
  setId(db.parentAccounts[0].idNumber);
  // Kích hoạt cả nhà ở màn Tài khoản phụ huynh (AUTH-20); API kích hoạt từng phụ huynh đã bỏ.
  await rejects(guardians.activateGuardians(child.id, vp), 409);
  setId('999900000005');
  await guardians.activateGuardians(child.id, vp);
  assert.equal(readDb().parentAccounts.find((a) => a.phone === digits(child.guardians[0].phone)).idNumber, '999900000005');
});

test('AC-9: mọi vai xem hồ sơ thấy CCCD phụ huynh (giáo viên cũng thấy)', async () => {
  const db = readDb();
  const cls = db.classes.find((c) => c.homeroomTeacherId && db.children.some((ch) => ch.classId === c.id && ch.status === 'ACTIVE'));
  const teacher = await loginAs((u) => u.id === cls.homeroomTeacherId);
  const list = await children.listChildren({ classId: cls.id }, teacher);
  assert.ok(list.length > 0);
  assert.ok(list.every((c) => c.guardians.every((g) => /^\d{12}$/.test(g.idNumber))));
});
