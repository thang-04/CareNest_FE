import assert from 'node:assert/strict';
import { test } from 'node:test';

const { canAdjustMealCount, canConfirmMealCount } = await import('@/utils/attendance/attendancePermissions');
const { createAttendanceBeApi } = await import('@/services/attendance/api/attendanceApi');

const vpA = { role: 'VICE_PRINCIPAL', campusId: '1' };

test('sửa suất thay thế theo cờ canAdjust của BE (PHT được cấp quyền cả trường sửa được điểm trường kia)', () => {
  assert.equal(canAdjustMealCount({ id: 5, campusId: '2', status: 'CONFIRMED', canAdjust: true }, vpA), true);
  assert.equal(canAdjustMealCount({ id: 5, campusId: '1', status: 'CONFIRMED', canAdjust: false }, vpA), false);
  // Sổ tạm tính (chưa có id) không sửa
  assert.equal(canAdjustMealCount({ id: null, campusId: '1', status: 'OPEN', canAdjust: true }, vpA), false);
  assert.equal(canConfirmMealCount({ id: 5, campusId: '2', canConfirm: true }, vpA), true);
});

test('xác nhận sổ báo ăn gửi tổng suất đang thấy để BE từ chối khi số đã đổi', async () => {
  const calls = [];
  const client = { post: (url, body, config) => (calls.push({ url, config }), Promise.resolve({})) };
  await createAttendanceBeApi(client).confirmMealCount('7', { servings: 42, substitute: 2 });
  assert.equal(calls[0].url, '/meal-counts/7/confirm');
  assert.deepEqual(calls[0].config.params, { seenServings: 42, seenSubstitute: 2 });
});
