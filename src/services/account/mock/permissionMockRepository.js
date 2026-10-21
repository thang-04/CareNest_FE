import { readDb, writeDb, clone, delay, ApiError, applyMockSeedMigration } from '@/mocks/mockDatabase';
import { canManagePermissions } from '@/utils/account/permissionManagementPermissions';
import { validatePermissionChange } from '@/utils/account/permissionValidation';
import { OVERRIDE_EFFECT, PERMISSION_ROLES } from '@/models/account/permissionConstants';
import { uid } from '@/utils/id';

// Cấu hình demo độc lập của UI G94-209; không áp vào quyền hoặc phân công đang chạy.

// `feature/action/requires` và 2 mã *_VIEW theo contract FE đề xuất, BE chưa duyệt
// (docs/plans/active/2026-10-20-permission-view-edit-levels.md, mục "Đề xuất contract BE").
const CATALOG = [
  {
    code: 'CHILD_PROFILE_VIEW',
    module: 'child',
    feature: 'child-profile',
    action: 'VIEW',
    requires: [],
    description: 'Xem hồ sơ trẻ trong phạm vi',
    defaultRoles: ['PARENT', 'PRINCIPAL', 'TEACHER', 'VICE_PRINCIPAL'],
    configurableRoles: ['TEACHER', 'VICE_PRINCIPAL'],
  },
  {
    code: 'STAFF_ACCOUNT_VIEW',
    module: 'account',
    feature: 'staff',
    action: 'VIEW',
    requires: [],
    description: 'Xem danh sách, chi tiết tài khoản nhân sự',
    defaultRoles: ['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'ACCOUNT_MANAGE',
    module: 'account',
    feature: 'staff',
    action: 'MANAGE',
    requires: ['STAFF_ACCOUNT_VIEW'],
    description: 'Cấp tài khoản, cấp lại mật khẩu tạm',
    defaultRoles: ['ADMIN', 'PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'ACCOUNT_STATUS_MANAGE',
    module: 'account',
    feature: 'staff',
    action: 'MANAGE',
    requires: ['STAFF_ACCOUNT_VIEW'],
    description: 'Khóa / mở tài khoản',
    defaultRoles: ['ADMIN', 'PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'STAFF_ASSIGNMENT_MANAGE',
    module: 'staff',
    feature: 'staff',
    action: 'MANAGE',
    requires: ['STAFF_ACCOUNT_VIEW'],
    description: 'Phân công nhân sự (campus, lớp)',
    defaultRoles: ['PRINCIPAL', 'VICE_PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'PARENT_ACCOUNT_VIEW',
    module: 'child',
    feature: 'parent-account',
    action: 'VIEW',
    requires: [],
    description: 'Xem tài khoản phụ huynh và liên kết với trẻ',
    defaultRoles: ['PRINCIPAL', 'VICE_PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'PARENT_ACCOUNT_MANAGE',
    module: 'child',
    feature: 'parent-account',
    action: 'MANAGE',
    requires: ['PARENT_ACCOUNT_VIEW'],
    description: 'Cấp, khóa/mở tài khoản phụ huynh và liên kết với trẻ',
    defaultRoles: ['PRINCIPAL', 'VICE_PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'PERMISSION_MANAGE',
    module: 'account',
    feature: 'permission',
    action: 'MANAGE',
    requires: [],
    description: 'Quản lý phân quyền',
    defaultRoles: ['PRINCIPAL'],
    configurableRoles: [],
  },
];

const CONFIGURABLE_ROLES = ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];
const PRIVILEGED_ROLES = ['PRINCIPAL', 'ADMIN'];

const forbid = (message = 'Bạn không có quyền thực hiện thao tác này') => new ApiError(403, message);
const badRequest = (message, details) => new ApiError(400, message, details);
const now = () => new Date().toISOString();
const sorted = (codes) => [...new Set(codes)].sort();
const byCode = (code) => CATALOG.find((p) => p.code === code);
const isConfigurableFor = (code, role) => !!byCode(code)?.configurableRoles.includes(role);
const configurableCodesOf = (role) => CATALOG.filter((p) => p.configurableRoles.includes(role)).map((p) => p.code);

// Giữ nguyên TEAM_LEADER của luồng hiện tại, không chuyển thành TEACHER.
const rolesOf = (user) => [user.role].filter(Boolean);

/** Thêm mã mà các mã đang có `requires`, chỉ khi mã đó cấu hình được cho role. */
const withRequiredRows = (rows) => {
  const result = [...rows];
  rows.forEach(({ role, code }) =>
    (byCode(code)?.requires || []).forEach((required) => {
      if (isConfigurableFor(required, role) && !result.some((row) => row.role === role && row.code === required))
        result.push({ role, code: required });
    }),
  );
  return result;
};

const ensure = (db) => {
  const seededVersion = Number(db.mockSeedVersions?.['permission-center-demo'] || 0);
  const permissionCenterRoleRows = CATALOG.flatMap((p) =>
    p.defaultRoles.filter((role) => CONFIGURABLE_ROLES.includes(role)).map((role) => ({ role, code: p.code })),
  );
  applyMockSeedMigration(db, 'permission-center-demo', 2, { permissionCenterRoleRows });
  // Bản 2 tách quyền xem: role đang có thao tác sửa giữ quyền xem trước đây đi kèm ngầm
  if (seededVersion === 1 && Array.isArray(db.permissionCenterRoleRows)) {
    db.permissionCenterRoleRows = withRequiredRows(db.permissionCenterRoleRows);
  }
  if (!Array.isArray(db.permissionCenterOverrides)) db.permissionCenterOverrides = [];
  if (!Array.isArray(db.permissionCenterChangeLogs)) db.permissionCenterChangeLogs = [];
  // Ngoại lệ cấp thêm mã sửa từ bản 1 thiếu mã xem ⇒ cấp thêm mã xem, tránh lần lưu sau bị 400 dù HT không đổi gì
  if (seededVersion === 1) {
    db.permissionCenterOverrides
      .filter((o) => o.effect === OVERRIDE_EFFECT.GRANT)
      .forEach((grant) => {
        const target = db.users?.find((u) => u.id === grant.userId);
        if (!target) return;
        const roles = rolesOf(target);
        const effective = resolve(db, roles, target.id);
        (byCode(grant.code)?.requires || [])
          .filter((required) => roles.some((role) => isConfigurableFor(required, role)) && !effective.includes(required))
          .forEach((required) => db.permissionCenterOverrides.push({ ...grant, code: required }));
      });
  }
  return db;
};

const resolve = (db, roles, userId) => {
  const fixed = roles.filter((role) => !CONFIGURABLE_ROLES.includes(role));
  const result = new Set(CATALOG.filter((p) => p.defaultRoles.some((r) => fixed.includes(r))).map((p) => p.code));
  const configured = new Set(
    db.permissionCenterRoleRows.filter((row) => roles.includes(row.role) && isConfigurableFor(row.code, row.role)).map((row) => row.code),
  );
  db.permissionCenterOverrides
    .filter((o) => userId != null && o.userId === userId && roles.some((role) => isConfigurableFor(o.code, role)))
    .forEach((o) => (o.effect === OVERRIDE_EFFECT.GRANT ? configured.add(o.code) : configured.delete(o.code)));
  configured.forEach((code) => result.add(code));
  return sorted([...result]);
};

/** Chỉ tính quyền trong màn demo, không gắn vào user của authMockRepository. */
export const effectivePermissionsOf = (db, user) => resolve(ensure(db), rolesOf(user), user.id);

const roleEntry = (db, role) => ({
  role,
  editable: CONFIGURABLE_ROLES.includes(role),
  configurablePermissions: sorted(configurableCodesOf(role)),
  permissions: resolve(db, [role], null),
});

const overridesView = (db, target) => {
  const roles = rolesOf(target);
  const configurable = sorted(roles.flatMap(configurableCodesOf));
  return {
    userId: target.id,
    roles,
    configurablePermissions: configurable,
    overrides: db.permissionCenterOverrides
      .filter((o) => o.userId === target.id && configurable.includes(o.code))
      .map((o) => ({ permission: o.code, effect: o.effect, reason: o.reason, updatedBy: o.createdBy, updatedAt: o.updatedAt }))
      .sort((a, b) => a.permission.localeCompare(b.permission)),
    effectivePermissions: resolve(db, roles, target.id),
  };
};

const userName = (db, id) => db.users.find((u) => u.id === id)?.fullName;

const requireManager = (user) => {
  if (!canManagePermissions(user)) throw forbid();
  const actor = readDb().users.find((row) => row.id === user.id);
  if (!actor || actor.role !== 'PRINCIPAL' || actor.status === 'INACTIVE') throw forbid();
};

const requireReason = (reason) => {
  const errors = validatePermissionChange({ reason });
  if (errors.reason) throw badRequest(errors.reason, errors);
};

export const permissionMockRepository = {
  async getPermissionStaff(user) {
    await delay(80);
    requireManager(user);
    const db = readDb();
    return clone({
      items: db.users
        .filter((row) => ['VICE_PRINCIPAL', 'TEACHER'].includes(row.role) && row.id !== user.id)
        .map((row) => ({
          userId: row.id,
          fullName: row.fullName,
          role: row.role,
          phone: row.phone || '',
          status: row.status || 'ACTIVE',
          campusName: (db.campuses || []).find((campus) => campus.id === row.campusId)?.name || null,
        })),
    });
  },
  async getPermissionCatalog(user) {
    await delay(80);
    requireManager(user);
    return clone(CATALOG);
  },

  async getRolePermissions(user) {
    await delay(100);
    requireManager(user);
    const db = ensure(readDb());
    return clone(PERMISSION_ROLES.map((role) => roleEntry(db, role)));
  },

  async updateRolePermissions(role, { permissions, reason }, user) {
    await delay();
    requireManager(user);
    if (!CONFIGURABLE_ROLES.includes(role)) throw forbid('Quyền của vai trò này cố định, không sửa được');
    requireReason(reason);
    if (!Array.isArray(permissions) || permissions.some((code) => typeof code !== 'string'))
      throw badRequest('Danh sách quyền không hợp lệ');
    const invalid = permissions.find((code) => !isConfigurableFor(code, role));
    if (invalid) throw badRequest(`Quyền ${invalid} không cấu hình được cho vai trò này`);
    const missing = permissions.flatMap((code) =>
      byCode(code)
        .requires.filter((required) => isConfigurableFor(required, role) && !permissions.includes(required))
        .map((required) => [code, required]),
    )[0];
    if (missing) throw badRequest(`Quyền ${missing[0]} cần bật kèm quyền xem ${missing[1]}`);
    return writeDb((db) => {
      ensure(db);
      const before = new Set(resolve(db, [role], null));
      const after = new Set(permissions);
      const batchId = uid();
      configurableCodesOf(role)
        .filter((code) => before.has(code) !== after.has(code))
        .forEach((code) =>
          db.permissionCenterChangeLogs.unshift({
            id: uid(),
            batchId,
            actorUserId: user.id,
            targetRole: role,
            targetUserId: null,
            permissionCode: code,
            beforeState: before.has(code) ? 'ON' : 'OFF',
            afterState: after.has(code) ? 'ON' : 'OFF',
            reason: reason.trim(),
            changedAt: now(),
          }),
        );
      db.permissionCenterRoleRows = [
        ...db.permissionCenterRoleRows.filter((row) => row.role !== role),
        ...[...after].map((code) => ({ role, code })),
      ];
      return clone(roleEntry(db, role));
    });
  },

  async getAccountsWithOverrides(user) {
    await delay(80);
    requireManager(user);
    const db = ensure(readDb());
    const userIds = [...new Set(db.permissionCenterOverrides.map((o) => o.userId))];
    const results = userIds
      .map((id) => db.users.find((u) => u.id === id))
      .filter(Boolean)
      .map((target) => {
        const view = overridesView(db, target);
        return {
          ...view,
          fullName: target.fullName,
          phone: target.phone,
          status: target.status,
          role: target.role,
          campusName: (db.campuses || []).find((campus) => campus.id === target.campusId)?.name || null,
        };
      })
      .filter((item) => item.overrides.length > 0);
    return clone(results);
  },

  async getPermissionOverrides(userId, user) {
    await delay(100);
    requireManager(user);
    const db = ensure(readDb());
    const target = db.users.find((u) => u.id === userId);
    if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản');
    return clone(overridesView(db, target));
  },

  async updatePermissionOverrides(userId, { overrides, reason }, user) {
    await delay();
    requireManager(user);
    if (userId === user.id) throw badRequest('Không thể tự thay đổi quyền của chính mình');
    requireReason(reason);
    return writeDb((db) => {
      ensure(db);
      const target = db.users.find((u) => u.id === userId);
      if (!target) throw new ApiError(404, 'Không tìm thấy tài khoản');
      const roles = rolesOf(target);
      if (roles.some((role) => PRIVILEGED_ROLES.includes(role)) || !roles.some((role) => CONFIGURABLE_ROLES.includes(role)))
        throw forbid('Không tạo ngoại lệ quyền cho tài khoản này');
      if (!Array.isArray(overrides)) throw badRequest('Danh sách ngoại lệ không hợp lệ');
      const requested = new Map();
      overrides.forEach((item) => {
        const { permission, effect } = item || {};
        if (![OVERRIDE_EFFECT.GRANT, OVERRIDE_EFFECT.REVOKE].includes(effect)) throw badRequest('Trạng thái ngoại lệ không hợp lệ');
        if (requested.has(permission)) throw badRequest(`Quyền ${permission} bị lặp`);
        if (!roles.some((role) => isConfigurableFor(permission, role)))
          throw badRequest(`Quyền ${permission} không áp dụng cho tài khoản này`);
        requested.set(permission, effect);
      });

      const current = new Map(db.permissionCenterOverrides.filter((o) => o.userId === userId).map((o) => [o.code, o.effect]));
      const batchId = uid();
      new Set([...current.keys(), ...requested.keys()]).forEach((code) => {
        const before = current.get(code) || OVERRIDE_EFFECT.INHERIT;
        const after = requested.get(code) || OVERRIDE_EFFECT.INHERIT;
        if (before === after) return;
        db.permissionCenterChangeLogs.unshift({
          id: uid(),
          batchId,
          actorUserId: user.id,
          targetRole: null,
          targetUserId: userId,
          permissionCode: code,
          beforeState: before,
          afterState: after,
          reason: reason.trim(),
          changedAt: now(),
        });
      });
      db.permissionCenterOverrides = [
        ...db.permissionCenterOverrides.filter((o) => o.userId !== userId),
        ...[...requested].map(([code, effect]) => ({
          userId,
          code,
          effect,
          reason: reason.trim(),
          createdBy: user.id,
          updatedAt: now(),
        })),
      ];
      // Quyền hiệu lực sau ngoại lệ phải đủ mã `requires` (vd. thu hồi Xem khi còn Sửa) ⇒ 400, writeDb rollback
      const effective = resolve(db, roles, userId);
      const missing = effective.flatMap((code) =>
        (byCode(code)?.requires || [])
          .filter((required) => roles.some((role) => isConfigurableFor(required, role)) && !effective.includes(required))
          .map((required) => [code, required]),
      )[0];
      if (missing) throw badRequest(`Quyền ${missing[0]} cần kèm quyền xem ${missing[1]}`);
      return clone(overridesView(db, target));
    });
  },

  async getPermissionChangeLogs({ targetRole, targetUserId, page = 0, size = 20 } = {}, user) {
    await delay(100);
    requireManager(user);
    if (targetRole && targetUserId) throw badRequest('Chỉ lọc theo vai trò hoặc theo tài khoản');
    if (!Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 100)
      throw badRequest('Phân trang không hợp lệ');
    const db = ensure(readDb());
    const all = db.permissionCenterChangeLogs.filter(
      (log) => (!targetRole || log.targetRole === targetRole) && (!targetUserId || log.targetUserId === targetUserId),
    );
    const items = all.slice(page * size, (page + 1) * size).map((log) => ({
      ...log,
      actorName: userName(db, log.actorUserId),
      targetUserName: log.targetUserId ? userName(db, log.targetUserId) : null,
    }));
    return clone({ items, page, size, totalElements: all.length, totalPages: Math.max(1, Math.ceil(all.length / size)) });
  },
};
