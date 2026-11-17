import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withLocalOtpDeadlines } from '../../src/utils/account/otpDeadlines.js';

test('OTP deadlines follow the local clock even when the server clock is far off', () => {
  const receivedAt = Date.parse('2026-11-16T10:00:00Z');
  const request = withLocalOtpDeadlines(
    {
      requestId: 'r1',
      // Máy chủ chạy chậm 10 phút so với máy người dùng
      expiresAt: '2026-11-16T09:55:00Z',
      resendAvailableAt: '2026-11-16T09:51:00Z',
      expiresInSeconds: 300,
      resendInSeconds: 60,
    },
    receivedAt,
  );
  assert.equal(request.expiresAt, '2026-11-16T10:05:00.000Z');
  assert.equal(request.resendAvailableAt, '2026-11-16T10:01:00.000Z');
  assert.equal(request.requestId, 'r1');
});

test('older responses without relative seconds keep absolute deadlines', () => {
  const request = withLocalOtpDeadlines({ requestId: 'r2', expiresAt: 'A', resendAvailableAt: 'B' }, 0);
  assert.equal(request.expiresAt, 'A');
  assert.equal(request.resendAvailableAt, 'B');
  assert.equal(withLocalOtpDeadlines(null), null);
});
