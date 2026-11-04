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
const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { guardianMockRepository: guardians } = await import('@/services/account/mock/guardianMockRepository');
const { PARENT_ACCOUNT_STATUS, PARENT_ACCOUNT_STATUS_LABELS } = await import('@/models/children/childrenConstants');
const { emptyChildInfo, emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { normalizePhone, validateChildInfo } = await import('@/utils/children/childrenValidation');
const { todayInput } = await import('@/utils/format');
const { filledMedicalHistory, filledProfile } = await import('./profileFixture.mjs');

/*
 * BE giả theo nghiệp vụ tiếp nhận trẻ, phụ huynh đã chốt (plan docs/plans/completed/2026-10-28-mock-be-current-business.md).
 * Dữ liệu giả: CCCD bắt đầu bằng 999, SĐT 0900 000 7xx.
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const VP_CREATE_ONLY = { ...VP, areas: { children: 'VC@c1' } };
const VP_UPDATE_ONLY = { ...VP, areas: { children: 'VU@c1' } };
const TEACHER = { id: 'u_teacher_test', role: 'TEACHER' };
const digits = (v) => String(v).replace(/\s/g, '');
const rejects = (promise, status, key) =>
  assert.rejects(promise, (err) => err.status === status && (!key || Object.hasOwn(err.details || {}, key)));

const guardian = (n, patch = {}) => ({
  fullName: `Phụ huynh nghiệp vụ ${n}`,
  relation: 'Mẹ',
  phone: `0900 000 7${String(n).padStart(2, '0')}`,
  idNumber: `9999000007${String(n).padStart(2, '0')}`,
  email: '',
  ...patch,
});
let seq = 0;
const row = (list) => {
  seq += 1;
  return {
    child: {
      ...emptyChildInfo(),
      fullName: `Trẻ thử nghiệp vụ ${seq}`,
      dateOfBirth: '2023-04-11',
      gender: 'FEMALE',
      guardians: list,
      profile: filledProfile(),
    },
    declaration: { ...emptyDeclaration(), medicalHistory: filledMedicalHistory() },
    classId: '',
  };
};
const accountOfPhone = (phone) => readDb().parentAccounts.find((a) => a.username === digits(phone));
const edit = (child, list, reason = 'Sửa thử (giả)') =>
  children.updateChild(child.id, { child: { ...child, guardians: list }, reason }, VP);

beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
});

test('AC-1: không còn API kích hoạt từng phụ huynh; kích hoạt khi lưu form hoặc cả nhà ở màn Tài khoản phụ huynh', () => {
  assert.equal(children.activateParentAccount, undefined);
  assert.equal(children.resendParentSms, undefined);
  assert.equal(typeof guardians.activateGuardians, 'function');
});

test('AC-2: khóa tài khoản ⇒ phụ huynh trên hồ sơ "Đã khóa"; DB demo cũ PENDING_ACTIVATION được chuyển', async () => {
  assert.equal(PARENT_ACCOUNT_STATUS.PENDING_ACTIVATION, undefined);
  assert.equal(PARENT_ACCOUNT_STATUS_LABELS.INACTIVE, 'Đã khóa');
  const child = readDb().children.find(
    (c) => c.campusId === 'c1' && c.status === 'ACTIVE' && c.guardians.some((g) => g.accountStatus === 'ACTIVE'),
  );
  const [linked] = await guardians.listGuardians(child.id, VP);
  await guardians.updateParentStatus(linked.userId, 'INACTIVE', VP);
  const { child: view } = await children.getChildDetail(child.id, VP);
  assert.ok(view.guardians.some((g) => g.accountStatus === PARENT_ACCOUNT_STATUS.INACTIVE));

  writeDb((d) => {
    d.parentAccounts.find((a) => a.id === linked.userId).status = 'PENDING_ACTIVATION';
    d.children
      .find((c) => c.id === child.id)
      .guardians.forEach((g) => {
        if (g.accountStatus === 'INACTIVE') g.accountStatus = 'PENDING_ACTIVATION';
      });
    delete d.parentStatusVersion;
  });
  ensureChildRecordsSeeded();
  const db = readDb();
  const account = db.parentAccounts.find((a) => a.id === linked.userId);
  assert.deepEqual([account.status, account.mustChangePassword], ['ACTIVE', true]);
  assert.ok(db.children.find((c) => c.id === child.id).guardians.every((g) => g.accountStatus !== 'PENDING_ACTIVATION'));
});

test('AC-3: mở lại hồ sơ theo quyền tiếp nhận (Thêm) ở điểm trường của trẻ, không cần quyền Sửa', async () => {
  const target = readDb().children.find((c) => c.campusId === 'c1' && c.status === 'ACTIVE');
  await children.withdrawChild(target.id, { leftAt: todayInput(), reason: 'Chuyển nhà (giả)' }, VP);
  await rejects(children.readmitChild(target.id, { reason: 'Quay lại (giả)' }, VP_UPDATE_ONLY), 403);
  const back = await children.readmitChild(target.id, { reason: 'Quay lại (giả)' }, VP_CREATE_ONLY);
  assert.equal(back.status, 'PENDING_PLACEMENT');
});

test('AC-4: người chỉ có quyền Sửa hồ sơ trẻ tra được tài khoản theo CCCD; giáo viên thì không', async () => {
  const account = readDb().parentAccounts.find((a) => a.idNumber && a.status === 'ACTIVE');
  const found = await children.findParentAccountByCitizenId(account.idNumber, VP_UPDATE_ONLY);
  assert.equal(found.id, account.id);
  await rejects(children.findParentAccountByCitizenId(account.idNumber, TEACHER), 403);
});

test('AC-5: Sửa hồ sơ không bỏ được phụ huynh đã liên kết tài khoản; gỡ ở màn Tài khoản phụ huynh rồi mới bỏ', async () => {
  const saved = await children.enrollChild(row([guardian(1), guardian(2, { fullName: 'Bố nghiệp vụ', relation: 'Bố' })]), VP);
  await rejects(edit(saved, [saved.guardians[0]]), 422, 'guardians');
  assert.equal(readDb().children.find((c) => c.id === saved.id).guardians.length, 2);
  const father = (await guardians.listGuardians(saved.id, VP)).find((g) => g.fullName === 'Bố nghiệp vụ');
  await guardians.removeGuardian(saved.id, father.userId, VP);
  const after = await edit(saved, [saved.guardians[0]]);
  assert.deepEqual(
    after.guardians.map((g) => g.fullName),
    ['Phụ huynh nghiệp vụ 1'],
  );
});

test('AC-6: SĐT dạng +84 là cùng số với tài khoản (tên đăng nhập 0…)', async () => {
  const twoFormats = validateChildInfo({
    ...row([guardian(3), guardian(4, { phone: '+84 900 000 703', relation: 'Bố' })]).child,
  });
  assert.equal(twoFormats.guardians, 'Hai phụ huynh không được dùng chung số điện thoại');
  assert.equal(normalizePhone('+84 912 345 678'), '0912345678');

  const saved = await children.enrollChild(row([guardian(5)]), VP);
  const [g] = saved.guardians;
  const account = accountOfPhone(g.phone);
  const sent = account.sms.length;
  // Chỉ đổi CCCD, SĐT gõ dạng +84 của cùng số ⇒ không phải "đổi cùng lúc CCCD và SĐT", không cấp mật khẩu mới.
  const res = await edit(saved, [{ ...g, phone: `+84 ${digits(g.phone).slice(1)}`, idNumber: '999900000799' }]);
  assert.deepEqual(
    res.accountChanges.map((c) => c.phoneChanged),
    [false],
  );
  const after = accountOfPhone(g.phone);
  assert.deepEqual([after.id, after.idNumber, after.sms.length], [account.id, '999900000799', sent]);
  assert.equal(res.guardians[0].accountStatus, 'ACTIVE');
});

test('AC-7: email tài khoản phụ huynh lưu chữ thường; lưu lại cùng email khác hoa/thường không sửa tài khoản', async () => {
  const saved = await children.enrollChild(row([guardian(6, { email: 'Me.Nghiep.Vu@Example.TEST' })]), VP);
  assert.equal(accountOfPhone(guardian(6).phone).email, 'me.nghiep.vu@example.test');
  const res = await edit(saved, saved.guardians, 'Lưu lại (giả)');
  assert.deepEqual(res.accountChanges, []);
});
