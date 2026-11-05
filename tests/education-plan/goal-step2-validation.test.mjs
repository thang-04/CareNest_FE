import assert from 'node:assert/strict';
import { test } from 'node:test';

const { duplicateNameIds, mixedSubDomains, nameKey, themeWithoutDates } = await import('@/models/education-plan/goalTable');

const goal = (id, text, contents = []) => ({ id, kind: 'goal', text, contents });
const content = (id, text) => ({ id, text, themes: [] });

test('so trùng tên: bỏ khoảng trắng thừa, không phân biệt hoa thường, giữ dấu tiếng Việt', () => {
  assert.equal(nameKey('  Bé   tự  phục vụ '), 'bé tự phục vụ');
  assert.notEqual(nameKey('Bé'), nameKey('Be'));
});

test('trùng tên trong cùng lĩnh vực con: lĩnh vực con, nhóm kết quả, mục tiêu, nội dung (BE:EDU-51)', () => {
  const domains = [
    {
      name: 'Phát triển thể chất',
      rows: [
        { id: 's1', kind: 'sub', text: 'Dinh dưỡng' },
        { id: 'g1', kind: 'group', text: 'Ăn uống' },
        goal('m1', 'Trẻ ăn hết suất', [content('c1', 'Ăn chín'), content('c2', ' ăn  chín '), content('c3', '  ')]),
        goal('m2', 'trẻ ăn hết suất'),
        { id: 'g2', kind: 'group', text: 'ăn uống' },
        { id: 's2', kind: 'sub', text: 'dinh dưỡng ' },
        // Cùng chữ nhưng ở lĩnh vực con khác: không trùng
        goal('m3', 'Trẻ ăn hết suất', [content('c4', 'Ăn chín')]),
        goal('m4', '', [content('c5', 'Ăn chín')]),
      ],
    },
  ];
  assert.deepEqual([...duplicateNameIds(domains)].sort(), ['c1', 'c2', 'g1', 'g2', 'm1', 'm2', 's1', 's2']);
});

test('lĩnh vực không có lĩnh vực con: so trong cả lĩnh vực; khác lĩnh vực không tính', () => {
  const domains = [
    { name: 'A', rows: [goal('a1', 'Mục tiêu X'), goal('a2', 'Mục tiêu Y')] },
    { name: 'B', rows: [goal('b1', 'Mục tiêu X')] },
  ];
  assert.equal(duplicateNameIds(domains).size, 0);
  domains[0].rows.push(goal('a3', 'mục tiêu x'));
  assert.deepEqual([...duplicateNameIds(domains)].sort(), ['a1', 'a3']);
});

test('ban hành cần đủ Từ ngày, Đến ngày cho mọi chủ đề (BE:EDU-52)', () => {
  assert.equal(themeWithoutDates([{ id: 'a', start: '2026-09-07', end: '2026-10-02' }]), null);
  assert.equal(themeWithoutDates([{ id: 'a', start: '2026-09-07', end: '' }]).id, 'a');
  assert.equal(themeWithoutDates([{ id: 'a', start: '', end: '' }]).id, 'a');
});

test('lĩnh vực có lĩnh vực con thì mọi dòng phải thuộc lĩnh vực con; không có lĩnh vực con nào cũng được (BE:EDU-53)', () => {
  const sub = (id, text) => ({ id, kind: 'sub', text });
  const domains = [
    { name: 'Lẫn', rows: [goal('g1', 'Trẻ giữ thăng bằng'), sub('s1', 'Vận động'), goal('g2', 'Trẻ chạy')] },
    { name: 'Đủ', rows: [sub('s2', 'Vận động'), goal('g3', 'Trẻ chạy')] },
    { name: 'Không có', rows: [goal('g4', 'Trẻ chạy')] },
    { name: 'Dòng trống trước', rows: [goal('g5', '  '), sub('s3', 'Vận động'), goal('g6', 'Trẻ chạy')] },
    { name: 'Lĩnh vực con trống', rows: [goal('g7', 'Trẻ chạy'), sub('s4', ' ')] },
  ];
  assert.deepEqual(mixedSubDomains(domains), ['Lẫn']);
});
