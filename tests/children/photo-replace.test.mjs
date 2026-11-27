import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const { axiosClient } = await import('@/services/http/axiosClient');
const { childrenApi: api } = await import('@/services/children/api/childrenApi');
const { saveProfilePhotos } = await import('@/utils/children/profilePhotos');

test('đổi ảnh gửi multipart cùng lý do', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    return { status: 200, headers: {}, config, data: { code: 200, data: {} } };
  };
  const photo = new File(['demo'], 'portrait.jpg', { type: 'image/jpeg' });
  await api.replaceChildPhoto(1, photo, 'Cập nhật');
  await api.replaceGuardianPhoto(1, 2, photo, 'Cập nhật');
  assert.deepEqual(
    calls.map((c) => [c.method, c.url]),
    [
      ['put', '/children/1/photo'],
      ['put', '/children/1/guardian-photos/2'],
    ],
  );
  for (const { data } of calls) {
    assert.equal(data.get('photo').name, 'portrait.jpg');
    assert.equal(data.get('reason'), 'Cập nhật');
  }
});

test('ảnh phụ huynh dùng id của hồ sơ đã lưu, không phụ thuộc thứ tự trả về', async () => {
  const calls = [];
  const childPhoto = new File(['child'], 'child.jpg', { type: 'image/jpeg' });
  const guardianPhoto = new File(['guardian'], 'guardian.jpg', { type: 'image/jpeg' });
  await saveProfilePhotos(
    '1',
    {
      photoFile: childPhoto,
      guardians: [{ idNumber: '000000000001', photoFile: guardianPhoto }, { id: '3' }],
    },
    { guardians: [{ id: '3' }, { id: '2', idNumber: '000000000001' }] },
    'Ảnh mới',
    {},
    {
      replaceChildPhoto: async (...args) => calls.push(['child', ...args]),
      replaceGuardianPhoto: async (...args) => calls.push(['guardian', ...args]),
    },
  );
  assert.deepEqual(
    calls.map((c) => c.slice(0, 3)),
    [
      ['child', '1', childPhoto],
      ['guardian', '1', '2'],
    ],
  );
  assert.equal(calls[1][3], guardianPhoto);
  assert.equal(calls[1][4], 'Ảnh mới');
});

test('ảnh lỗi trả lỗi BE về đúng ô và dừng các lần tải sau', async () => {
  const form = {
    guardians: [
      { id: '2', photoFile: {} },
      { id: '3', photoFile: {} },
    ],
  };
  const saved = { guardians: [{ id: '2' }, { id: '3' }] };
  let calls = 0;
  await assert.rejects(
    saveProfilePhotos(
      '1',
      form,
      saved,
      'Ảnh mới',
      {},
      {
        replaceGuardianPhoto: async () => {
          calls++;
          throw Object.assign(new Error('Ảnh không hợp lệ'), { details: { photo: 'Không đọc được ảnh' } });
        },
      },
    ),
    (error) => {
      assert.equal(error.photoField, 'guardians.0.photo');
      assert.deepEqual(error.details, { 'guardians.0.photo': 'Không đọc được ảnh' });
      return true;
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(
    form.guardians.map((g) => g.id),
    ['2', '3'],
  );
});

test('ảnh demo không hợp lệ giữ nguyên ảnh cũ và giáo viên không được thay ảnh', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  const { childrenMockRepository: mock, ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
  const { readDb } = await import('@/mocks/mockDatabase');
  const child = ensureChildRecordsSeeded().children.find((c) => c.status === 'ACTIVE' && c.guardians?.[0]);
  const actor = { id: 'demo', role: 'PRINCIPAL' };
  const invalid = new File(['invalid'], 'portrait.txt', { type: 'text/plain' });
  await assert.rejects(mock.replaceChildPhoto(child.id, invalid, 'Ảnh mới', actor), (e) => e.status === 422);
  assert.equal(readDb().children.find((c) => c.id === child.id).photoUrl, child.photoUrl);
  await assert.rejects(
    mock.replaceGuardianPhoto(child.id, child.guardians[0].id, invalid, 'Ảnh mới', { id: 'teacher', role: 'TEACHER' }),
    (e) => e.status === 403,
  );
});
