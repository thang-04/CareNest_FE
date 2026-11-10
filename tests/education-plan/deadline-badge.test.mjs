import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKED_TEXT, dayKeyOf, deadlineLabel, dossierKey, semesterKey } from '../../src/models/education-plan/deadline.mjs';

// BE spec 003 FR-006: nhãn hạn hiển thị đúng trạng thái BE tính (không tự tính ở FE)
test('nhãn theo deadlineState', () => {
  const base = { deadline: '2026-11-16', daysLeft: 5 };
  assert.deepEqual(deadlineLabel({ ...base, deadlineState: 'NEAR' }), { tone: 'orange', label: 'Gần đến hạn · còn 5 ngày (16/11)' });
  assert.equal(deadlineLabel({ ...base, deadlineState: 'OVERDUE' }).tone, 'red');
  assert.equal(deadlineLabel({ ...base, deadlineState: 'ON_TIME' }).label, 'Đúng hạn');
  assert.equal(deadlineLabel({ ...base, deadlineState: 'LATE' }).label, 'Ban hành trễ');
  assert.equal(deadlineLabel({ ...base, deadlineState: 'NORMAL' }).label, 'Hạn 16/11');
});

test('mở hạn: nhãn dùng hạn mới', () => {
  assert.equal(
    deadlineLabel({ deadline: '2026-11-16', extendedTo: '2026-11-20', daysLeft: 2, deadlineState: 'NEAR' }).label,
    'Gần đến hạn · còn 2 ngày (20/11)',
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
  assert.ok(BLOCKED_TEXT.DEADLINE_PASSED.includes('mở khóa'));
});
