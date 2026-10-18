import { OVERRIDE_EFFECT } from '@/models/account/permissionConstants';

/**
 * Mỗi quyền cấu hình được của một người = một công tắc (BE AUTH-10).
 * Bật/tắt trùng mặc định của vai trò thì không lưu ngoại lệ; khác mặc định mới là GRANT/REVOKE.
 */
export const personPermissionRows = ({ configurable = [], roleDefaults = [], overrides = [], effectivePermissions }) =>
  configurable.map((code) => {
    const roleOn = roleDefaults.includes(code);
    const effect = overrides.find((o) => o.permission === code)?.effect;
    const on = effect === OVERRIDE_EFFECT.GRANT ? true : effect === OVERRIDE_EFFECT.REVOKE ? false : roleOn;
    return {
      code,
      roleOn,
      on,
      effect: effect || OVERRIDE_EFFECT.INHERIT,
      effective: effectivePermissions ? effectivePermissions.includes(code) : on,
    };
  });

export const changedRows = (rows, values) => rows.filter((r) => values[r.code] !== r.on);

export const overridesFromSwitches = (rows, values) =>
  rows
    .filter((r) => values[r.code] !== r.roleOn)
    .map((r) => ({ permission: r.code, effect: values[r.code] ? OVERRIDE_EFFECT.GRANT : OVERRIDE_EFFECT.REVOKE }));
