import assert from 'node:assert/strict';
import { test } from 'node:test';

const { getMenuForRole } = await import('@/layouts/menuConfig');
const { getActiveMenuChild } = await import('@/layouts/sidebarSelection');

test('principal and vice principal use one people entry while teacher keeps child list', () => {
  for (const role of ['PRINCIPAL', 'VICE_PRINCIPAL']) {
    const menu = getMenuForRole(role, () => true);
    const entries = menu.flatMap((item) => item.children || []);
    assert.equal(entries.find((entry) => entry.key === 'peopleHub')?.to, '/people');
    assert.ok(!entries.some((entry) => entry.key === 'childList' || entry.key === 'parentActivation'));
    assert.ok(!entries.some((entry) => entry.key === 'schoolVps' || entry.key === 'schoolTeachers'));
    assert.deepEqual(getActiveMenuChild(menu, '/children/activation'), { groupKey: 'people', childKey: 'peopleHub' });
    assert.deepEqual(getActiveMenuChild(menu, '/school/staff/42'), { groupKey: 'people', childKey: 'peopleHub' });
  }
  const teacherEntries = getMenuForRole('TEACHER', () => true).flatMap((item) => item.children || []);
  assert.ok(teacherEntries.some((entry) => entry.key === 'childList'));
});
