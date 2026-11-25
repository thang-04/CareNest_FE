import assert from 'node:assert/strict';
import { test } from 'node:test';

const { canConfirmMealCount } = await import('@/utils/attendance/attendancePermissions');
const { createAttendanceBeApi } = await import('@/services/attendance/api/attendanceApi');

const vpA = { role: 'VICE_PRINCIPAL', campusId: '1' };

test('xác nhận sổ báo ăn theo cờ canConfirm của BE (PHT được cấp quyền cả trường xác nhận được điểm trường kia)', () => {
  assert.equal(canConfirmMealCount({ id: 5, campusId: '2', canConfirm: true }, vpA), true);
});

test('xác nhận sổ báo ăn gửi tổng suất đang thấy để BE từ chối khi số đã đổi', async () => {
  const calls = [];
  const client = { post: (url, body, config) => (calls.push({ url, config }), Promise.resolve({})) };
  await createAttendanceBeApi(client).confirmMealCount('7', { servings: 42 });
  assert.equal(calls[0].url, '/meal-counts/7/confirm');
  assert.deepEqual(calls[0].config.params, { seenServings: 42 });
});
