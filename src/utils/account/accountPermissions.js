import { ROLES } from '@/models/User';
import { EDITABLE_PROFILE_FIELDS } from '@/models/account/accountConstants';

/* SRS 4.4 Permission Matrix: "Own profile & password – View / Change" is Full for every web role; nobody sees another user's. */
const ACCOUNT_ROLES = Object.values(ROLES);

export const canManageOwnAccount = (user) => !!user && ACCOUNT_ROLES.includes(user.role);

export const canViewProfile = (profile, user) => canManageOwnAccount(user) && !!profile && profile.id === user.id;

export const canEditProfileField = (field, user) => canManageOwnAccount(user) && EDITABLE_PROFILE_FIELDS.includes(field);

/** A notification is visible only to its recipient (SRS 1.4 step 6). */
export const canViewNotification = (notification, user) => !!user && !!notification && notification.userId === user.id;
