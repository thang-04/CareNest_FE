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
localStorage.setItem('carenest.accessToken', 'legacy-local');
sessionStorage.setItem('carenest.accessToken', 'legacy-session');
axios.defaults.headers.common.Authorization = 'Bearer inherited-secret';
let respond;
const requests = [];
axios.defaults.adapter = async (config) => {
  requests.push(config);
  return respond(config);
};
const success = (config, data) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const failure = (config, status, data = {}) => {
  throw new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    config,
    status,
    data,
    statusText: 'Failed',
    headers: {},
  });
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const { tokenStorage, UNAUTHORIZED_EVENT } = await import('../../src/services/http/tokenStorage.js');
const { APP_ONLY_MESSAGE, authPost, authGet, refreshSession, resetAuthTransport } = await import('../../src/services/http/authTransport.js');
const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { normalizeApiError } = await import('../../src/services/http/apiError.js');
delete axios.defaults.headers.common.Authorization;

// Capture initialization before each test clears storage.
const erasedLegacy = localStorage.getItem('carenest.accessToken') === null && sessionStorage.getItem('carenest.accessToken') === null;
beforeEach(() => {
  tokenStorage.clear();
  resetAuthTransport();
  requests.length = 0;
  respond = (config) =>
    success(
      config,
      config.url === '/auth/csrf'
        ? { code: 'OK', data: { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' } }
        : { code: 'OK', data: { accessToken: 'new-token' } }, // carenest:allow-secret
    );
});

test('gateway tokens remain in memory and erase both legacy storage locations', () => {
  assert.equal(erasedLegacy, true);
  tokenStorage.set('secret-token', true);
  assert.equal(tokenStorage.get(), 'secret-token');
  for (const storage of [localStorage, sessionStorage]) {
    assert.equal(storage.getItem('carenest.accessToken'), null);
    assert.equal(storage.getItem('carenest.mock.accessToken'), null);
  }
  const generation = tokenStorage.getGeneration();
  tokenStorage.clear();
  assert.equal(tokenStorage.get(), null);
  assert.equal(tokenStorage.getGeneration(), generation + 1);
});

test('gateway requests send cookies and CSRF without leaking a default Bearer', async () => {
  axios.defaults.headers.common.Authorization = 'Bearer inherited-secret';
  tokenStorage.set('resource-secret');
  try {
    await authPost('/auth/login', { username: 'test' });
    await authGet('/auth/status');
    const post = requests.find((request) => request.url === '/auth/login');
    assert.equal(post.headers.get('X-XSRF-TOKEN'), 'csrf-test');
    for (const request of requests) {
      assert.equal(request.withCredentials, true);
      assert.equal(request.headers.get('Authorization'), undefined);
    }
  } finally {
    delete axios.defaults.headers.common.Authorization;
  }
});

test('concurrent gateway writes share one CSRF request', async () => {
  await Promise.all([authPost('/auth/login', {}), authPost('/auth/logout', {})]);
  assert.equal(requests.filter((request) => request.url === '/auth/csrf').length, 1);
  assert.equal(requests.filter((request) => request.method === 'post').length, 2);
});

test('concurrent refreshes share one refresh and save the returned access token', async () => {
  const sessions = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
  assert.equal(requests.filter((request) => request.url === '/auth/refresh').length, 1);
  assert.equal(tokenStorage.get(), 'new-token');
  assert.deepEqual(sessions[0], sessions[1]);
});

test('resource requests unwrap envelopes and use Bearer without cookies', async () => {
  tokenStorage.set('resource-token');
  respond = (config) => success(config, { code: 'OK', desc: 'ok', data: { id: 12 } });
  assert.deepEqual(await axiosClient.get('/accounts/me'), { id: 12 });
  assert.equal(requests[0].headers.get('Authorization'), 'Bearer resource-token');
  assert.equal(requests[0].withCredentials, false);
});

test('validation field details and password-change 428 remain available to forms', async () => {
  respond = (config) =>
    failure(config, 428, {
      code: 'AUTH_PASSWORD_CHANGE_REQUIRED',
      desc: 'Change password',
      data: { challengeId: 'challenge-test' },
    });
  await assert.rejects(authPost('/auth/login', {}), (error) => {
    assert.equal(error.status, 428);
    assert.equal(error.desc, 'Change password');
    assert.deepEqual(error.details, { challengeId: 'challenge-test' });
    return true;
  });
  const error = normalizeApiError({
    response: {
      status: 400,
      data: {
        desc: 'Invalid input',
        data: [{ field: 'password', message: 'Too short' }],
      },
    },
  });
  assert.deepEqual(error.details, { password: 'Too short' });
});

test('a resource 401 refreshes once and retries using the fresh Bearer', async () => {
  tokenStorage.set('old-token');
  let resourceCalls = 0;
  respond = (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/refresh') return success(config, { accessToken: 'fresh-token' }); // carenest:allow-secret
    resourceCalls += 1;
    if (resourceCalls === 1) return failure(config, 401);
    assert.equal(config.headers.get('Authorization'), 'Bearer fresh-token');
    return success(config, { code: 'OK', data: 'loaded' });
  };
  assert.equal(await axiosClient.get('/protected'), 'loaded');
  assert.equal(resourceCalls, 2);
  assert.equal(requests.filter((request) => request.url === '/auth/refresh').length, 1);
});

test('a second resource 401 notifies logout without a second refresh', async () => {
  let unauthorized = 0;
  const listener = () => {
    unauthorized += 1;
  };
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  respond = (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/refresh') return success(config, { accessToken: 'fresh-token' }); // carenest:allow-secret
    return failure(config, 401);
  };
  try {
    await assert.rejects(axiosClient.get('/protected'), { status: 401 });
    assert.equal(unauthorized, 1);
    assert.equal(requests.filter((request) => request.url === '/auth/refresh').length, 1);
  } finally {
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  }
});

test('403 and 503 errors preserve session and never trigger refresh or logout', async () => {
  tokenStorage.set('existing-token');
  let unauthorized = 0;
  const listener = () => {
    unauthorized += 1;
  };
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  try {
    for (const status of [403, 503]) {
      respond = (config) => failure(config, status);
      await assert.rejects(axiosClient.get('/protected'), { status });
    }
    assert.equal(unauthorized, 0);
    assert.equal(tokenStorage.get(), 'existing-token');
    assert.equal(requests.length, 2);
  } finally {
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  }
});

test('old-password 401 skips refresh and does not notify logout', async () => {
  let unauthorized = 0;
  const listener = () => {
    unauthorized += 1;
  };
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  respond = (config) => failure(config, 401);
  try {
    await assert.rejects(axiosClient.post('/accounts/me/password', {}, { skipAuthRefresh: true }), { status: 401 });
    assert.equal(requests.length, 1);
    assert.equal(unauthorized, 0);
  } finally {
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  }
});

test('logout generation fences a late refresh response from restoring the session', async () => {
  const started = deferred();
  const result = deferred();
  respond = async (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    started.resolve();
    await result.promise;
    return success(config, { accessToken: 'late-token' }); // carenest:allow-secret
  };
  const pending = refreshSession();
  await started.promise;
  tokenStorage.clear();
  resetAuthTransport();
  result.resolve();
  await assert.rejects(pending, { code: 'ERR_CANCELED' });
  assert.equal(tokenStorage.get(), null);
});
test('simultaneous resource 401 responses share one refresh flight', async () => {
  tokenStorage.set('old-token');
  const refreshStarted = deferred();
  const releaseRefresh = deferred();
  const attempts = new Map();
  respond = async (config) => {
    if (config.url === '/auth/csrf') return success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' });
    if (config.url === '/auth/refresh') {
      refreshStarted.resolve();
      await releaseRefresh.promise;
      return success(config, { accessToken: 'fresh-token' }); // carenest:allow-secret
    }
    const count = (attempts.get(config.url) ?? 0) + 1;
    attempts.set(config.url, count);
    if (count === 1) return failure(config, 401);
    return success(config, config.url);
  };
  const pending = Promise.all([axiosClient.get('/first'), axiosClient.get('/second')]);
  await refreshStarted.promise;
  releaseRefresh.resolve();
  assert.deepEqual(await pending, ['/first', '/second']);
  assert.equal(requests.filter((request) => request.url === '/auth/refresh').length, 1);
});

test('refresh 503 preserves the current session and does not notify logout', async () => {
  tokenStorage.set('existing-token');
  let unauthorized = 0;
  const listener = () => {
    unauthorized += 1;
  };
  window.addEventListener(UNAUTHORIZED_EVENT, listener);
  respond = (config) =>
    config.url === '/auth/csrf'
      ? success(config, { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' })
      : failure(config, config.url === '/auth/refresh' ? 503 : 401);
  try {
    await assert.rejects(axiosClient.get('/protected'), { status: 503 });
    assert.equal(unauthorized, 0);
    assert.equal(tokenStorage.get(), 'existing-token');
  } finally {
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  }
});

test('a stale CSRF token is refetched once and the gateway write is retried', async () => {
  let csrfCalls = 0;
  respond = (config) => {
    if (config.url === '/auth/csrf') {
      csrfCalls += 1;
      return success(config, { code: 'OK', data: { token: `csrf-${csrfCalls}`, headerName: 'X-XSRF-TOKEN' } });
    }
    if (config.headers['X-XSRF-TOKEN'] === 'csrf-1') return failure(config, 403, { code: 403, errorCode: 1101, desc: 'Không có quyền', data: null });
    return success(config, { code: 'OK', data: { ok: true } });
  };
  assert.deepEqual(await authPost('/auth/logout', {}), { ok: true });
  assert.equal(csrfCalls, 2);
  assert.deepEqual(
    requests.filter((config) => config.url === '/auth/logout').map((config) => config.headers['X-XSRF-TOKEN']),
    ['csrf-1', 'csrf-2'],
  );
});

test('business 403 on a gateway write is not retried', async () => {
  respond = (config) =>
    config.url === '/auth/csrf'
      ? success(config, { code: 'OK', data: { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' } })
      : failure(config, 403, { code: 403, errorCode: 1015, desc: 'Account is inactive', data: null });
  await assert.rejects(authPost('/auth/login', { identifier: 'a', password: 'b' }), {
    status: 403,
    errorCode: 1015,
    desc: 'Account is inactive',
  });
  assert.equal(requests.filter((config) => config.url === '/auth/login').length, 1);
});

test('CSRF rejection after one refetch surfaces the 403 without looping', async () => {
  respond = (config) =>
    config.url === '/auth/csrf'
      ? success(config, { code: 'OK', data: { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' } })
      : failure(config, 403, { code: 403, errorCode: 1101, desc: 'Không có quyền', data: null });
  await assert.rejects(authPost('/auth/logout', {}), (error) => error.status === 403 && error.errorCode === 1101 && !error.appOnly);
  assert.equal(requests.filter((config) => config.url === '/auth/logout').length, 2);
  assert.equal(requests.filter((config) => config.url === '/auth/csrf').length, 2);
});

test('403 1101 sent again with a fresh CSRF at login means an app-only account', async () => {
  respond = (config) =>
    config.url === '/auth/csrf'
      ? success(config, { code: 'OK', data: { token: 'csrf-test', headerName: 'X-XSRF-TOKEN' } })
      : failure(config, 403, { code: 403, errorCode: 1101, desc: 'Không có quyền', data: null });
  await assert.rejects(authPost('/auth/login', { identifier: 'a', password: 'b' }), {
    status: 403,
    errorCode: 1101,
    appOnly: true,
    message: APP_ONLY_MESSAGE,
  });
  assert.equal(requests.filter((config) => config.url === '/auth/login').length, 2);
});
