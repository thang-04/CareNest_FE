import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { AxiosError } from 'axios';

globalThis.window = new EventTarget();

const { axiosClient } = await import('@/services/http/axiosClient');
const { guardianApi } = await import('@/services/account/api/guardianApi');

// Dữ liệu giả theo DTO BE GuardianController / ChildController
const child = (id, guardianCount) => ({ id, fullName: `Bé demo ${id}`, dateOfBirth: '2022-05-01', classroomId: 7, campusId: 1, guardianCount });
const guardian = (userId) => ({
  userId,
  username: `09000000${userId}`,
  fullName: `Phụ huynh demo ${userId}`,
  relationship: 'MOTHER',
  status: 'ACTIVE',
  linkedAt: '2026-10-30T02:00:00Z',
});

// GET /children/guardian-overview: mục danh sách trẻ (guardians = phụ huynh trên hồ sơ) kèm tài khoản người nhận
const contact = (id, fullName, accountRecipient) => ({ id, fullName, relation: 'MOTHER', phone: `09000000${id}`, accountRecipient });
const overviewChild = (id, guardians, canManage = true) => ({ ...child(id, guardians.length), guardians, canManage });

let calls;
let bodies;
const envelope = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

beforeEach(() => {
  calls = [];
  bodies = [];
  axiosClient.defaults.adapter = async (config) => {
    const method = config.method.toUpperCase();
    const query = config.params ? `?${new URLSearchParams(Object.entries(config.params).filter(([, v]) => v != null))}` : '';
    calls.push(`${method} ${config.url}${query}`);
    if (config.data) bodies.push(JSON.parse(config.data));
    if (config.url === '/campuses') return envelope(config, [{ id: 1, code: 'CS1', name: 'Điểm trường 1' }]);
    if (config.url === '/school-structure') return envelope(config, { year: null, ageGroups: [], classes: [{ id: 7, name: 'Lớp demo', campusId: 1 }] });
    if (config.url === '/children')
      return envelope(config, { items: [child(11, 1), child(12, 0)], page: 0, size: 100, totalElements: 2, totalPages: 1 });
    if (config.url === '/children/guardian-overview')
      return envelope(config, {
        items: [
          { child: overviewChild(11, [contact(30, 'Phụ huynh demo 21', true)]), account: guardian(21) },
          { child: overviewChild(12, [contact(31, 'Phụ huynh chọn', true)]), account: null },
          { child: overviewChild(13, [contact(32, 'Bố', false), contact(33, 'Mẹ', true)], false), account: null },
          { child: overviewChild(14, [contact(34, 'Mẹ duy nhất', false)]), account: null },
        ],
        page: 0,
        size: 100,
        totalElements: 4,
        totalPages: 1,
      });
    if (config.url === '/children/11/guardians' && method === 'GET') return envelope(config, [guardian(21)]);
    if (config.url === '/children/12/guardians' && method === 'GET') return envelope(config, []);
    if (config.url.endsWith('/account-recipient')) return envelope(config, [{ id: 31, accountRecipient: true, fullName: 'Phụ huynh chọn', relation: 'MOTHER', phone: '0900000021' }]);
    if (config.url === '/parent-accounts/21/status')
      throw new AxiosError('Forbidden', AxiosError.ERR_BAD_REQUEST, config, null, {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config,
        data: { code: 403, desc: 'Bạn không có quyền quản lý tài khoản này', data: null },
      });
    return envelope(config, { exists: false });
  };
});

test('cấu trúc: điểm trường từ /campuses, lớp từ /school-structure', async () => {
  const structure = await guardianApi.getStructure();

  assert.deepEqual(structure.campuses.map((c) => c.name), ['Điểm trường 1']);
  assert.deepEqual(structure.classrooms, [{ id: 7, name: 'Lớp demo', campusId: 1 }]);
});

test('danh sách trẻ: một lần gọi guardian-overview cho cả trang, đọc người được chọn và tài khoản đã liên kết', async () => {
  const page = await guardianApi.searchChildren({ campusId: 1, page: 0, size: 100 });

  assert.deepEqual(calls, ['GET /children/guardian-overview?campusId=1&page=0&size=100']);
  assert.deepEqual(page.items.map((c) => c.guardianCount), [1, 0, 0, 0]);
  assert.deepEqual(page.items[0].guardians, [guardian(21)]);
  assert.deepEqual(page.items[1].guardians, []);
  assert.equal(page.items[1].accountRecipient.fullName, 'Phụ huynh chọn');
  assert.equal(page.items[1].accountRecipient.relation, 'Mẹ');
  // Từ 2 phụ huynh: hiện người nhận; một phụ huynh: hiện người đó dù dữ liệu cũ chưa đánh dấu người nhận
  assert.equal(page.items[2].accountRecipient.fullName, 'Mẹ');
  assert.equal(page.items[3].accountRecipient.fullName, 'Mẹ duy nhất');
  assert.ok(page.items.every((c) => !('selectionRequired' in c)));
  assert.deepEqual(page.items.map((c) => c.canManage), [true, true, false, true]);
  assert.equal(page.totalPages, 1);
});

test('thêm phụ huynh: tra SĐT trước, gửi confirmUserId khi đã có tài khoản, không gửi email', async () => {
  await guardianApi.lookupGuardian(11, '0900000099');
  await guardianApi.addGuardian(11, { phone: '0900000099', fullName: 'Phụ huynh demo', relationship: 'FATHER', email: 'demo@example.test', confirmUserId: 21 });

  assert.deepEqual(calls, ['POST /children/11/guardians/lookup', 'POST /children/11/guardians']);
  assert.deepEqual(bodies, [
    { phone: '0900000099' },
    { phone: '0900000099', fullName: 'Phụ huynh demo', relationship: 'FATHER', confirmUserId: 21 },
  ]);
});

test('gỡ, khóa, cấp mật khẩu gọi đúng API; lỗi BE trả nguyên desc', async () => {
  await guardianApi.removeGuardian(11, 21);
  await guardianApi.resetParentPassword(22);
  await assert.rejects(guardianApi.updateParentStatus(21, 'INACTIVE'), { status: 403, message: 'Bạn không có quyền quản lý tài khoản này' });

  assert.deepEqual(calls, ['DELETE /children/11/guardians/21', 'POST /parent-accounts/22/temporary-password', 'PATCH /parent-accounts/21/status']);
  assert.deepEqual(bodies, [{ status: 'INACTIVE' }]);
});

test('kích hoạt gửi guardianId được chọn để máy chủ chặn lựa chọn cũ', async () => {
  await guardianApi.activateGuardians(11, null, 31);
  assert.deepEqual(bodies, [{ guardianId: 31 }]);
});
