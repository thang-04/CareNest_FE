import assert from 'node:assert/strict';
import { test } from 'node:test';

const { groupRoundLines, tallyResults, withEditReason } = await import('../../src/utils/kitchen/freshGoodsForm.js');

const LABELS = { MEAT: 'Thịt', VEGETABLE: 'Rau, củ', OTHER: 'Khác' };
const line = (id) => ({ food: { id, name: `F${id}` } });

test('chia dòng theo nhóm đúng thứ tự danh mục, giữ vị trí dòng; không rõ nhóm vào "Khác"', () => {
  const lines = [line(1), line(2), line(3), line(4)];
  const groupOfFood = new Map([
    ['1', 'VEGETABLE'],
    ['2', 'MEAT'],
    ['3', 'VEGETABLE'],
  ]);
  const groups = groupRoundLines(lines, groupOfFood, LABELS);
  assert.deepEqual(
    groups.map((g) => [g.key, g.rows.map((r) => r.index)]),
    [
      ['MEAT', [1]],
      ['VEGETABLE', [0, 2]],
      ['OTHER', [3]],
    ],
  );
});

test('chưa tải được danh mục nhóm thì mọi dòng vào "Khác"', () => {
  const groups = groupRoundLines([line(1), line(2)], undefined, LABELS);
  assert.deepEqual(
    groups.map((g) => [g.key, g.rows.length]),
    [['OTHER', 2]],
  );
});

test('đếm kết quả đã chọn, bỏ dòng chưa chọn', () => {
  const form = { lines: [{ result: 'ENOUGH' }, { result: 'ENOUGH' }, { result: 'SHORT' }, { result: '' }] };
  assert.deepEqual(tallyResults(form), { ENOUGH: 2, SHORT: 1 });
});

test('lý do sửa lại đứng đầu ghi chú chung', () => {
  assert.equal(withEditReason('', '  Nhập nhầm  '), 'Sửa lại: Nhập nhầm');
  assert.equal(withEditReason('Hàng về muộn', 'Nhập nhầm'), 'Sửa lại: Nhập nhầm. Hàng về muộn');
});
