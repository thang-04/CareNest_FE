import assert from 'node:assert/strict';
import { test } from 'node:test';

const { APPROVAL_TYPE, APPROVAL_TYPES_BY_ROLE } = await import('@/models/dashboard/dashboardConstants');

// NUT-02: Hiệu trưởng xác nhận số suất thay PHT ⇒ "Chờ duyệt" của HT có sổ báo ăn chờ xác nhận
test('principal approvals include pending meal counts', () => {
  assert.ok(APPROVAL_TYPES_BY_ROLE.PRINCIPAL.includes(APPROVAL_TYPE.MEAL_COUNT));
  assert.ok(APPROVAL_TYPES_BY_ROLE.PRINCIPAL.includes(APPROVAL_TYPE.REWARD_DECISION));
});
