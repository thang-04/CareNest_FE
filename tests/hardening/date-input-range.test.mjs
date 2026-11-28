import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextLastValid, typedDateOutcome } from '@/utils/dateInputRules';

// Mô phỏng ô ngày + form cha: gõ từng phím, mỗi lần form nhận `emit` làm value mới và ô nhớ ngày hợp lệ gần nhất.
const typeInto = (initialValue, keys, { min, max } = {}) => {
  let value = initialValue;
  let lastValid = nextLastValid(value, '');
  let text = '';
  let typed = '';
  [...keys].forEach((ch) => {
    typed += ch;
    const out = typedDateOutcome(typed, { lastValid, min, max });
    text = out.text;
    value = out.emit;
    lastValid = nextLastValid(value, lastValid);
    typed = out.text;
  });
  return { text, value };
};

test('gõ ngày đủ ngoài min thì quay về ngày hợp lệ trước đó, không để đoạn dở', () => {
  // Chọn hết rồi gõ 01/11/2026 khi min là 12/11/2026; trước đó ô đang là 12/11/2026
  const result = typeInto('2026-11-12', '01/11/2026', { min: '2026-11-12' });
  assert.deepEqual(result, { text: '12/11/2026', value: '2026-11-12' });
});

test('gõ ngày đủ ngoài max thì quay về ngày hợp lệ trước đó', () => {
  const result = typeInto('2026-11-20', '25/12/2026', { max: '2026-11-30' });
  assert.deepEqual(result, { text: '20/11/2026', value: '2026-11-20' });
});

test('ô đang trống mà gõ ngày ngoài khoảng thì về trống', () => {
  const result = typeInto('', '01/11/2026', { min: '2026-11-12' });
  assert.deepEqual(result, { text: '', value: '' });
});

test('ngày trong khoảng được nhận bình thường', () => {
  const result = typeInto('2026-11-12', '15/11/2026', { min: '2026-11-12', max: '2026-11-30' });
  assert.deepEqual(result, { text: '15/11/2026', value: '2026-11-15' });
});

test('đoạn gõ dở được truyền lên để form báo lỗi và không làm mất ngày hợp lệ gần nhất', () => {
  assert.deepEqual(typedDateOutcome('15/1', { lastValid: '2026-11-12' }), { text: '15/1', emit: '15/1' });
  assert.equal(nextLastValid('15/1', '2026-11-12'), '2026-11-12');
  assert.equal(nextLastValid('2026-11-20', '2026-11-12'), '2026-11-20');
  assert.equal(nextLastValid('', '2026-11-12'), '');
});
