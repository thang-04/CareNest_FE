import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();

const { createPickupApi } = await import('@/services/pickup/api/pickupApi');
const { readDb } = await import('@/mocks/mockDatabase');
const { pickupMockRepository } = await import('@/services/pickup/mock/pickupMockRepository');

/*
 * Đón trẻ nối BE qua beClient (PickupController): adapter nhận data beClient đã bóc envelope và đổi id sang chuỗi, trả shape
 * màn đang dùng (quan hệ bằng chữ, phụ huynh có index) và chỉ gửi field BE nhận. Lớp lấy GET /pickups/classes. Dữ liệu giả.
 */
const record = {
  id: '90',
  date: '2026-11-12',
  childId: '11',
  childName: 'Bé demo',
  classId: '7',
  className: 'Lớp A1',
  outcome: 'HANDED_OVER',
  verification: 'PHOTO_MATCH',
  guardianPosition: 0,
  pickupPersonName: 'Mẹ demo',
  pickupPersonRelationship: 'MOTHER',
  pickupPersonPhone: '0900000001',
  handedOverAt: '2026-11-12T08:30:00Z',
  note: '',
  notifiedParents: 1,
  recordedBy: 40,
  recordedByName: 'Cô demo',
  recordedAt: '2026-11-12T08:31:00Z',
};
const row = {
  child: { id: '11', code: 'HS001', fullName: 'Bé demo', gender: 'MALE' },
  attendanceStatus: 'PRESENT',
  status: 'PICKED_UP',
  pickup: record,
  attempts: [record],
};

// Client giả ghi lại từng lời gọi; trả dữ liệu theo "METHOD /url"
const fakeClient = (responses = {}) => {
  const calls = [];
  const call = (method) => async (url, a, b) => {
    const isBody = method === 'post' || method === 'put';
    calls.push({ method, url, body: isBody ? a : undefined, params: isBody ? b?.params : a?.params });
    return responses[`${method.toUpperCase()} ${url}`];
  };
  return { calls, get: call('get'), post: call('post'), put: call('put') };
};

test('danh sách lớp lấy từ GET /pickups/classes; BE trả rỗng thì danh sách rỗng', async () => {
  const classes = [{ id: '7', name: 'Lớp A1', campusId: '1', ageGroupId: '2' }];
  const client = fakeClient({ 'GET /pickups/classes': classes });
  assert.deepEqual(await createPickupApi(client).getPickupClasses(), classes);
  assert.deepEqual(
    client.calls.map((c) => c.url),
    ['/pickups/classes'],
  );
  assert.deepEqual(await createPickupApi(fakeClient()).getPickupClasses(), []);
});

test('bảng đón: quan hệ người đón bằng chữ ở lần trả và các lần xác minh', async () => {
  const client = fakeClient({
    'GET /classes/7/pickups': { classId: '7', className: 'Lớp A1', date: '2026-11-12', today: '2026-11-12', rows: [row] },
  });
  const board = await createPickupApi(client).getPickupBoard({ classId: '7', date: '2026-11-12' });
  assert.deepEqual(client.calls[0].params, { date: '2026-11-12' });
  const [r] = board.rows;
  assert.equal(r.status, 'PICKED_UP');
  assert.equal(r.pickup.pickupPersonRelation, 'Mẹ');
  assert.equal(r.attempts[0].pickupPersonRelation, 'Mẹ');
});

test('trẻ cần trả: trải dòng bảng đón, phụ huynh có index theo vị trí và quan hệ bằng chữ', async () => {
  const client = fakeClient({
    'GET /pickups/children/11': {
      row,
      date: '2026-11-12',
      classId: '7',
      className: 'Lớp A1',
      guardians: [
        { position: 0, fullName: 'Mẹ demo', relationship: 'MOTHER', phone: '0900000001', photoUrl: '/children/11/guardians/55/photo' },
      ],
    },
  });
  const context = await createPickupApi(client).getPickupChild('11');
  assert.equal(context.status, 'PICKED_UP');
  assert.equal(context.child.fullName, 'Bé demo');
  assert.equal(context.classId, '7');
  assert.equal(context.pickup.pickupPersonRelation, 'Mẹ');
  assert.deepEqual(context.guardians, [
    {
      position: 0,
      index: 0,
      fullName: 'Mẹ demo',
      relationship: 'MOTHER',
      relation: 'Mẹ',
      phone: '0900000001',
      photoUrl: '/children/11/guardians/55/photo',
    },
  ]);
});

test('ghi trả trẻ chỉ gửi field BE nhận; gọi phụ huynh không gửi vị trí phụ huynh', async () => {
  const client = fakeClient({ 'POST /pickups': record });
  const api = createPickupApi(client);
  const saved = await api.recordPickupResult({
    childId: '11',
    verification: 'PHOTO_MATCH',
    guardianPosition: 0,
    pickupPersonName: 'Mẹ demo',
    pickupPersonRelation: 'Mẹ',
    pickupPersonPhone: '',
    handoverTime: '15:30',
    note: '',
  });
  await api.recordPickupResult({
    childId: '11',
    verification: 'PHONE_DECLINED',
    guardianPosition: 0,
    pickupPersonName: '',
    pickupPersonRelation: '',
    pickupPersonPhone: '',
    handoverTime: '',
    note: 'Phụ huynh từ chối (giả)',
  });
  assert.deepEqual(
    client.calls.map((c) => c.body),
    [
      { childId: '11', verification: 'PHOTO_MATCH', guardianPosition: 0, handoverTime: '15:30', note: '' },
      { childId: '11', verification: 'PHONE_DECLINED', guardianPosition: null, handoverTime: null, note: 'Phụ huynh từ chối (giả)' },
    ],
  );
  assert.equal(saved.pickupPersonRelation, 'Mẹ');
});

test('kết quả trong ngày: quan hệ bằng chữ', async () => {
  const client = fakeClient({ 'GET /pickups': [record] });
  const results = await createPickupApi(client).getPickupResults({ date: '2026-11-12' });
  assert.deepEqual(client.calls[0].params, { date: '2026-11-12' });
  assert.equal(results[0].pickupPersonRelation, 'Mẹ');
  assert.equal(results[0].className, 'Lớp A1');
});

test('mock: danh sách lớp chỉ gồm lớp năm đang hoạt động giáo viên được phân công, cùng shape BE', async () => {
  const minhAnh = readDb().users.find((u) => u.email === 'minhanh.le@carenest.edu.vn');
  const classes = await pickupMockRepository.getPickupClasses(minhAnh);
  assert.ok(classes.length > 0);
  for (const c of classes) assert.deepEqual(Object.keys(c).sort(), ['ageGroupId', 'campusId', 'id', 'name']);
  const db = readDb();
  for (const c of classes) assert.ok(db.classes.find((x) => x.id === c.id).teacherIds.includes(minhAnh.id));
  const kitchen = db.users.find((u) => u.role === 'KITCHEN_STAFF');
  assert.deepEqual(await pickupMockRepository.getPickupClasses(kitchen), []);
});
