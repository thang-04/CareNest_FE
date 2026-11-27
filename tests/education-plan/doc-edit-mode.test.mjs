import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearDocEditing, isDocEditing, setDocEditing } from '../../src/hooks/education-plan/useDocEditMode.js';

test('Trang chi tiết mặc định chỉ xem; bấm Chỉnh sửa giữ theo phạm vi tới khi Hủy hoặc về danh sách', () => {
  assert.equal(isDocEditing('u:theme:1'), false);
  setDocEditing('u:theme:1', true);
  assert.equal(isDocEditing('u:theme:1'), true);
  assert.equal(isDocEditing('u:day:1'), false);
  setDocEditing('u:theme:1', false);
  assert.equal(isDocEditing('u:theme:1'), false);
  setDocEditing('u:day:1', true);
  clearDocEditing();
  assert.equal(isDocEditing('u:day:1'), false);
});

test('EDU-116: lịch sử ghi đúng thao tác xóa phiên bản điều chỉnh', async () => {
  const { reviewHistoryItem } = await import('../../src/models/education-plan/reviewHistory.mjs');
  assert.equal(reviewHistoryItem({ action: 'discard_revision' }).title, 'Xóa phiên bản điều chỉnh');
});
