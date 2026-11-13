import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { listAllChildren } = await import('@/services/children/api/childrenApi');

const respond = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });
const child = (id) => ({ id, fullName: `Trẻ ${id}`, dateOfBirth: '2021-01-01', classroomId: 7, campusId: 1, guardianCount: 1 });

// G94-180/CHD-09: gửi năm học; id BE đổi sang chuỗi (plan 2026-11-11-children-module-be-wiring)
test('GET /children dạng trang: đọc hết các trang, gửi năm học, trả mảng, classroomId → classId, id chuỗi', async () => {
  const sent = [];
  axiosClient.defaults.adapter = async (config) => {
    sent.push(config.params);
    return respond(config, { items: config.params.page === 0 ? [child(1), child(2)] : [child(3)], page: config.params.page, size: 100, totalElements: 3, totalPages: 2 });
  };
  const list = await listAllChildren({ classId: 7, status: 'ACTIVE', schoolYear: 5 });
  assert.deepEqual(
    list.map((c) => [c.id, c.classId]),
    [
      ['1', '7'],
      ['2', '7'],
      ['3', '7'],
    ],
  );
  assert.deepEqual(list[0].guardians, []);
  assert.deepEqual(sent, [
    { schoolYear: 5, classroomId: 7, page: 0, size: 100 },
    { schoolYear: 5, classroomId: 7, page: 1, size: 100 },
  ]);
});

test('GET /children: không có trẻ ⇒ mảng rỗng; BE trả mảng thì vẫn đọc được', async () => {
  axiosClient.defaults.adapter = async (config) => respond(config, { items: [], page: 0, size: 100, totalElements: 0, totalPages: 0 });
  assert.deepEqual(await listAllChildren(), []);
  axiosClient.defaults.adapter = async (config) => respond(config, [child(9)]);
  assert.equal((await listAllChildren())[0].id, '9');
});
