import assert from 'node:assert/strict';
import { test } from 'node:test';

const { peopleTabsFor, peopleLandingPath } = await import('@/utils/account/peopleNavigation');

test('management hub exposes only tabs allowed to the current principal or vice principal', () => {
  const principal = {
    role: 'PRINCIPAL',
    permissions: ['ACCOUNT_MANAGE', 'STAFF_ASSIGNMENT_MANAGE', 'PERMISSION_MANAGE', 'PARENT_ACCOUNT_MANAGE'],
  };
  const vice = { role: 'VICE_PRINCIPAL', permissions: ['PARENT_ACCOUNT_MANAGE'] };
  const teacher = { role: 'TEACHER', permissions: [] };
  assert.deepEqual(
    peopleTabsFor(principal).map((tab) => tab.key),
    ['staff', 'parents', 'children'],
  );
  assert.deepEqual(
    peopleTabsFor(vice).map((tab) => tab.key),
    ['parents', 'children'],
  );
  assert.deepEqual(peopleTabsFor(teacher), []);
  assert.equal(peopleLandingPath(vice), '/children/activation');
  assert.equal(peopleLandingPath(principal), '/school/staff');
});
