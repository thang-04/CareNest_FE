import assert from 'node:assert/strict';
import { test } from 'node:test';

const { canManageStockAt } = await import('@/utils/kitchen/kitchenPermissions');

const principal = { role: 'PRINCIPAL', campusId: 'c1', bePermissions: ['STOCK_MANAGE'] };
const vpCampus1 = { role: 'VICE_PRINCIPAL', campusId: 'c1', locationIds: ['c1'], bePermissions: ['STOCK_MANAGE'] };

test('PHT chỉ ghi kho ở điểm trường được phân công', () => {
  assert.equal(canManageStockAt(vpCampus1, 'c1'), true);
  assert.equal(canManageStockAt(vpCampus1, 'c2'), false);
  assert.equal(canManageStockAt(vpCampus1, undefined), false);
});

test('PHT được cấp STOCK_MANAGE phạm vi cả trường thì ghi mọi điểm trường', () => {
  const vp = { ...vpCampus1, beSchoolWidePermissions: ['STOCK_MANAGE'] };
  assert.equal(canManageStockAt(vp, 'c2'), true);
});

test('HT ghi mọi điểm trường; thiếu mã STOCK_MANAGE thì không ai ghi được', () => {
  assert.equal(canManageStockAt(principal, 'c2'), true);
  assert.equal(canManageStockAt({ ...vpCampus1, bePermissions: [] }, 'c1'), false);
  assert.equal(canManageStockAt({ ...principal, bePermissions: [] }, 'c1'), false);
});

test('Vai trò khác không ghi kho dù có điểm trường', () => {
  assert.equal(canManageStockAt({ role: 'TEACHER', campusId: 'c1', bePermissions: ['STOCK_MANAGE'] }, 'c1'), false);
});
