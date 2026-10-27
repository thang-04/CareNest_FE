import assert from 'node:assert/strict';
import { test } from 'node:test';

// 401 → refresh/hết phiên của axiosClient được kiểm ở tests/auth/transport.test.mjs.
const { singleFlight } = await import('../../src/services/http/singleFlight.js');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('singleFlight gộp các lần gọi khi lần trước chưa xong, xong rồi thì gọi lại được', async () => {
  let calls = 0;
  const run = singleFlight(async () => {
    calls++;
    await delay(5);
    return calls;
  });
  const results = await Promise.all([run(), run(), run()]);
  assert.equal(calls, 1);
  assert.deepEqual(results, [1, 1, 1]);
  await run();
  assert.equal(calls, 2);
});
