import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginErrorText, loginLockSeconds } from '../../src/utils/auth/loginErrorText.js';

test('disabled account explains who can reopen it instead of a wrong-password hint', () => {
  assert.equal(
    loginErrorText({ errorCode: 1015, message: 'ignored' }),
    'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Ban Giám hiệu để được hỗ trợ mở lại.',
  );
  assert.equal(loginErrorText({ errorCode: 1001 }), 'Sai tài khoản hoặc mật khẩu');
});

test('temporary lock exposes the remaining wait only for the lock error code', () => {
  assert.equal(loginLockSeconds({ errorCode: 1020, details: { retryAfterSeconds: 45 } }), 45);
  assert.equal(loginLockSeconds({ errorCode: 1020, details: { retryAfterSeconds: 59.2 } }), 60);
  assert.equal(loginLockSeconds({ errorCode: 1020, details: {} }), 0);
  assert.equal(loginLockSeconds({ errorCode: 1001, details: { retryAfterSeconds: 45 } }), 0);
  assert.equal(loginLockSeconds(undefined), 0);
});
