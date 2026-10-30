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
let usedRefresh;
let sessionDead;
let validToken;
let events;
const onEvent = () => events++;
window.addEventListener(UNAUTHORIZED_EVENT, onEvent);

// Keycloak giả: mỗi lần refresh cấp token mới (xoay vòng refresh token). Như realm thật (revokeRefreshToken): dùng lại
// refresh token đã dùng ⇒ invalid_grant và hủy cả phiên (mọi refresh token sau đó đều hỏng)
axios.defaults.adapter = async (config) => {
  refreshCalls++;
  await new Promise((r) => setTimeout(r, 5));
  const used = new URLSearchParams(String(config.data)).get('refresh_token');
  if (used && usedRefresh.has(used)) sessionDead = true;
  if (used) usedRefresh.add(used);
  if (refreshFails || sessionDead) throw unauthorized(config);
  validToken = `access-${refreshCalls}`;
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    // carenest:allow-secret — token giả của Keycloak mô phỏng
    data: { access_token: validToken, refresh_token: `refresh-${refreshCalls}`, expires_in: 300 }, // carenest:allow-secret
  };
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
  usedRefresh = new Set();
  sessionDead = false;
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

// Tab mở bằng link target=_blank / nhân bản tab: trình duyệt chép sessionStorage ⇒ hai tab giữ cùng refresh token
const copyOfTab = () => {
  const snapshot = new Map();
  ['carenest.accessToken', 'carenest.kcRefreshToken', 'carenest.kcAccessExp'].forEach((k) => snapshot.set(k, sessionStorage.getItem(k)));
  return () => snapshot.forEach((v, k) => (v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v)));
};
const signInSession = () => {
  sessionStorage.setItem('carenest.accessToken', 'access-0');
  sessionStorage.setItem('carenest.kcRefreshToken', 'refresh-0');
  sessionStorage.setItem('carenest.kcAccessExp', String(Date.now() - 1000));
  validToken = 'not-issued-yet';
};

test('hai tab chung bản sao phiên (không ghi nhớ): tab sau nhận token mới, không dùng lại refresh token, không hủy phiên', async () => {
  signInSession();
  const switchToTabB = copyOfTab();
  await axiosClient.get('/tab-a');
  assert.equal(refreshCalls, 1);
  switchToTabB();
  assert.equal(sessionStorage.getItem('carenest.kcRefreshToken'), 'refresh-0');
  assert.deepEqual(await axiosClient.get('/tab-b'), { url: '/tab-b' });
  assert.equal(refreshCalls, 1);
  assert.equal(sessionDead, false);
  assert.equal(sessionStorage.getItem('carenest.kcRefreshToken'), 'refresh-1');
  assert.equal(events, 0);
});

test('tab cầm token cũ sau nhiều lần đổi vẫn nhận bộ token mới nhất', async () => {
  signInSession();
  const switchToTabB = copyOfTab();
  await axiosClient.get('/a1');
  sessionStorage.setItem('carenest.kcAccessExp', String(Date.now() - 1000));
  await axiosClient.get('/a2');
  assert.equal(refreshCalls, 2);
  switchToTabB();
  await axiosClient.get('/b');
  assert.equal(refreshCalls, 2);
  assert.equal(sessionStorage.getItem('carenest.kcRefreshToken'), 'refresh-2');
  assert.equal(sessionDead, false);
});

test('đăng xuất xóa cả bản ghi đổi token', async () => {
  signInSession();
  await axiosClient.get('/a');
  assert.ok(localStorage.getItem('carenest.kcRotation'));
  const { devKeycloakLogout } = await import('../../src/services/http/devKeycloakAuth.js');
  await devKeycloakLogout();
  assert.equal(localStorage.getItem('carenest.kcRotation'), null);
});
