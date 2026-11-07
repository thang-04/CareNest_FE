import assert from 'node:assert/strict';
import { test } from 'node:test';

const { stepOfCheck } = await import('@/utils/school-config/yearSetup');

test('readiness checks map to the wizard step that fixes them', () => {
  assert.equal(stepOfCheck('classes'), 1);
  assert.equal(stepOfCheck('teamLeaders'), 2);
  assert.equal(stepOfCheck('vicePrincipals'), 3);
  assert.equal(stepOfCheck('placement'), 5);
  assert.equal(stepOfCheck('unknown'), -1);
});
