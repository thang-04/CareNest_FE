import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('biểu mẫu gửi duyệt kế hoạch năm và kế hoạch tổ không nêu vai trò người duyệt', async () => {
  for (const page of ['GoalFormPage.jsx', 'GoalDetailPage.jsx']) {
    const source = await readFile(new URL(`../../src/pages/education-plan/${page}`, import.meta.url), 'utf8');
    const review = source.match(/<ReviewActions[\s\S]*?\/>/)?.[0];
    assert.ok(review, `${page} thiếu biểu mẫu duyệt`);
    assert.doesNotMatch(review, /sendTo=|Phó HT|Phó hiệu trưởng|Hiệu trưởng|Tổ trưởng/);
    assert.match(review, /Kế hoạch sẽ bị khóa cho tới khi được ban hành hoặc trả lại/);
  }
});
