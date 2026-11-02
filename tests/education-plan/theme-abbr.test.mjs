import assert from 'node:assert/strict';
import { test } from 'node:test';

const { duplicateAbbrThemeIds } = await import('@/models/education-plan/goalTable');

test('viết tắt trùng: bỏ khoảng trắng, không phân biệt hoa thường, ô trống không tính (BE:EDU-42)', () => {
  const themes = [
    { id: 'a', abbr: 'TMN' },
    { id: 'b', abbr: ' tmn ' },
    { id: 'c', abbr: 'BT' },
    { id: 'd', abbr: '' },
    { id: 'e', abbr: '  ' },
  ];
  assert.deepEqual([...duplicateAbbrThemeIds(themes)].sort(), ['a', 'b']);
  assert.equal(duplicateAbbrThemeIds([{ id: 'a', abbr: 'TMN' }, { id: 'b' }]).size, 0);
});
