import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import axios, { AxiosError } from 'axios';

// Phiên Keycloak dev (VITE_SCHOOL_CONFIG_API): access token 5 phút. Mọi request qua axiosClient phải tự làm mới,
// gặp 401 thì làm mới một lần rồi gửi lại; chỉ hết phiên khi làm mới thất bại (lỗi cũ: tự đăng xuất sau ~5 phút).
globalThis.window = new EventTarget();
const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
  };
};
globalThis.localStorage = memoryStorage();
globalThis.sessionStorage = memoryStorage();

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { UNAUTHORIZED_EVENT } = await import('../../src/services/http/tokenStorage.js');

const ok = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });
const unauthorized = (config) => {
  const response = { status: 401, statusText: 'Unauthorized', headers: {}, config, data: { code: 401, desc: 'Hết phiên' } };
  return new AxiosError('Unauthorized', AxiosError.ERR_BAD_REQUEST, config, null, response);
};

let refreshCalls;
let refreshFails;
let validToken;
let events;
const onEvent = () => events++;
window.addEventListener(UNAUTHORIZED_EVENT, onEvent);

// Keycloak giả: mỗi lần refresh cấp token mới (xoay vòng refresh token)
axios.defaults.adapter = async (config) => {
  refreshCalls++;
  await new Promise((r) => setTimeout(r, 5));
  if (refreshFails) throw unauthorized(config);
  validToken = `access-${refreshCalls}`;
  return { status: 200, statusText: 'OK', headers: {}, config, data: { access_token: validToken, refresh_token: `refresh-${refreshCalls}`, expires_in: 300 } }; // carenest:allow-secret — token giả của Keycloak mô phỏng
};
// BE giả: chỉ nhận token hiện hành
axiosClient.defaults.adapter = async (config) => {
  if (config.headers.Authorization !== `Bearer ${validToken}`) throw unauthorized(config);
  return ok(config, { url: config.url });
};

const signIn = ({ expired }) => {
  localStorage.setItem('carenest.accessToken', 'access-0');
  localStorage.setItem('carenest.kcRefreshToken', 'refresh-0');
  localStorage.setItem('carenest.kcAccessExp', String(Date.now() + (expired ? -1000 : 300_000)));
  // Token đã quá hạn thì BE từ chối
  if (expired) validToken = 'not-issued-yet';
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  refreshCalls = 0;
  refreshFails = false;
  validToken = 'access-0';
  events = 0;
});

test('token sắp hết hạn: làm mới trước khi gửi, không đăng xuất', async () => {
  signIn({ expired: true });
  assert.deepEqual(await axiosClient.get('/education-plans/goals'), { url: '/education-plans/goals' });
  assert.equal(refreshCalls, 1);
  assert.equal(events, 0);
});

test('nhiều request song song khi token hết hạn chỉ làm mới một lần (refresh token dùng một lần)', async () => {
  signIn({ expired: true });
  await Promise.all([axiosClient.get('/a'), axiosClient.get('/b'), axiosClient.post('/c/editing-heartbeat')]);
  assert.equal(refreshCalls, 1);
  assert.equal(events, 0);
});

test('BE trả 401 dù token chưa tới hạn: làm mới một lần rồi gửi lại thành công', async () => {
  signIn({ expired: false });
  validToken = 'revoked-elsewhere';
  assert.deepEqual(await axiosClient.get('/education-plans/config'), { url: '/education-plans/config' });
  assert.equal(refreshCalls, 1);
  assert.equal(events, 0);
});

test('làm mới thất bại (phiên Keycloak đã hết): báo hết phiên đúng một lần, không gửi lại vòng lặp', async () => {
  signIn({ expired: false });
  validToken = 'revoked-elsewhere';
  refreshFails = true;
  await assert.rejects(axiosClient.get('/education-plans/config'), { status: 401 });
  assert.equal(refreshCalls, 1);
  assert.ok(events >= 1);
  assert.equal(localStorage.getItem('carenest.kcRefreshToken'), null);
});

test('không có phiên Keycloak dev: 401 vẫn báo hết phiên ngay, không gọi Keycloak', async () => {
  localStorage.setItem('carenest.accessToken', 'gateway-token');
  await assert.rejects(axiosClient.get('/children'), { status: 401 });
  assert.equal(refreshCalls, 0);
  assert.equal(events, 1);
});
