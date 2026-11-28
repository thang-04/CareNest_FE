import assert from 'node:assert/strict';
import { test } from 'node:test';

const { fallbackErrorMessage, normalizeApiError } = await import('@/services/http/apiError');

const axiosError = (status, data, code) => ({
  code,
  message: status ? `Request failed with status code ${status}` : 'timeout of 15000ms exceeded',
  response: status ? { status, data } : undefined,
});

test('lỗi proxy 502/504 (thân HTML) hiện câu tiếng Việt, không lộ câu axios', () => {
  for (const status of [502, 503, 504]) {
    const message = normalizeApiError(axiosError(status, '<html>502 Bad Gateway</html>')).message;
    assert.equal(message, 'Máy chủ đang bận hoặc đang khởi động lại. Vui lòng thử lại sau ít phút.');
    assert.doesNotMatch(message, /status code|Bad Gateway|\d{3}/);
  }
});

test('hết thời gian chờ và mất mạng có câu riêng', () => {
  assert.equal(fallbackErrorMessage(axiosError(0, undefined, 'ECONNABORTED')), 'Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút.');
  assert.equal(fallbackErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' }), 'Không thể kết nối máy chủ');
});

test('lỗi 500 không có desc và status lạ không trả câu tiếng Anh', () => {
  assert.equal(fallbackErrorMessage(axiosError(500, '')), 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.');
  assert.equal(fallbackErrorMessage(axiosError(418, '')), 'Yêu cầu không thành công. Vui lòng thử lại.');
});

test('desc tiếng Việt của BE vẫn được ưu tiên', () => {
  const body = { code: 503, errorCode: 6111, desc: 'AI đang quá tải, thử lại sau', data: null };
  assert.equal(normalizeApiError(axiosError(503, body)).message, 'AI đang quá tải, thử lại sau');
});
