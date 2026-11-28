import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync('src/pages/assessment/WeeklyCommentsPage.jsx', 'utf8');

test('nhận xét tuần chưa lưu thì hỏi trước khi rời trang và khi đổi trẻ, lớp, tuần', () => {
  assert.match(page, /useLeaveGuard\(\{ when: dirty, onSave: save \}\)/);
  assert.match(page, /<LeaveConfirmModal/);
  assert.equal(page.match(/confirmChange\(\(\) =>/g)?.length, 4);
});

test('đổi trẻ không làm màn tưởng nhầm là đang có chữ chưa lưu', () => {
  // Chữ đang gõ suy ra ngay trong lần vẽ, không chờ effect chép bản đã lưu vào ô
  assert.match(page, /const text = edited\?\.key === textKey \? edited\.value : saved;/);
  assert.doesNotMatch(page, /setText\(saved\)/);
});

test('nhận xét tuần đang soạn được giữ bản nháp trên máy và lấy lại được', () => {
  assert.match(page, /useDraftBackup\(\{/);
  assert.match(page, /docKey: row && board \? `weekly-comment:/);
  assert.match(page, /<VersionHistory/);
});
