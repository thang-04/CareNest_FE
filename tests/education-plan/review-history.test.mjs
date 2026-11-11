import { test } from 'node:test';
import assert from 'node:assert/strict';
import { submitEntryOf } from '../../src/models/education-plan/reviewHistory.mjs';

// BE spec 002 FR-005: người duyệt thấy ghi chú của lần gửi gần nhất
test('lấy lần gửi gần nhất của kế hoạch năm/tổ (code SUBMIT)', () => {
  const doc = {
    history: [
      { code: 'SUBMIT', note: 'lần 1' },
      { code: 'RETURN', note: 'sửa lại' },
      { code: 'SUBMIT', note: 'lần 2' },
      { code: 'ISSUE' },
    ],
  };
  assert.equal(submitEntryOf(doc).note, 'lần 2');
});

test('lấy lần gửi của hồ sơ lớp (action submit), không có thì null', () => {
  assert.equal(submitEntryOf({ history: [{ action: 'submit', note: 'nhờ cô xem' }, { action: 'approve' }] }).note, 'nhờ cô xem');
  assert.equal(submitEntryOf({ history: [{ action: 'approve' }] }), null);
  assert.equal(submitEntryOf(null), null);
});
