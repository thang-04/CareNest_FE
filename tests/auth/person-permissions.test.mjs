import assert from 'node:assert/strict';
import { test } from 'node:test';

const { personPermissionRows, changedRows, overridesFromSwitches } = await import('@/utils/account/personPermissions');

const configurable = ['CHILD_PROFILE_VIEW', 'ACCOUNT_MANAGE', 'PARENT_ACCOUNT_MANAGE'];
const roleDefaults = ['CHILD_PROFILE_VIEW', 'PARENT_ACCOUNT_MANAGE'];

test('AUTH-10: switch shows role default unless the person has an override', () => {
  const rows = personPermissionRows({
    configurable,
    roleDefaults,
    overrides: [
      { permission: 'ACCOUNT_MANAGE', effect: 'GRANT' },
      { permission: 'PARENT_ACCOUNT_MANAGE', effect: 'REVOKE' },
    ],
  });
  assert.deepEqual(
    rows.map((r) => [r.code, r.roleOn, r.on]),
    [
      ['CHILD_PROFILE_VIEW', true, true],
      ['ACCOUNT_MANAGE', false, true],
      ['PARENT_ACCOUNT_MANAGE', true, false],
    ],
  );
});

test('AUTH-10: saving keeps only switches that differ from the role default', () => {
  const rows = personPermissionRows({ configurable, roleDefaults, overrides: [{ permission: 'ACCOUNT_MANAGE', effect: 'GRANT' }] });
  // Tắt xem hồ sơ trẻ (khác mặc định), đưa "Tạo tài khoản" về mặc định (tắt)
  const values = { CHILD_PROFILE_VIEW: false, ACCOUNT_MANAGE: false, PARENT_ACCOUNT_MANAGE: true };
  assert.deepEqual(
    changedRows(rows, values).map((r) => r.code),
    ['CHILD_PROFILE_VIEW', 'ACCOUNT_MANAGE'],
  );
  assert.deepEqual(overridesFromSwitches(rows, values), [{ permission: 'CHILD_PROFILE_VIEW', effect: 'REVOKE' }]);
});

test('AUTH-10: override equal to the role default is dropped on save', () => {
  const rows = personPermissionRows({ configurable, roleDefaults, overrides: [{ permission: 'CHILD_PROFILE_VIEW', effect: 'GRANT' }] });
  const values = Object.fromEntries(rows.map((r) => [r.code, r.on]));
  assert.deepEqual(changedRows(rows, values), []);
  assert.deepEqual(overridesFromSwitches(rows, values), []);
});

test('AUTH-13: effective column follows BE response even when local default differs', () => {
  const rows = personPermissionRows({
    configurable: ['CHILD_PROFILE_VIEW'],
    roleDefaults: [],
    overrides: [{ permission: 'CHILD_PROFILE_VIEW', effect: 'REVOKE' }],
    effectivePermissions: ['CHILD_PROFILE_VIEW'],
  });
  assert.equal(rows[0].on, false);
  assert.equal(rows[0].effective, true);
  assert.equal(rows[0].effect, 'REVOKE');
});
