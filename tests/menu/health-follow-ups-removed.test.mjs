import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { getMenuForRole } = await import('@/layouts/menuConfig');

test('mục "Phiếu theo dõi sức khỏe" đã bỏ (HLT-16): không còn trong cấu hình menu và mọi menu vai trò', () => {
  const config = readFileSync('src/layouts/menuConfig.js', 'utf8');
  assert.ok(!config.includes('healthFollowUps'));
  assert.ok(!config.includes('health-follow-ups'));
  for (const role of ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'TEAM_LEADER']) {
    const keys = getMenuForRole(role, { role }).flatMap((e) => [e.key, ...(e.children || []).map((c) => c.key)]);
    assert.ok(!keys.includes('healthFollowUps'), role);
  }
});
