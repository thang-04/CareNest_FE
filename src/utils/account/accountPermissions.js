import { ROLES } from '@/models/User';
import { EDITABLE_PROFILE_FIELDS } from '@/models/account/accountConstants';
import { PERMISSIONS } from '@/models/account/permissionConstants';
import { hasBePermission } from '@/utils/bePermissions';

/* SRS 4.4 Permission Matrix: "Own profile & password – View / Change" is Full for every web role; nobody sees another user's. */
const ACCOUNT_ROLES = Object.values(ROLES);

export const canManageOwnAccount = (user) => !!user && ACCOUNT_ROLES.includes(user.role);

export const canViewProfile = (profile, user) => canManageOwnAccount(user) && !!profile && profile.id === user.id;

export const canEditProfileField = (field, user) => canManageOwnAccount(user) && EDITABLE_PROFILE_FIELDS.includes(field);

/** A notification is visible only to its recipient (SRS 1.4 step 6). */
export const canViewNotification = (notification, user) => !!user && !!notification && notification.userId === user.id;

export { hasBePermission };

/** AUTH-18: Hiệu trưởng (mọi trẻ) và Phó hiệu trưởng (cơ sở mình) cấp tài khoản phụ huynh khi có quyền PARENT_ACCOUNT_MANAGE. */
export const canManageParentAccounts = (user) =>
  [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(user?.role) && hasBePermission(user, PERMISSIONS.PARENT_ACCOUNT_MANAGE);

/**
 * Tag phụ trách ở hồ sơ tài khoản. Dinh dưỡng = Phó hiệu trưởng được cấp NUTRITION_MANAGE (BE AUTH-20).
 * Chỉ tin `bePermissions` từ BE; mock không có dữ liệu này ⇒ không hiện tag. Giáo dục chưa có mã quyền BE nên chưa có tag.
 */
export const accountDutyTags = (user) =>
  user?.role === ROLES.VICE_PRINCIPAL && Array.isArray(user.bePermissions) && user.bePermissions.includes(PERMISSIONS.NUTRITION_MANAGE)
    ? [{ key: 'nutrition', label: 'Phụ trách dinh dưỡng' }]
    : [];
