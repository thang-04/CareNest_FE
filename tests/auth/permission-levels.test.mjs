import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const { PERMISSION_LEVELS, PERMISSION_TASKS } = await import('@/models/account/permissionConstants');

test('AUTH-10: mọi việc trong bảng phân quyền đều có cấp quyền để vẽ badge màu', () => {
  for (const [code, task] of Object.entries(PERMISSION_TASKS)) {
    assert.ok(PERMISSION_LEVELS[task.level], `${code} thiếu cấp quyền`);
  }
  assert.equal(PERMISSION_TASKS.CHILD_PROFILE_VIEW.level, 'view');
  assert.equal(PERMISSION_TASKS.FOOD_SAFETY_APPROVE.level, 'approve');
  assert.equal(PERMISSION_TASKS.PERMISSION_MANAGE.level, 'admin');
});

test('AUTH-10: bốn cấp quyền khác màu nhau, có chú thích ở màn vai trò', async () => {
  const tones = Object.values(PERMISSION_LEVELS).map((level) => level.tone);
  assert.equal(new Set(tones).size, tones.length);
  const table = await readFile(new URL('../../src/components/permissions/PermissionTable.jsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../../src/pages/school-config/RoleDefaultsPage.jsx', import.meta.url), 'utf8');
  assert.match(table, /<PermissionLevelBadge level=\{task\?\.level\} \/>/);
  assert.match(page, /aria-label="Cấp quyền"/);
});
