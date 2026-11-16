import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeApiError } from '../../src/services/http/apiError.js';

test('giữ body Blob của lỗi tải tệp mà không giữ headers xác thực', () => {
  const body = new Blob(['{"errorCode":1202}'], { type: 'application/json' });
  const result = normalizeApiError({
    message: 'Request failed',
    response: { status: 404, data: body },
    config: { headers: { Authorization: 'secret' } },
  });
  assert.equal(result.status, 404);
  assert.equal(result.blobErrorBody, body);
  assert.equal(Object.keys(result).includes('blobErrorBody'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});
