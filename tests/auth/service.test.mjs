import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import axios from 'axios';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
};
globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();
globalThis.window = new EventTarget();
globalThis.CustomEvent ??= class extends Event {
  constructor(type, options = {}) {
    super(type);
    this.detail = options.detail;
  }
};
const channels = [];
class TestBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.closed = false;
    channels.push(this);
  }
  postMessage(message) {
    this.messages.push(structuredClone(message));
  }
  close() {
    this.closed = true;
  }
}
globalThis.BroadcastChannel = TestBroadcastChannel;
const lockCalls = [];
let lockQueues = new Map();
let secondLockRequested;
const webLocks = {
  request(name, callback) {
    lockCalls.push(name);
    if (lockCalls.length >= 2) secondLockRequested?.();
    const previous = lockQueues.get(name) || Promise.resolve();
    const pending = previous.catch(() => {}).then(() => callback({ name }));
    lockQueues.set(
      name,
      pending.catch(() => {}),
    );
    return pending;
  },
};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: webLocks } });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const requests = [];
let respond;
axios.defaults.adapter = async (config) => {
  requests.push(config);
  return respond(config);
};
const success = (config, data) => ({ config, data: { code: 'OK', data }, status: 200, statusText: 'OK', headers: {} });
const failure = (config, status, data = {}) => {
  throw new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    config,
    status,
    data,
    statusText: 'Failed',
    headers: {},
  });
};
const auth = await import('../../src/services/authService.js');
const { tokenStorage, UNAUTHORIZED_EVENT } = await import('../../src/services/http/tokenStorage.js');
const { accountApi } = await import('../../src/services/account/api/accountApi.js');
const challenge = await import('../../src/services/authChallengeStore.js');
const account = () => ({
  userId: 44,
  username: 'staff-test',
  roles: ['TEACHER'],
  assignments: [{ staffRole: 'TEACHER', campusId: 2, classroomId: 9 }],
});
beforeEach(() => {
  navigator.locks = webLocks;
  lockQueues = new Map();
  lockCalls.length = 0;
  secondLockRequested = null;
  auth.endLocalSession({ broadcast: false });
  localStorage.clear();
  sessionStorage.clear();
  requests.length = 0;
  channels.length = 0;
  respond = (config) =>
    success(
      config,
      config.url === '/auth/csrf'
        ? { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' }
        : { accessToken: 'session-test', account: account() }, // carenest:allow-secret
    );
});

test('login maps email and identifier inputs to the gateway request contract', async () => {
  for (const input of [
    { email: ' staff@example.test ', password: 'test-password', remember: true },
    { identifier: ' staff-test ', email: 'ignored@example.test', password: 'test-password', remember: false },
  ]) {
    requests.length = 0;
    const user = await auth.login(input);
    const request = requests.find((entry) => entry.url === '/auth/login');
    assert.deepEqual(JSON.parse(request.data), {
      identifier: (input.identifier || input.email).trim(),
      password: input.password, // carenest:allow-secret
      remember: input.remember,
    });
    assert.equal(user.id, '44');
    assert.equal(user.role, 'TEACHER');
    assert.equal(user.campusId, '2');
    assert.equal(user.classId, '9');
    assert.equal(tokenStorage.get(), 'session-test');
    assert.equal(localStorage.getItem('carenest.accessToken'), null);
    assert.equal(sessionStorage.getItem('carenest.accessToken'), null);
  }
});

test('login rejects a malformed account instead of inventing user identity or access', async () => {
  respond = (config) =>
    success(
      config,
      config.url === '/auth/csrf'
        ? { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' }
        : { accessToken: 'session-test', account: { roles: ['TEACHER'] } }, // carenest:allow-secret
    );
  await assert.rejects(auth.login({ identifier: 'test', password: 'test-password' }), { status: 503 }); // carenest:allow-secret
  assert.equal(tokenStorage.get(), null);
  assert.equal(channels.length, 0);
});

test('login rejects a missing access token even when the account is valid', async () => {
  respond = (config) =>
    success(config, config.url === '/auth/csrf' ? { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' } : { account: account() });
  await assert.rejects(auth.login({ identifier: 'test', password: 'test-password' }), { status: 503 }); // carenest:allow-secret
  assert.equal(tokenStorage.get(), null);
});

test('login 428 clears the prior session and preserves the challenge details without a token', async () => {
  tokenStorage.set('prior-token');
  respond = (config) =>
    config.url === '/auth/csrf'
      ? success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' })
      : failure(config, 428, { desc: 'Password change required', data: { challengeId: 'challenge-test' } });
  await assert.rejects(auth.login({ identifier: 'test', password: 'test-password' }), (error) => { // carenest:allow-secret
    assert.equal(error.status, 428);
    assert.deepEqual(error.details, { challengeId: 'challenge-test' });
    return true;
  });
  assert.equal(tokenStorage.get(), null);
  assert.equal(channels.length, 0);
});

test('getCurrentUser bootstraps a cookie session before loading the server account', async () => {
  respond = (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/refresh') return success(config, { accessToken: 'restored-token' }); // carenest:allow-secret
    assert.equal(config.url, '/accounts/me');
    assert.equal(config.headers.get('Authorization'), 'Bearer restored-token');
    return success(config, account());
  };
  const user = await auth.getCurrentUser();
  assert.deepEqual(
    requests.map((request) => request.url),
    ['/auth/csrf', '/auth/refresh', '/accounts/me'],
  );
  assert.equal(requests[1].withCredentials, true);
  assert.equal(requests[2].withCredentials, false);
  assert.equal(user.id, '44');
  assert.equal(user.role, 'TEACHER');
});

test('getCurrentUser with an access token loads the server account without bootstrapping', async () => {
  tokenStorage.set('existing-token');
  respond = (config) => success(config, { userId: 55, roles: ['PARENT'], assignments: [] });
  const user = await auth.getCurrentUser();
  assert.deepEqual(
    requests.map((request) => request.url),
    ['/accounts/me'],
  );
  assert.equal(user.id, '55');
  assert.equal(user.role, null);
  assert.equal(user.campusId, null);
  assert.equal(user.classId, null);
});

test('logout clears local token and proof immediately and returns provider failure', async () => {
  tokenStorage.set('existing-token');
  challenge.setPasswordChallenge({ challengeId: 'challenge-test' });
  challenge.setOtpRequest({ requestId: 'otp-test', resetToken: 'proof-test' });
  respond = (config) => {
    assert.equal(tokenStorage.get(), null);
    assert.equal(challenge.getPasswordChallenge(), null);
    assert.equal(challenge.getOtpRequest(), null);
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    return failure(config, 503);
  };
  const error = await auth.logout();
  assert.equal(error.status, 503);
  assert.equal(tokenStorage.get(), null);
  assert.equal(channels[0].messages[0].type, 'logout');
});

test('session broadcasts send only event metadata and close the sending channel', () => {
  tokenStorage.set('never-broadcast-token');
  challenge.setOtpRequest({ resetToken: 'never-broadcast-proof' });
  auth.broadcastSessionEvent('login');
  const channel = channels[0];
  assert.equal(channel.name, 'carenest.auth.session');
  assert.equal(channel.closed, true);
  const [message] = channel.messages;
  assert.deepEqual(Object.keys(message).sort(), ['nonce', 'source', 'type', 'version']);
  assert.equal(message.type, 'login');
  assert.equal(typeof message.source, 'string');
  assert.equal(typeof message.nonce, 'number');
  assert.equal(typeof message.version, 'number');
});

test('session subscribers accept peer login/logout, ignore self and unknown events, and close', () => {
  auth.broadcastSessionEvent('login');
  const ownSource = channels[0].messages[0].source;
  const seen = [];
  const unsubscribe = auth.subscribeSessionEvents((type) => seen.push(type));
  const channel = channels[1];
  for (const data of [
    { source: ownSource, type: 'logout', version: 0 },
    { source: 'peer', type: 'unknown', version: 0 },
    { source: 'peer', type: 'login', version: 0 },
    { source: 'peer', type: 'logout', version: 0 },
  ])
    channel.onmessage({ data });
  assert.deepEqual(seen, ['login', 'logout']);
  unsubscribe();
  assert.equal(channel.closed, true);
});

test('storage broadcast fallback contains metadata only, never tokens or account data', () => {
  globalThis.BroadcastChannel = undefined;
  try {
    tokenStorage.set('never-store-token');
    auth.broadcastSessionEvent('logout');
    const message = JSON.parse(localStorage.getItem('carenest.auth.signal'));
    assert.deepEqual(Object.keys(message).sort(), ['nonce', 'source', 'type', 'version']);
    assert.equal(message.type, 'logout');
    assert.equal(typeof message.version, 'number');
    assert.equal(localStorage.getItem('carenest.accessToken'), null);
  } finally {
    globalThis.BroadcastChannel = TestBroadcastChannel;
  }
});
test('logout follows a delayed login cookie response under the same browser lock', async () => {
  let browserCookie = '';
  const loginStarted = deferred();
  const releaseLogin = deferred();
  const queuedLogout = deferred();
  secondLockRequested = queuedLogout.resolve;
  respond = async (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/login') {
      loginStarted.resolve();
      await releaseLogin.promise;
      browserCookie = 'new-cookie';
      return success(config, { accessToken: 'login-token', account: account() }); // carenest:allow-secret
    }
    if (config.url === '/auth/logout') {
      browserCookie = '';
      return success(config, null);
    }
    if (config.url === '/auth/refresh') {
      if (!browserCookie) return failure(config, 401);
      return success(config, { accessToken: 'resurrected-token' }); // carenest:allow-secret
    }
    return success(config, account());
  };
  const loginOutcome = auth.login({ identifier: 'test', password: 'test-password' }).then( // carenest:allow-secret
    (value) => ({ value }),
    (error) => ({ error }),
  );
  await loginStarted.promise;
  const loggingOut = auth.logout();
  // Old code finishes logout; fixed code queues its lock before login settles.
  await Promise.race([loggingOut, queuedLogout.promise]);
  releaseLogin.resolve();
  await Promise.all([loginOutcome, loggingOut]);
  assert.equal(browserCookie, '');
  assert.ok(lockCalls.length >= 2);
  assert.equal(new Set(lockCalls).size, 1);
  auth.endLocalSession({ broadcast: false });
  await assert.rejects(auth.getCurrentUser(), { status: 401 });
  assert.equal(tokenStorage.get(), null);
});

test('gateway login fails closed without browser Web Locks and sends no HTTP', async () => {
  navigator.locks = undefined;
  await assert.rejects(auth.login({ identifier: 'test', password: 'test-password' }), { status: 503 }); // carenest:allow-secret
  assert.equal(requests.length, 0);
  assert.equal(tokenStorage.get(), null);
});

test('password-change pre-refresh 401 marks an expired session and notifies before PUT', async () => {
  tokenStorage.set('expired-token');
  let unauthorized = 0;
  const listener = () => {
    unauthorized += 1;
  };
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  respond = (config) =>
    config.url === '/auth/csrf' ? success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' }) : failure(config, 401);
  try {
    await assert.rejects(accountApi.changePassword({ currentPassword: 'old-test', newPassword: 'new-test' }), (error) => { // carenest:allow-secret
      assert.equal(error.status, 401);
      assert.equal(error.sessionExpired, true);
      return true;
    });
    assert.equal(unauthorized, 1);
    assert.equal(
      requests.some((request) => request.method === 'put'),
      false,
    );
  } finally {
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  }
});

test('wrong-current-password PUT 401 remains a form error without session expiration', async () => {
  tokenStorage.set('current-token');
  let unauthorized = 0;
  const listener = () => {
    unauthorized += 1;
  };
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  respond = (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/refresh') return success(config, { accessToken: 'fresh-token' }); // carenest:allow-secret
    assert.equal(config.url, '/me/password');
    assert.equal(config.skipAuthRefresh, true);
    return failure(config, 401, { desc: 'Wrong current password' });
  };
  try {
    await assert.rejects(accountApi.changePassword({ currentPassword: 'wrong-test', newPassword: 'new-test' }), (error) => { // carenest:allow-secret
      assert.equal(error.status, 401);
      assert.equal(error.sessionExpired, undefined);
      return true;
    });
    assert.equal(unauthorized, 0);
    assert.equal(requests.filter((request) => request.url === '/auth/refresh').length, 1);
    assert.equal(tokenStorage.get(), 'fresh-token');
  } finally {
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  }
});
test('a stale peer logout cannot terminate a newer shared login operation', async () => {
  await auth.login({ identifier: 'test', password: 'test-password' }); // carenest:allow-secret
  const operation = JSON.parse(localStorage.getItem('carenest.auth.operation'));
  assert.equal(operation.version, 1);
  assert.equal(operation.type, 'login');
  assert.deepEqual(Object.keys(operation).sort(), ['restoreBlocked', 'source', 'type', 'version']);
  assert.equal(typeof operation.restoreBlocked, 'boolean');
  assert.equal(operation.restoreBlocked, false);
  const seen = [];
  const unsubscribe = auth.subscribeSessionEvents((type) => seen.push(type));
  const channel = channels.at(-1);
  try {
    channel.onmessage({ data: { source: 'peer', type: 'logout', version: 0 } });
    assert.deepEqual(seen, []);
    assert.equal(tokenStorage.get(), 'session-test');
    channel.onmessage({ data: { source: 'peer', type: 'logout', version: 1 } });
    assert.deepEqual(seen, ['logout']);
  } finally {
    unsubscribe();
  }
});

test('a queued login whose intent predates a shared logout is rejected before HTTP', async () => {
  const holding = deferred();
  const release = deferred();
  const blocker = navigator.locks.request('carenest.auth.cookie-boundary', async () => {
    holding.resolve();
    await release.promise;
  });
  await holding.promise;
  const pending = auth.login({ identifier: 'test', password: 'test-password' }); // carenest:allow-secret
  const rejection = assert.rejects(pending, { status: 409 });
  localStorage.setItem('carenest.auth.operation', JSON.stringify({ version: 1, type: 'logout', source: 'peer' }));
  release.resolve();
  await Promise.all([blocker, rejection]);
  assert.equal(requests.length, 0);
  assert.equal(tokenStorage.get(), null);
});

test('a failed remote logout leaves a durable local marker that prevents reload bootstrap', async () => {
  tokenStorage.set('existing-token');
  respond = (config) => failure(config, 503);
  const error = await auth.logout();
  assert.equal(error.status, 503);
  const operation = JSON.parse(localStorage.getItem('carenest.auth.operation'));
  assert.equal(operation.type, 'logout');
  assert.equal(operation.version, 1);
  auth.endLocalSession({ broadcast: false });
  const httpBeforeReload = requests.length;
  await assert.rejects(auth.getCurrentUser(), { status: 401 });
  assert.equal(requests.length, httpBeforeReload);
  assert.equal(tokenStorage.get(), null);
});
test('a failed login after offline logout cannot reopen bootstrap of an old browser cookie', async () => {
  respond = (config) => failure(config, 503);
  assert.equal((await auth.logout()).status, 503);
  respond = (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/login') return failure(config, 401);
    if (config.url === '/auth/refresh') return success(config, { accessToken: 'old-cookie-token' }); // carenest:allow-secret
    return success(config, account());
  };
  await assert.rejects(auth.login({ identifier: 'test', password: 'wrong-test' }), { status: 401 }); // carenest:allow-secret
  auth.endLocalSession({ broadcast: false });
  const httpBeforeReload = requests.length;
  await assert.rejects(auth.getCurrentUser(), { status: 401 });
  assert.equal(requests.length, httpBeforeReload);
  assert.equal(tokenStorage.get(), null);
});

test('a failed password reset after offline logout cannot reopen bootstrap of an old cookie', async () => {
  respond = (config) => failure(config, 503);
  assert.equal((await auth.logout()).status, 503);
  respond = (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/password/reset') return failure(config, 400, { desc: 'Password policy rejected' });
    if (config.url === '/auth/refresh') return success(config, { accessToken: 'old-cookie-token' }); // carenest:allow-secret
    return success(config, account());
  };
  await assert.rejects(accountApi.setPasswordWithToken({ resetToken: 'proof-test', newPassword: 'weak-test' }), { status: 400 }); // carenest:allow-secret
  auth.endLocalSession({ broadcast: false });
  const httpBeforeReload = requests.length;
  await assert.rejects(auth.getCurrentUser(), { status: 401 });
  assert.equal(requests.length, httpBeforeReload);
  assert.equal(tokenStorage.get(), null);
});
