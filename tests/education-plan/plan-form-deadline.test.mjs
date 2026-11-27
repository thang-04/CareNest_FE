import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planFormDeadline } from '../../src/models/education-plan/deadline.mjs';

test('EDU-109: bản đang lập quá ngày bắt đầu năm học thì khóa gửi; chưa tới hoặc không rõ ngày thì không', () => {
  assert.deepEqual(planFormDeadline({ yearStart: '2026-09-05', today: '2026-09-05' }), {
    deadline: '2026-09-05',
    deadlineState: 'OVERDUE',
  });
  assert.equal(planFormDeadline({ yearStart: '2026-09-05', today: '2026-09-04' }), null);
  assert.equal(planFormDeadline({ yearStart: undefined, today: '2026-09-04' }), null);
});

test('EDU-109: bản đã có theo khóa của BE; mở hạn hoặc đã ban hành thì không hiện', () => {
  const locked = { status: 'DRAFT', timeLock: { deadline: '2026-09-05', timeLocked: true } };
  assert.equal(planFormDeadline({ plan: locked, today: '2026-10-01' }).deadlineState, 'OVERDUE');
  assert.equal(planFormDeadline({ plan: { ...locked, timeLock: { timeLocked: false } }, today: '2026-10-01' }), null);
  assert.equal(planFormDeadline({ plan: { ...locked, status: 'APPROVED' }, today: '2026-10-01' }), null);
});
