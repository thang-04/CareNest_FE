import { readDb, writeDb, clone, delay, ApiError, applyMockSeedMigration } from '@/mocks/mockDatabase';
import { canManagePermissions } from '@/utils/account/permissionManagementPermissions';
import { validatePermissionChange } from '@/utils/account/permissionValidation';
import { OVERRIDE_EFFECT, PERMISSION_ROLES } from '@/models/account/permissionConstants';
import { uid } from '@/utils/id';

/*
 * Fake backend của phân quyền — chép đúng luật BE (ADR-0017, AUTH-10..14):
 * - danh mục quyền và quyền cố định của ADMIN/PRINCIPAL/PARENT nằm trong code, ma trận chỉ cho PHT/GV/bếp;
 * - quyền hiệu lực = phần cố định ∪ (ma trận ∪ GRANT − REVOKE); REVOKE không trừ phần cố định;
 * - PERMISSION_MANAGE không giao được; không ai tự tạo ngoại lệ cho mình;
 * - mọi thay đổi ghi lịch sử (người, trước/sau, lý do bắt buộc).
 */

const CATALOG = [
  {
    code: 'CHILD_PROFILE_VIEW',
    module: 'child',
    description: 'Xem hồ sơ trẻ trong phạm vi',
    defaultRoles: ['PARENT', 'PRINCIPAL', 'TEACHER', 'VICE_PRINCIPAL'],
    configurableRoles: ['TEACHER', 'VICE_PRINCIPAL'],
  },
  {
    code: 'ACCOUNT_MANAGE',
    module: 'account',
    description: 'Cấp tài khoản, cấp lại mật khẩu tạm',
    defaultRoles: ['ADMIN', 'PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'ACCOUNT_STATUS_MANAGE',
    module: 'account',
    description: 'Khóa / mở tài khoản',
    defaultRoles: ['ADMIN', 'PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'STAFF_ASSIGNMENT_MANAGE',
    module: 'staff',
    description: 'Phân công nhân sự (campus, lớp)',
    defaultRoles: ['PRINCIPAL', 'VICE_PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'PARENT_ACCOUNT_MANAGE',
    module: 'child',
    description: 'Cấp, khóa/mở tài khoản phụ huynh và liên kết với trẻ',
    defaultRoles: ['PRINCIPAL', 'VICE_PRINCIPAL'],
    configurableRoles: ['VICE_PRINCIPAL'],
  },
  {
    code: 'PERMISSION_MANAGE',
    module: 'account',
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

// Tài khoản demo chỉ có 1 role; tổ trưởng (chỉ có ở mock) tính như giáo viên vì BE không có role này
const rolesOf = (user) => [user.role === 'TEAM_LEADER' ? 'TEACHER' : user.role].filter(Boolean);

const ensure = (db) => {
  const rolePermissionRows = CATALOG.flatMap((p) =>
    p.defaultRoles.filter((role) => CONFIGURABLE_ROLES.includes(role)).map((role) => ({ role, code: p.code })),
  );
  applyMockSeedMigration(db, 'permission-defaults', 1, { rolePermissionRows });
  if (!Array.isArray(db.permissionOverrides)) db.permissionOverrides = [];
  if (!Array.isArray(db.permissionChangeLogs)) db.permissionChangeLogs = [];
  if (!Array.isArray(db.users)) db.users = [];
  return db;
};

const resolve = (db, roles, userId) => {
  const fixed = roles.filter((role) => !CONFIGURABLE_ROLES.includes(role));
  const result = new Set(CATALOG.filter((p) => p.defaultRoles.some((r) => fixed.includes(r))).map((p) => p.code));
  const configured = new Set(
    db.rolePermissionRows.filter((row) => roles.includes(row.role) && isConfigurableFor(row.code, row.role)).map((row) => row.code),
  );
  db.permissionOverrides
    .filter((o) => userId != null && o.userId === userId && roles.some((role) => isConfigurableFor(o.code, role)))
    .forEach((o) => (o.effect === OVERRIDE_EFFECT.GRANT ? configured.add(o.code) : configured.delete(o.code)));
  configured.forEach((code) => result.add(code));
  return sorted([...result]);
};

/** Quyền hiệu lực của một tài khoản demo — authMockRepository gắn vào user như /accounts/me. */
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
    overrides: db.permissionOverrides
      .filter((o) => o.userId === target.id && configurable.includes(o.code))
      .map((o) => ({ permission: o.code, effect: o.effect, reason: o.reason, updatedBy: o.createdBy, updatedAt: o.updatedAt }))
      .sort((a, b) => a.permission.localeCompare(b.permission)),
    effectivePermissions: resolve(db, roles, target.id),
  };
};

const userName = (db, id) => db.users.find((u) => u.id === id)?.fullName;

const requireManager = (user) => {
  if (!canManagePermissions(user)) throw forbid();
};

const requireReason = (reason) => {
  const errors = validatePermissionChange({ reason });
  if (errors.reason) throw badRequest(errors.reason, errors);
};

export const permissionMockRepository = {
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
    const invalid = permissions.find((code) => !isConfigurableFor(code, role));
    if (invalid) throw badRequest(`Quyền ${invalid} không cấu hình được cho vai trò này`);
    return writeDb((db) => {
      ensure(db);
      const before = new Set(resolve(db, [role], null));
      const after = new Set(permissions);
      const batchId = uid();
      configurableCodesOf(role)
        .filter((code) => before.has(code) !== after.has(code))
        .forEach((code) =>
          db.permissionChangeLogs.unshift({
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
      db.rolePermissionRows = [...db.rolePermissionRows.filter((row) => row.role !== role), ...[...after].map((code) => ({ role, code }))];
      return clone(roleEntry(db, role));
    });
  },

  async getAccountsWithOverrides(user) {
    await delay(80);
    requireManager(user);
    const db = ensure(readDb());
    const userIds = [...new Set(db.permissionOverrides.map((o) => o.userId))];
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
          assignments: target.assignments || [],
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
      const requested = new Map();
      overrides.forEach(({ permission, effect }) => {
        if (requested.has(permission)) throw badRequest(`Quyền ${permission} bị lặp`);
        if (!roles.some((role) => isConfigurableFor(permission, role)))
          throw badRequest(`Quyền ${permission} không áp dụng cho tài khoản này`);
        requested.set(permission, effect);
      });

      const current = new Map(db.permissionOverrides.filter((o) => o.userId === userId).map((o) => [o.code, o.effect]));
      const batchId = uid();
      new Set([...current.keys(), ...requested.keys()]).forEach((code) => {
        const before = current.get(code) || OVERRIDE_EFFECT.INHERIT;
        const after = requested.get(code) || OVERRIDE_EFFECT.INHERIT;
        if (before === after) return;
        db.permissionChangeLogs.unshift({
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
      db.permissionOverrides = [
        ...db.permissionOverrides.filter((o) => o.userId !== userId),
        ...[...requested].map(([code, effect]) => ({
          userId,
          code,
          effect,
          reason: reason.trim(),
          createdBy: user.id,
          updatedAt: now(),
        })),
      ];
      return clone(overridesView(db, target));
    });
  },

  async getPermissionChangeLogs({ targetRole, targetUserId, page = 0, size = 20 } = {}, user) {
    await delay(100);
    requireManager(user);
    if (targetRole && targetUserId) throw badRequest('Chỉ lọc theo vai trò hoặc theo tài khoản');
    const db = ensure(readDb());
    const all = db.permissionChangeLogs.filter(
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
