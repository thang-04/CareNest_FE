import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/*
 * Ô gam / lượng mua trên màn cân đối: số 3 chữ số thập phân hiện đủ, dấu phẩy thập phân giống các cột số của bảng.
 */
const cell = readFileSync('src/components/menu-planning/balance/NumberCell.jsx', 'utf8');
const css = readFileSync('src/styles/modules/menu-planning.css', 'utf8');

test('ô số hiện dấu phẩy và nhận cả dấu chấm lẫn dấu phẩy', () => {
  assert.match(cell, /\.replace\('\.', ','\)/);
  assert.match(cell, /text\.trim\(\)\.replace\(',', '\.'\)/);
  assert.match(cell, /inputMode="decimal"/);
  assert.doesNotMatch(cell, /type="number"/);
});

test('ô số đủ rộng cho số có 3 chữ số thập phân', () => {
  assert.match(css, /\.input\.td-bal__input \{\s*width: 7rem;/);
});
