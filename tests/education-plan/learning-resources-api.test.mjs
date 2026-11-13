import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { axiosClient } from '../../src/services/http/axiosClient.js';
globalThis.window = new EventTarget();
const { learningResourceApi } = await import('../../src/services/education-plan/learningResourceService.js');

const ok = (config, data) => ({ data: { code: 200, desc: 'ok', data }, status: 200, statusText: 'OK', headers: {}, config });

test('upload goes upload-url → PUT to storage without BE token → confirm with the same request ID', async () => {
  const previous = [axiosClient.defaults.adapter, axios.defaults.adapter];
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(['be', config]);
    return config.url.endsWith('/upload-url')
      ? ok(config, {
          uploadId: 'hoclieu_8_20260907-080000_ab12.pdf',
          url: 'https://bucket.s3/tmp/x?sig',
          headers: { 'Content-Type': 'application/pdf' },
        })
      : ok(config, { id: 7 });
  };
  axios.defaults.adapter = async (config) => {
    calls.push(['s3', config]);
    return { data: '', status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const file = new File(['%PDF-1.7'], 'demo.pdf', { type: 'application/pdf' });
    const binding = { activityKey: '2026-09-07#hoc', activityLabel: 'Hoạt động học' };
    await learningResourceApi.upload(null, 'dd_1_2_2026-09-07', file, binding, 'request-demo');
    const [ask, put, confirm] = calls;
    assert.match(ask[1].url, /day\/dd_1_2_2026-09-07\/learning-resources\/upload-url$/);
    assert.deepEqual(JSON.parse(ask[1].data), { fileName: 'demo.pdf', contentType: 'application/pdf', size: 8 });
    assert.equal(put[0], 's3');
    assert.equal(put[1].url, 'https://bucket.s3/tmp/x?sig');
    assert.equal(put[1].headers.get('Authorization'), undefined);
    assert.equal(put[1].headers.get('Content-Type'), 'application/pdf');
    assert.match(confirm[1].url, /\/confirm$/);
    assert.deepEqual(JSON.parse(confirm[1].data), {
      uploadId: 'hoclieu_8_20260907-080000_ab12.pdf',
      fileName: 'demo.pdf',
      activityKey: '2026-09-07#hoc',
      activityLabel: 'Hoạt động học',
    });
    assert.equal(confirm[1].headers.get('Idempotency-Key'), 'request-demo');
  } finally {
    [axiosClient.defaults.adapter, axios.defaults.adapter] = previous;
  }
});

test('content uses the time-limited link from BE', async () => {
  const previous = axiosClient.defaults.adapter;
  let call;
  axiosClient.defaults.adapter = async (config) => {
    call = config;
    return ok(config, { url: 'https://bucket.s3/hoclieu/x?sig', expiresAt: '2026-09-07T08:15:00Z' });
  };
  try {
    assert.equal(await learningResourceApi.contentUrl(null, 'dd_1_2_2026-09-07', 7), 'https://bucket.s3/hoclieu/x?sig');
    assert.match(call.url, /\/7\/url$/);
  } finally {
    axiosClient.defaults.adapter = previous;
  }
});

test('901: kho chỉ còn list/update/remove/usages/contentUrl; usages đọc dạng { rows, locked, deletableFrom }', async () => {
  const { resourceLibraryApi } = await import('../../src/services/education-plan/resourceLibraryService.js');
  assert.deepEqual(Object.keys(resourceLibraryApi).sort(), ['contentUrl', 'list', 'remove', 'update', 'usages']);
  const previous = axiosClient.defaults.adapter;
  let call;
  axiosClient.defaults.adapter = async (config) => {
    call = config;
    return ok(config, {
      rows: [{ attachmentId: 1, classroomId: 5, date: '2026-11-20', status: 'APPROVED', locked: true }],
      locked: true,
      deletableFrom: '2026-11-21',
    });
  };
  try {
    const res = await resourceLibraryApi.usages(null, 9);
    assert.match(call.url, /\/education-plans\/resources\/9\/usages$/);
    assert.equal(res.rows[0].classroomId, '5');
    assert.equal(res.locked, true);
    assert.equal(res.deletableFrom, '2026-11-21');
  } finally {
    axiosClient.defaults.adapter = previous;
  }
});
