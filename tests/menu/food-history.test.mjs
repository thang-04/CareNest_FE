import assert from 'node:assert/strict';
import test from 'node:test';
import { foodHistoryValue, toFoodHistoryEntry } from '../../src/utils/menu-planning/foodHistory.js';

test('giá trị mã đổi sang nhãn, giá thành tiền, trống thành gạch ngang', () => {
  assert.equal(foodHistoryValue('Bảo quản', 'DRY'), 'Khô');
  assert.equal(foodHistoryValue('Đơn giá', '18000'), `${(18000).toLocaleString('vi-VN')} đ`);
  assert.equal(foodHistoryValue('Ghi chú', null), '—');
  assert.equal(foodHistoryValue('Tên thực phẩm', 'Gạo tẻ'), 'Gạo tẻ');
});

test('dòng lịch sử BE: giữ người, lúc, trường đổi trước/sau; sự kiện không có trường thì không có trước/sau', () => {
  const changed = toFoodHistoryEntry(
    { id: 5, userId: 3, at: '2026-11-25T03:00:00Z', action: 'UPDATED', field: 'Nhóm thực phẩm', oldValue: 'GRAIN', newValue: 'MEAT' },
    0,
  );
  assert.equal(changed.field, 'Nhóm thực phẩm');
  assert.equal(changed.userId, 3);
  assert.notEqual(changed.oldValue, changed.newValue);

  const created = toFoodHistoryEntry({ id: 1, userId: 3, at: '2026-11-25T03:00:00Z', action: 'CREATED' }, 1);
  assert.equal(created.field, '');
  assert.equal(created.newValue, '');
  assert.notEqual(created.id, changed.id);
});
