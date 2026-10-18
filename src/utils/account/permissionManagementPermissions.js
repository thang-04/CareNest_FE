import { PERMISSIONS } from '@/models/account/permissionConstants';

/** Quyền hiệu lực BE trả trong /accounts/me (mock: tính trong permissionMockRepository). */
export const hasPermission = (user, code) => !!user && (user.permissions || []).includes(code);

/** Chỉ Hiệu trưởng có PERMISSION_MANAGE và quyền này không giao được (BE AUTH-11). */
export const canManagePermissions = (user) => hasPermission(user, PERMISSIONS.PERMISSION_MANAGE);
