import { ROLES } from '@/models/User';
import { EDITABLE_PROFILE_FIELDS } from '@/models/account/accountConstants';
import { PERMISSIONS } from '@/models/account/permissionConstants';

/* SRS 4.4 Permission Matrix: "Own profile & password – View / Change" is Full for every web role; nobody sees another user's. */
const ACCOUNT_ROLES = Object.values(ROLES);

export const canManageOwnAccount = (user) => !!user && ACCOUNT_ROLES.includes(user.role);

export const canViewProfile = (profile, user) => canManageOwnAccount(user) && !!profile && profile.id === user.id;

export const canEditProfileField = (field, user) => canManageOwnAccount(user) && EDITABLE_PROFILE_FIELDS.includes(field);

/** A notification is visible only to its recipient (SRS 1.4 step 6). */
export const canViewNotification = (notification, user) => !!user && !!notification && notification.userId === user.id;

/**
 * Mã quyền BE (`/accounts/me` → user.bePermissions, ADR-0017) để ẩn/hiện menu, route; BE vẫn kiểm tra mọi thao tác.
 * Chế độ mock không có dữ liệu quyền BE ⇒ không lọc thêm (giữ theo vai trò).
 */
export const hasBePermission = (user, ...codes) =>
  !!user && (!Array.isArray(user.bePermissions) || codes.some((code) => user.bePermissions.includes(code)));

/** AUTH-18: Hiệu trưởng (mọi trẻ) và Phó hiệu trưởng (cơ sở mình) cấp tài khoản phụ huynh khi có quyền PARENT_ACCOUNT_MANAGE. */
export const canManageParentAccounts = (user) =>
  [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(user?.role) && hasBePermission(user, PERMISSIONS.PARENT_ACCOUNT_MANAGE);
