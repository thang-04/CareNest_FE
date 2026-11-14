import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPhotoUrlBatcher, photoUserId } from '../../src/utils/account/photoUrlBatcher.js';

const NOW = Date.parse('2026-11-14T03:00:00Z');
const inFifteen = new Date(NOW + 15 * 60 * 1000).toISOString();

const recorder = (respond) => {
  const calls = [];
  return {
    calls,
    fetchUrls: async (ids) => {
      calls.push(ids);
      return respond(ids);
    },
  };
};

test('AUTH-27: gom các yêu cầu cùng lúc thành một lần gọi, người không có ảnh trả null', async () => {
  const api = recorder(() => [{ userId: 30, url: 'https://s3/a', expiresAt: inFifteen }]);
  const batcher = createPhotoUrlBatcher({ fetchUrls: api.fetchUrls, now: () => NOW });

  const [a, b, again] = await Promise.all([batcher.get(30), batcher.get(31), batcher.get(30)]);

  assert.deepEqual(api.calls, [[30, 31]]);
  assert.equal(a, 'https://s3/a');
  assert.equal(again, 'https://s3/a');
  assert.equal(b, null);
});

test('AUTH-27: dùng cache tới trước hạn link, quá hạn thì hỏi lại', async () => {
  let clock = NOW;
  const api = recorder(() => [{ userId: 30, url: 'https://s3/a', expiresAt: inFifteen }]);
  const batcher = createPhotoUrlBatcher({ fetchUrls: api.fetchUrls, now: () => clock });

  await batcher.get(30);
  clock = NOW + 13 * 60 * 1000;
  await batcher.get(30);
  assert.equal(api.calls.length, 1);

  clock = NOW + 14 * 60 * 1000 + 1;
  await batcher.get(30);
  assert.equal(api.calls.length, 2);
});

test('AUTH-27: lỗi mạng trả null và không cache', async () => {
  let fail = true;
  const api = recorder(() => {
    if (fail) throw new Error('network');
    return [{ userId: 30, url: 'https://s3/a', expiresAt: inFifteen }];
  });
  const batcher = createPhotoUrlBatcher({ fetchUrls: api.fetchUrls, now: () => NOW });

  assert.equal(await batcher.get(30), null);
  fail = false;
  assert.equal(await batcher.get(30), 'https://s3/a');
  assert.equal(api.calls.length, 2);
});

test('AUTH-27: chia lô tối đa 100 người, invalidate buộc hỏi lại', async () => {
  const api = recorder(() => []);
  const batcher = createPhotoUrlBatcher({ fetchUrls: api.fetchUrls, now: () => NOW });

  await Promise.all(Array.from({ length: 150 }, (_, i) => batcher.get(i + 1)));
  assert.deepEqual(
    api.calls.map((ids) => ids.length),
    [100, 50],
  );

  batcher.invalidate(1);
  await batcher.get(1);
  assert.deepEqual(api.calls.at(-1), [1]);
});

test('AUTH-27: chỉ nhận id tài khoản BE dạng số dương', () => {
  assert.equal(photoUserId({ userId: 12 }), 12);
  assert.equal(photoUserId({ id: '34' }), 34);
  assert.equal(photoUserId({ id: 'u_teacher' }), null);
  assert.equal(photoUserId({ id: 0 }), null);
  assert.equal(photoUserId(null), null);
});
