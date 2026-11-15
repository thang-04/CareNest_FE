import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { inlineErrors } from '@/utils/assessment/assessmentValidation';

test('lỗi BE gắn được ô hiện dưới ô đó, còn lại hiện ở đầu form', () => {
  const field = Object.assign(new Error('Nhập nội dung'), { details: { content: 'Nhập nội dung' } });
  assert.deepEqual(inlineErrors(field, ['content']), { content: 'Nhập nội dung' });
  const general = Object.assign(new Error('Học kỳ chưa kết thúc, chưa xác nhận được'), {
    details: { _form: 'Học kỳ chưa kết thúc, chưa xác nhận được' },
  });
  assert.deepEqual(inlineErrors(general, ['note']), { _form: 'Học kỳ chưa kết thúc, chưa xác nhận được' });
  // Ô form không có trên màn: vẫn báo ở đầu form, không mất lỗi
  const other = Object.assign(new Error('Mất kết nối'), { details: { month: 'Sai tháng' } });
  assert.deepEqual(inlineErrors(other, ['content']), { _form: 'Mất kết nối' });
});

test('đánh giá học kỳ, mở lại điểm danh, xếp loại, khen thưởng không báo lỗi bằng toast', () => {
  for (const file of [
    'src/pages/assessment/SemesterEvaluationListPage.jsx',
    'src/pages/attendance/AttendanceDayUnlockPage.jsx',
    'src/pages/assessment/ClassRatingsPage.jsx',
    'src/pages/assessment/RewardClassPage.jsx',
  ]) {
    assert.ok(!/toast\.error\(/.test(readFileSync(file, 'utf8')), file);
  }
});
