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
