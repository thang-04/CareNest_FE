import assert from 'node:assert/strict';
import { test } from 'node:test';

const { resolveKitchenCampusId } = await import('@/utils/kitchen/kitchenCampus');

test('principal without an assigned campus starts on the first campus from master data', () => {
  assert.equal(resolveKitchenCampusId({ id: 'principal', role: 'PRINCIPAL', campusId: null }, '', 'c1'), 'c1');
});

test('principal selection wins and non-principal scope stays assigned', () => {
  assert.equal(resolveKitchenCampusId({ role: 'PRINCIPAL', campusId: null }, 'c2', 'c1'), 'c2');
  assert.equal(resolveKitchenCampusId({ role: 'VICE_PRINCIPAL', campusId: 'c2' }, '', 'c1'), 'c2');
  assert.equal(resolveKitchenCampusId({ role: 'KITCHEN_STAFF', campusId: null }, '', 'c1'), '');
});
