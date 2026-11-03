import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as table from '../../src/models/education-plan/goalTable.js';

const goal = (id) => ({ id, kind: 'goal', text: id, contents: [{ id: `c-${id}`, text: 'Nội dung thử', themes: ['t1'] }] });
const sub = (id) => ({ id, kind: 'sub', text: 'Lĩnh vực con cùng tên' });
const group = (id) => ({ id, kind: 'group', text: id });

test('EDU-48: xác định toàn bộ nhánh có nhóm và mục tiêu trực tiếp, không mutate dữ liệu', () => {
  const rows = [sub('a'), goal('direct'), group('g1'), goal('one'), group('empty'), sub('b'), goal('two')];
  const before = structuredClone(rows);
  assert.equal(typeof table.subDomainBranch, 'function');
  assert.deepEqual(table.subDomainBranch(rows, 'a'), rows.slice(0, 5));
  assert.deepEqual(rows, before);
});

for (const [name, rows, id, expected] of [
  ['đầu', [sub('a'), goal('one'), sub('b'), goal('two')], 'a', ['a', 'one']],
  ['giữa', [sub('a'), goal('one'), sub('b'), group('g'), goal('two'), sub('c')], 'b', ['b', 'g', 'two']],
  ['cuối', [sub('a'), goal('one'), sub('b'), goal('two')], 'b', ['b', 'two']],
  ['duy nhất', [sub('a'), group('g'), goal('one')], 'a', ['a', 'g', 'one']],
  ['rỗng', [sub('a'), sub('b'), goal('two')], 'a', ['a']],
  ['ID không có', [sub('a'), goal('one')], 'missing', []],
  ['ID của goal không phải sub', [sub('a'), goal('one')], 'one', []],
  ['không có sub', [group('g'), goal('one')], 'g', []],
  ['không có hàng', [], 'a', []],
]) {
  test(`EDU-48: nhánh ${name}, chỉ chọn theo ID và đúng boundary`, () => {
    assert.equal(typeof table.subDomainBranch, 'function');
    assert.deepEqual(
      table.subDomainBranch(rows, id).map((r) => r.id),
      expected,
    );
  });
}

test('EDU-48: bỏ nhánh trước normalize giữ đúng các dòng, số mục tiêu và dấu tích của nhánh khác', () => {
  const rows = [sub('a'), goal('one'), sub('b'), group('g'), goal('two')];
  assert.equal(typeof table.subDomainBranch, 'function');
  const removed = new Set(table.subDomainBranch(rows, 'a').map((r) => r.id));
  const kept = table.nestUnderFirstSub(rows.filter((r) => !removed.has(r.id)));
  assert.deepEqual(kept, rows.slice(2));
  const domains = [{ name: 'Phát triển thể chất', rows: kept }];
  assert.deepEqual(table.numberGoals(domains), { two: 1 });
  assert.deepEqual(table.themeGoalIds(domains, { id: 't1' }), ['two']);
  assert.deepEqual(kept.at(-1).contents, rows.at(-1).contents);
});
