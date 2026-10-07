import { ROLES } from '@/models/User';
import { WEEKLY_STATUS } from '@/models/menu-planning/menuPlanningConstants';

/*
 * SRS 4.4 Permission Matrix:
 *  - Meal price, food & dish – Manage: Vice Principal only (Restricted ¹).
 *  - Menu, allergy menu & weekly menu – Manage / AI suggestion: Vice Principal only (Restricted ¹).
 *  - Daily menu nutrition – Balance: Vice Principal only.
 *  - Menu – View: Principal (Full), Vice Principal (¹), Kitchen Staff (⁵, own campus kitchen).
 * GBR-GEN-10: only the Vice Principal holding the shared school-service assignment maintains the
 * school-wide meal configuration and menus. `access.sharedService` comes from the backend.
 */

export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;
export const isPrincipal = (user) => user?.role === ROLES.PRINCIPAL;

/** Read the planning data (foods, dishes, prices, sample and weekly menus). */
export const canViewMenuData = (user) => isVicePrincipal(user);

/** Create / edit / delete foods, dishes, prices, menus; request AI suggestions; balance nutrition. */
export const canManageMenuData = (user, access) => isVicePrincipal(user) && !!access?.sharedService;

/** Principal follows the published weekly menus (UC 6.1, view only). */
export const canViewMenuPlan = (user) => isPrincipal(user);

/** Published menus are read by kitchens and other modules. */
export const canReadPublishedMenu = (user) => [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF].includes(user?.role);

export const canEditWeeklyMenu = (wm, user, access) => canManageMenuData(user, access) && wm?.status === WEEKLY_STATUS.DRAFT;
export const canPublishWeeklyMenu = canEditWeeklyMenu;
export const canDeleteWeeklyMenu = canEditWeeklyMenu;

/** Changes after publication go through a replacement version (UC 6.8, GBR-MENU-05). */
export const canReplaceWeeklyMenu = (wm, user, access) => canManageMenuData(user, access) && wm?.status === WEEKLY_STATUS.PUBLISHED;
