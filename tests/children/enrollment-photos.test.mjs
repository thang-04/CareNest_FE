import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enrollmentPhotoRequest, portraitFileError, PORTRAIT_MAX_BYTES } from '../../src/utils/children/enrollmentPhotos.js';
import { axiosClient } from '../../src/services/http/axiosClient.js';
import { childrenApi } from '../../src/services/children/api/childrenApi.js';
import { fetchChildPhoto } from '../../src/services/privatePhotoService.js';
import { pickupApi } from '../../src/services/pickup/api/pickupApi.js';

globalThis.window = new EventTarget();
const respond = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data });
const file = (name) => new File(['synthetic-image'], name, { type: 'image/png' });
const payload = () => ({
  child: {
    fullName: 'Trẻ giả',
    guardians: [
      { fullName: 'Mẹ giả', relation: 'Mẹ' },
      { fullName: 'Bố giả', relation: 'Bố' },
    ],
  },
  campusId: 1,
});

test('ảnh không bắt buộc; kiểm tệp rỗng, dung lượng, định dạng trước khi chọn', () => {
  assert.equal(portraitFileError(file('child.png')), '');
  assert.equal(portraitFileError(new File([], 'empty.png', { type: 'image/png' })), 'Chọn tệp ảnh có nội dung');
  assert.equal(portraitFileError({ size: PORTRAIT_MAX_BYTES + 1, type: 'image/png' }), 'Ảnh tối đa 2 MB');
  assert.equal(portraitFileError({ size: 10, type: 'image/svg+xml' }), 'Chọn ảnh JPG, PNG hoặc WEBP');
});

test('không có ảnh giữ JSON, không gửi photoUrl và mã quan hệ theo contract BE', () => {
  const input = payload();
  input.child.photoUrl = 'blob:preview';
  const request = enrollmentPhotoRequest(input);
  assert.equal(request.config, undefined);
  assert.equal(request.body.child.guardians[0].relation, 'MOTHER');
  assert.equal('photoUrl' in request.body.child, false);
  assert.equal(input.child.guardians[0].relation, 'Mẹ', 'không mutate form');
});

test('multipart gắn ảnh đúng người sau đổi thứ tự/xóa phụ huynh, không để File trong JSON', async () => {
  const input = payload();
  const child = file('child.png'),
    mother = file('mother.png'),
    father = file('father.png');
  input.child.photoFile = child;
  input.child.guardians[0].photoFile = mother;
  input.child.guardians[1].photoFile = father;
  input.child.guardians.reverse();
  const { body, config } = enrollmentPhotoRequest(input);
  assert.ok(body instanceof FormData);
  assert.equal(body.get('guardianPhoto0').name, 'father.png');
  assert.equal(body.get('guardianPhoto1').name, 'mother.png');
  assert.equal(body.get('childPhoto').name, 'child.png');
  const json = JSON.parse(await body.get('payload').text());
  assert.equal(json.child.guardians[0].fullName, 'Bố giả');
  assert.equal('photoFile' in json.child, false);
  assert.equal('photoFile' in json.child.guardians[0], false);
  assert.equal(config.headers['Content-Type'], undefined, 'trình duyệt đặt multipart boundary');
  input.child.guardians.shift();
  const afterRemove = enrollmentPhotoRequest(input).body;
  assert.equal(afterRemove.get('guardianPhoto0').name, 'mother.png');
  assert.equal(afterRemove.has('guardianPhoto1'), false);
});

test('API tiếp nhận gửi FormData cùng một request, còn JSON không ảnh vẫn dùng được', async (t) => {
  const original = axiosClient.defaults.adapter;
  t.after(() => {
    axiosClient.defaults.adapter = original;
  });
  const sent = [];
  axiosClient.defaults.adapter = async (config) => {
    sent.push(config);
    return respond(config, { code: 201, data: { id: 1 } });
  };
  const input = payload();
  input.child.photoFile = file('child.png');
  // Adapter đổi id BE sang chuỗi (plan 2026-11-11-children-module-be-wiring)
  assert.equal((await childrenApi.enrollChild(input)).id, '1');
  assert.ok(sent[0].data instanceof FormData);
  await childrenApi.enrollChild(payload());
  assert.equal(JSON.parse(sent[1].data).child.fullName, 'Trẻ giả');
  assert.equal(sent.length, 2);
});

test('ảnh private tải blob qua API có token, từ chối URL ngoài hệ thống', async (t) => {
  const original = axiosClient.defaults.adapter;
  t.after(() => {
    axiosClient.defaults.adapter = original;
  });
  const blob = new Blob(['portrait'], { type: 'image/png' });
  const sent = [];
  axiosClient.defaults.adapter = async (config) => {
    sent.push(config);
    return respond(config, blob);
  };
  assert.equal(await fetchChildPhoto('/children/1/guardian-photos/7'), blob);
  assert.equal(sent[0].responseType, 'blob');
  await assert.rejects(fetchChildPhoto('https://outside.invalid/image.png'));
  await assert.rejects(fetchChildPhoto('/children/1/photo?token=bad'));
  assert.equal(sent.length, 1);
});

test('pickup adapter giữ ảnh, đưa row vào context và dùng đúng position phụ huynh BE', async (t) => {
  const original = axiosClient.defaults.adapter;
  t.after(() => {
    axiosClient.defaults.adapter = original;
  });
  axiosClient.defaults.adapter = async (config) =>
    respond(config, {
      code: 200,
      data: {
        row: { child: { id: 1, fullName: 'Trẻ giả' }, status: 'WAITING' },
        guardians: [{ position: 1, fullName: 'Mẹ giả', relationship: 'MOTHER', photoUrl: '/children/1/guardian-photos/7' }],
      },
    });
  const result = await pickupApi.getPickupChild(1);
  assert.equal(result.child.id, 1);
  assert.equal(result.guardians[0].index, 1);
  assert.equal(result.guardians[0].relation, 'Mẹ');
  assert.equal(result.guardians[0].photoUrl, '/children/1/guardian-photos/7');
});

test('giáo viên xem ảnh phụ huynh; sửa hồ sơ và đổi thứ tự giữ ảnh đúng danh tính', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const { readDb, resetDb, writeDb } = await import('../../src/mocks/mockDatabase.js');
  const { childrenMockRepository: children, ensureChildRecordsSeeded } = await import(
    '../../src/services/children/mock/childrenMockRepository.js'
  );
  const { filledProfile } = await import('./profileFixture.mjs');
  resetDb();
  ensureChildRecordsSeeded();
  const db = readDb();
  const child = db.children.find((c) => c.status === 'ACTIVE' && db.classes.find((cls) => cls.id === c.classId)?.teacherIds?.length);
  assert.ok(child, 'fixture có trẻ thuộc lớp giáo viên');
  const teacherId = db.classes.find((cls) => cls.id === child.classId).teacherIds[0];
  const teacher = db.users.find((u) => u.id === teacherId);
  const principal = db.users.find((u) => u.role === 'PRINCIPAL');
  writeDb((data) => {
    const record = data.children.find((c) => c.id === child.id);
    record.photoUrl = 'data:image/jpeg;base64,Y2hpbGQ=';
    record.guardians = [0, 1].map((i) => ({
      fullName: `Phụ huynh thử ${i}`,
      relation: i ? 'Bố' : 'Mẹ',
      phone: `090099771${i}`,
      idNumber: `99999999771${i}`,
      email: '',
      accountStatus: 'NOT_ACTIVATED',
    }));
    record.guardians.forEach((g, i) => {
      g.photoUrl = `data:image/jpeg;base64,cGFyZW50${i}`;
    });
  });
  const before = await children.getChildDetail(child.id, teacher);
  assert.ok(before.child.guardians[0].photoUrl);
  assert.equal('smsStatus' in before.child.guardians[0], false);
  const expected = new Map(before.child.guardians.map((g) => [g.idNumber, g.photoUrl]));
  const input = {
    ...before.child,
    profile: filledProfile(),
    guardians: [...before.child.guardians].reverse().map(({ photoUrl: _url, ...g }) => g),
  };
  await children.updateChild(child.id, { child: input, reason: 'Kiểm thử giữ ảnh (giả)' }, principal);
  const after = await children.getChildDetail(child.id, teacher);
  assert.equal(after.child.photoUrl, before.child.photoUrl);
  for (const guardian of after.child.guardians) assert.equal(guardian.photoUrl, expected.get(guardian.idNumber));
});
