import test from 'node:test';
import assert from 'node:assert/strict';
import { axiosClient } from '../../src/services/http/axiosClient.js';
globalThis.window = new EventTarget();
const { learningResourceApi } = await import('../../src/services/education-plan/learningResourceService.js');

test('media upload sends multipart fields and same request ID for retry', async () => {
  const previous = axiosClient.defaults.adapter;
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    return { data: { code: 200, desc: 'ok', data: { id: 7 } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const file = new File(['%PDF-1.7'], 'demo.pdf', { type: 'application/pdf' });
    const binding = { activityKey: '9#0', activitySignature: 'a'.repeat(64), activityLabel: 'A' };
    await learningResourceApi.upload(null, 'tp_1_2', file, binding, 'request-demo');
    await learningResourceApi.upload(null, 'tp_1_2', file, binding, 'request-demo');
    assert.equal(calls[0].data.get('activityKey'), '9#0');
    assert.equal(calls[0].data.get('file').name, 'demo.pdf');
    assert.equal(calls[1].headers.get('X-Request-Id'), calls[0].headers.get('X-Request-Id'));
    assert.equal(calls[0].timeout, 120000);
    assert.match(calls[0].url, /theme\/tp_1_2\/learning-resources$/);
  } finally {
    axiosClient.defaults.adapter = previous;
  }
});
test('content stays authenticated binary request and preserves abort signal', async () => {
  const previous = axiosClient.defaults.adapter;
  let call;
  const blob = new Blob(['demo']);
  axiosClient.defaults.adapter = async (config) => {
    call = config;
    return { data: blob, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const controller = new AbortController();
    assert.equal(await learningResourceApi.content(null, 'tp_1_2', 7, controller.signal), blob);
    assert.equal(call.responseType, 'blob');
    assert.equal(call.signal, controller.signal);
    assert.match(call.url, /\/7\/content$/);
  } finally {
    axiosClient.defaults.adapter = previous;
  }
});
