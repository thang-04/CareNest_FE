import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';

// axiosClient phát UNAUTHORIZED_EVENT lên window; Node không có window nên dùng EventTarget thay.
globalThis.window = new EventTarget();

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { UNAUTHORIZED_EVENT } = await import('../../src/services/http/tokenStorage.js');
const { singleFlight } = await import('../../src/services/http/singleFlight.js');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mọi request trả 401 sau 5ms, để các request song song cùng về khi logout còn đang chạy.
axiosClient.defaults.adapter = async (config) => {
  await delay(5);
  const response = { status: 401, statusText: 'Unauthorized', data: { message: 'Token hết hạn' }, headers: {}, config };
  throw new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, null, response);
};

const countEvents = () => {
  const counter = { value: 0 };
  const onEvent = () => counter.value++;
  window.addEventListener(UNAUTHORIZED_EVENT, onEvent);
  counter.stop = () => window.removeEventListener(UNAUTHORIZED_EVENT, onEvent);
  return counter;
};

test('401 của API thường phát sự kiện hết phiên, 401 của login và logout thì không', async () => {
  const events = countEvents();
  await assert.rejects(axiosClient.get('/children'), { status: 401 });
  await assert.rejects(axiosClient.post('/auth/login', {}), { status: 401 });
  await assert.rejects(axiosClient.post('/auth/logout'), { status: 401 });
  events.stop();
  assert.equal(events.value, 1);
});

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

test('nhiều request song song cùng 401 chỉ gây đúng 1 lần logout, không lặp', async () => {
  let logoutCalls = 0;
  // Nối giống AuthContext: listener gọi logout đã bọc singleFlight; logout gọi POST /auth/logout (cũng 401).
  const logout = singleFlight(async () => {
    logoutCalls++;
    try {
      await axiosClient.post('/auth/logout');
    } catch {
      /* logout local vẫn đủ */
    }
  });
  let lastLogout = null;
  const onUnauthorized = () => {
    lastLogout = logout();
  };
  const events = countEvents();
  window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);

  await Promise.allSettled([axiosClient.get('/children'), axiosClient.get('/classes'), axiosClient.get('/menus')]);
  await lastLogout;
  await delay(20); // chờ thêm để chắc không có vòng logout nào phát sinh sau đó

  window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  events.stop();
  assert.equal(events.value, 3);
  assert.equal(logoutCalls, 1);
});
