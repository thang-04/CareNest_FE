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
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { guardianMockRepository: guardians } = await import('@/services/account/mock/guardianMockRepository');

/*
 * Kích hoạt tài khoản phụ huynh theo hồ sơ trẻ (user chốt 2026-10-23): thông tin lấy từ hồ sơ, không nhập ở màn tài khoản;
 * trẻ có 2 phụ huynh thì kích hoạt một lần tạo cả 2. Dữ liệu giả của seed (CCCD bắt đầu bằng 999).
 */
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const digits = (v) => String(v).replace(/\s/g, '');
const notStaff = (phone) => !readDb().users.some((u) => u.role !== 'PARENT' && digits(u.phone || '') === digits(phone));

let child;
beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
  // Bé có 2 phụ huynh trên hồ sơ, chưa ai có tài khoản (SĐT không trùng nhân sự, không trùng tài khoản có sẵn).
  const db = readDb();
  const free = (g) =>
    g.accountStatus === 'NOT_ACTIVATED' && notStaff(g.phone) && !db.parentAccounts.some((a) => a.phone === digits(g.phone));
  const base = db.children.find((c) => c.campusId === 'c1' && c.status === 'ACTIVE' && c.guardians.length === 1 && free(c.guardians[0]));
  writeDb((d) => {
    const target = d.children.find((c) => c.id === base.id);
    target.guardians.push({
      fullName: 'Phụ huynh thứ hai (giả)',
      relation: 'Ông',
      phone: '0900 000 301',
      idNumber: '999900000301',
      email: '',
      accountStatus: 'NOT_ACTIVATED',
    });
  });
  child = readDb().children.find((c) => c.id === base.id);
});

test('phụ huynh chưa có tài khoản lấy từ hồ sơ trẻ; kích hoạt một lần tạo cả 2, mật khẩu tạm gửi qua SMS', async () => {
  const pending = await guardians.listPendingGuardians(child.id, VP);
  assert.equal(pending.length, 2);
  assert.deepEqual(
    pending.map((p) => [p.fullName, p.relation, digits(p.phone)]),
    child.guardians.map((g) => [g.fullName, g.relation, digits(g.phone)]),
  );
  assert.ok(pending.every((p) => p.problems.length === 0 && !p.hasAccount));
  const results = await guardians.activateGuardians(child.id, VP);
  assert.equal(results.length, 2);
  // Không trả mật khẩu về giao diện, không in phiếu (user bỏ màn in phiếu 2026-10-23).
  assert.ok(results.every((r) => r.newAccount && r.smsStatus === 'SENT' && !('temporaryPassword' in r)));
  assert.equal(results[1].relation, 'Ông', 'giữ quan hệ như hồ sơ');
  assert.equal((await guardians.listPendingGuardians(child.id, VP)).length, 0);
  assert.equal((await guardians.listGuardians(child.id, VP)).length, 2);
  await assert.rejects(guardians.activateGuardians(child.id, VP), (err) => err.status === 409);
});

test('một phụ huynh thiếu CCCD trên hồ sơ ⇒ 400, không tạo tài khoản nào; giáo viên không kích hoạt được', async () => {
  writeDb((d) => {
    d.children.find((c) => c.id === child.id).guardians[1].idNumber = '';
  });
  const pending = await guardians.listPendingGuardians(child.id, VP);
  assert.ok(pending[1].problems.length > 0);
  const before = readDb().parentAccounts.length;
  await assert.rejects(guardians.activateGuardians(child.id, VP), (err) => err.status === 400);
  assert.equal(readDb().parentAccounts.length, before, 'không tạo tài khoản cho người còn lại');
  await assert.rejects(guardians.activateGuardians(child.id, TEACHER), (err) => err.status === 403);
});

test('Hiệu trưởng kích hoạt được (toàn trường, user chốt 2026-10-23)', async () => {
  const PRINCIPAL = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
  const results = await guardians.activateGuardians(child.id, PRINCIPAL);
  assert.equal(results.length, 2);
  const row = (await guardians.searchChildren({ campusId: child.campusId }, PRINCIPAL)).items.find((r) => r.id === child.id);
  assert.equal(row.canManage, true);
});

test('SMS lỗi lần đầu (số giả kết thúc 99) ⇒ hồ sơ trẻ ghi "Gửi SMS lỗi"; cấp mật khẩu mới gửi lại qua SMS', async () => {
  writeDb((d) => {
    d.children.find((c) => c.id === child.id).guardians[1].phone = '0900 000 399';
  });
  const results = await guardians.activateGuardians(child.id, VP);
  const failed = results.find((r) => digits(r.username) === '0900000399');
  assert.equal(failed.smsStatus, 'FAILED');
  const onProfile = () =>
    readDb()
      .children.find((c) => c.id === child.id)
      .guardians.find((g) => digits(g.phone) === '0900000399');
  assert.equal(onProfile().smsStatus, 'FAILED');
  const again = await guardians.resetParentPassword(failed.userId, VP);
  assert.equal(again.smsStatus, 'SENT');
  assert.ok(!('temporaryPassword' in again));
  assert.equal(onProfile().smsStatus, 'SENT');
});
