import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRewrite, cardsLostByRewrite, restoreCards, rewriteRequestGoals } from '../../src/models/education-plan/aiClassContent.mjs';

const goals = [
  { id: '10', lines: ['Hát cũ', 'Vỗ tay'] },
  { id: '11', lines: ['Đọc thơ'] },
];
const cards = [
  { id: 'a', name: 'Hát cùng cô', goalIds: ['10'], contentRefs: ['10:0'] },
  { id: 'b', name: 'Gõ phách', goalIds: ['10'], contentRefs: ['10:1'] },
  { id: 'c', name: 'Thơ', goalIds: ['11'], contentRefs: ['11:0'] },
  { id: 'd', name: 'Thẻ chung', goalIds: ['10'], contentRefs: [] },
];
const current = { 10: { text: '- Hát cũ\n- Vỗ tay', lines: ['Hát cũ', 'Vỗ tay'] }, 11: { text: '- Đọc thơ', lines: ['Đọc thơ'] } };

test('EDU-115: phạm vi tất cả / mục tiêu / một dòng và thẻ sẽ mất', () => {
  assert.equal(rewriteRequestGoals(goals).length, 2);
  const one = rewriteRequestGoals(goals, { goalId: '10', lineIndex: 1 });
  assert.deepEqual(one, [{ id: '10', lines: ['Hát cũ', 'Vỗ tay'], lineIndex: 1 }]);
  assert.deepEqual(
    cardsLostByRewrite(cards, one).map((c) => c.id),
    ['b'],
  );
  assert.deepEqual(
    cardsLostByRewrite(cards, rewriteRequestGoals(goals)).map((c) => c.id),
    ['a', 'b', 'c'],
  );
});

test('EDU-115: thay một dòng chỉ gỡ thẻ của dòng đó, ✗ trả lại cả thẻ', () => {
  const requestGoals = rewriteRequestGoals(goals, { goalId: '10', lineIndex: 1 });
  const result = applyRewrite({ requestGoals, current, cards, matches: [{ goalId: 10, text: 'Vỗ tay theo nhịp.', source: 'AI' }] });
  assert.equal(result.rows['10'], '- Hát cũ\n- Vỗ tay theo nhịp.');
  assert.deepEqual(
    result.cards.map((c) => c.id),
    ['a', 'c', 'd'],
  );
  assert.equal(result.pending['10'].before, current['10'].text);
  assert.deepEqual(
    restoreCards(result.cards, result.pending['10'].removed).map((c) => c.id),
    ['a', 'c', 'd', 'b'],
  );
});

test('EDU-115: thay cả mục tiêu; mục tiêu không có gợi ý hoặc đã sửa trong lúc chờ giữ nguyên', () => {
  const requestGoals = rewriteRequestGoals(goals);
  const edited = { ...current, 11: { text: '- Đọc thơ mới', lines: ['Đọc thơ mới'] } };
  const matches = [
    { goalId: 10, text: 'Hát to rõ.', source: 'CURRICULUM_C' },
    { goalId: 10, text: 'Hát nhóm.', source: 'AI' },
    { goalId: 11, text: 'Đọc ca dao.', source: 'RAG' },
  ];
  const result = applyRewrite({ requestGoals, current: edited, cards, matches });
  assert.equal(result.rows['10'], '- Hát to rõ.\n- Hát nhóm.');
  assert.equal(result.rows['11'], undefined);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.pending['10'].sources, ['CURRICULUM_C', 'AI']);
  assert.deepEqual(
    result.cards.map((c) => c.id),
    ['c', 'd'],
  );
});
