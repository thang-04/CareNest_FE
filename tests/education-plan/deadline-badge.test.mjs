import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_TEXT, dayKeyOf, deadlineLabel, dossierKey, isOverdueDoc, semesterKey } from '../../src/models/education-plan/deadline.mjs';

// BE spec 003 FR-006: nhãn hạn hiển thị đúng trạng thái BE tính (không tự tính ở FE)
test('nhãn theo deadlineState', () => {
  const base = { deadline: '2026-11-16', daysLeft: 5 };
  assert.deepEqual(deadlineLabel({ ...base, deadlineState: 'NEAR' }), { tone: 'orange', label: 'Hạn: Gần đến hạn · còn 5 ngày (16/11)' });
  assert.equal(deadlineLabel({ ...base, deadlineState: 'OVERDUE' }).tone, 'red');
  assert.equal(deadlineLabel({ ...base, deadlineState: 'ON_TIME' }).label, 'Hạn: Đúng hạn');
  assert.equal(deadlineLabel({ ...base, deadlineState: 'NORMAL' }).label, 'Hạn: 16/11');
});

// EDU-109: ban hành sau hạn không hiện nhãn hạn (bỏ "Ban hành trễ")
test('ban hành sau hạn: không nhãn', () => {
  const base = { deadline: '2026-11-16' };
  assert.equal(deadlineLabel({ ...base, deadlineState: 'LATE' }), null);
  assert.equal(deadlineLabel({ ...base, deadlineState: 'ISSUED' }), null);
});

test('mở hạn: nhãn dùng hạn mới', () => {
  assert.equal(
    deadlineLabel({ deadline: '2026-11-16', extendedTo: '2026-11-20', daysLeft: 2, deadlineState: 'NEAR' }).label,
    'Hạn: Gần đến hạn · còn 2 ngày (20/11)',
  );
});

test('năm chưa cấu hình học kỳ: không có nhãn hạn', () => {
  assert.equal(deadlineLabel({ deadline: null, deadlineState: 'NORMAL' }), null);
  assert.equal(deadlineLabel(null), null);
});

test('khóa gốc và giáo án ngày khớp BE', () => {
  assert.equal(semesterKey('22', '353', 1), 'sp_22_353_1');
  assert.equal(dossierKey('22', '730'), 'ds_22_730');
  assert.equal(dayKeyOf('wp_22_2026-09-07_356'), 'dd_22_2026-09-07_356');
  // Spec 005 FR-021: chỉ Hiệu trưởng mở hạn
  assert.equal(BLOCKED_TEXT.DEADLINE_PASSED, 'Quá hạn — chờ Hiệu trưởng mở hạn.');
});

// EDU-109: khóa đúng ngày hạn, không còn ngày ân hạn (graceTo bị bỏ qua)
test('nhãn cũ chuyển Quá hạn đúng ngày hạn', () => {
  const saved = { deadline: '2026-11-19', deadlineState: 'NEAR', daysLeft: 1 };
  assert.equal(deadlineLabel(saved, '2026-11-19').label, 'Hạn: Quá hạn (19/11)');
  assert.equal(deadlineLabel({ ...saved, graceTo: '2026-11-22' }, '2026-11-20').label, 'Hạn: Quá hạn (19/11)');
  assert.equal(deadlineLabel({ ...saved, deadlineState: 'ON_TIME' }, '2026-11-20').label, 'Hạn: Đúng hạn');
});

test('isOverdueDoc: chưa ban hành và quá hạn, kể cả Chờ duyệt', () => {
  assert.equal(isOverdueDoc({ status: 'DRAFT', deadlineState: 'OVERDUE' }), true);
  assert.equal(isOverdueDoc({ status: 'REVIEW', deadlineState: 'OVERDUE' }), true);
  assert.equal(isOverdueDoc({ status: 'PENDING_VP', timeLock: { deadlineState: 'OVERDUE' } }), true);
  assert.equal(isOverdueDoc({ status: 'REVIEW', reviewDeadline: { locked: true } }), true);
  assert.equal(isOverdueDoc({ status: 'APPROVED', deadlineState: 'OVERDUE' }), false);
  assert.equal(isOverdueDoc({ status: 'REVIEW', deadlineState: 'NEAR' }), false);
  assert.equal(isOverdueDoc(undefined), false);
});
