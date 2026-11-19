import test from 'node:test';
import assert from 'node:assert/strict';
import { mapActivityCards } from '../../src/models/education-plan/activityImport.mjs';

const source = [
  { id: '1', text: 'Giữ được thăng bằng cơ thể khi thực hiện vận động:', lines: ['Đi hết đoạn đường hẹp.', 'Đi kiễng gót.'] },
  { id: '2', text: 'Hát tự nhiên.', lines: ['Hát đúng giai điệu.'] },
];
const target = [
  { id: '90', text: 'Giữ được thăng bằng cơ thể khi thực hiện vận động', lines: ['- Đi kiễng gót', '- Đi hết đoạn đường hẹp'] },
  { id: '91', text: 'Nhận biết hình tròn.', lines: [] },
];

test('maps goals and content lines by text, drops unmatched goals and duplicates', () => {
  const cards = [
    { slot: 'hoc', name: 'Đi trong đường hẹp', goalIds: ['1', '2'], contentRefs: ['1:0', '1:1', '2:0'] },
    { slot: 'hoc', name: 'Hát: Vui đến trường', goalIds: ['2'], contentRefs: ['2:0'] },
    { slot: 'goc', name: 'Xếp hình', goalIds: ['1'], contentRefs: [] },
  ];
  const existing = [{ slot: 'goc', name: 'xếp hình.' }];
  const { cards: out, skipped } = mapActivityCards(cards, source, target, existing, (c) => ({ ...c, id: 'new' }));
  assert.deepEqual(out, [{ slot: 'hoc', name: 'Đi trong đường hẹp', goalIds: ['90'], contentRefs: ['90:1', '90:0'], id: 'new' }]);
  assert.deepEqual(
    skipped.map((s) => s.reason),
    ['Không có mục tiêu tương ứng trong chủ đề năm nay', 'Đã có hoạt động này'],
  );
});

test('AI mock picks a time slot by whole phrases, not substrings', async () => {
  // mockDatabase đọc window/localStorage khi nạp
  globalThis.window ??= new EventTarget();
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };
  const { slotFor } = await import('../../src/services/education-plan/mock/activityAiMock.js');
  assert.equal(slotFor('Giữ được thăng bằng cơ thể. Bước lên, xuống bục cao'), 'ngoai_troi');
  assert.equal(slotFor('Đặc điểm nổi bật và ích lợi của con vật, cây, hoa, quả quen thuộc'), 'hoc');
  assert.equal(slotFor('Rửa tay, lau mặt, súc miệng'), 'an_ngu');
  assert.equal(slotFor('Hô hấp: Hít vào, thở ra'), 'the_duc');
});

test('AI mock keeps long sentences with a colon and strips short Bộ labels', async () => {
  globalThis.window ??= new EventTarget();
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };
  const { activityAiMock } = await import('../../src/services/education-plan/mock/activityAiMock.js');
  const [a, b] = await activityAiMock.suggestActivityCards({
    goals: [
      { id: 1, text: 'Lắng nghe và trả lời câu hỏi', lines: ['- Trả lời và đặt các câu hỏi: ai? cái gì?'] },
      { id: 2, text: 'Thực hiện bài tập thể dục', lines: ['- Hô hấp: Hít vào, thở ra.'] },
    ],
  });
  assert.equal(a.name, 'Trả lời và đặt các câu hỏi: ai? cái gì?');
  assert.deepEqual([b.slot, b.name], ['the_duc', 'Bài tập: Hít vào, thở ra']);
});
