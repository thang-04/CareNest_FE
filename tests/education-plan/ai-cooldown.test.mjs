import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AI_COOLDOWN_MS, isAiCooling, startAiCooldown } from '../../src/hooks/education-plan/useAiRun.js';

test('Sau Hủy các nút AI khóa đúng 2 giây; Hủy lần nữa tính lại từ đầu', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  assert.equal(AI_COOLDOWN_MS, 2000);
  assert.equal(isAiCooling(), false);
  startAiCooldown();
  mock.timers.tick(1500);
  startAiCooldown();
  mock.timers.tick(1999);
  assert.equal(isAiCooling(), true);
  mock.timers.tick(1);
  assert.equal(isAiCooling(), false);
  mock.timers.reset();
});
