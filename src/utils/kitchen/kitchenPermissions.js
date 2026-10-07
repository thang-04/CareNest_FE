import { ROLES } from '@/models/User';
import { ISSUE_STATUS, MISSING_STATUS } from '@/models/kitchen/kitchenConstants';

/*
 * Rights follow SRS 4.4 Permission Matrix (footnotes ¹ VP own campus, ⁵ Kitchen Staff own campus kitchen)
 * and the actors of UC 6.23–6.25, which the matrix does not list.
 * Used by the UI to hide actions and re-checked by the mock repository (403).
 */
const is = (user, ...roles) => !!user && roles.includes(user.role);

export const isKitchenStaff = (user) => is(user, ROLES.KITCHEN_STAFF);
export const isVicePrincipal = (user) => is(user, ROLES.VICE_PRINCIPAL);
export const isPrincipal = (user) => is(user, ROLES.PRINCIPAL);

/** Principal sees every campus; everybody else only the assigned campus. */
export const canAccessCampus = (user, campusId) => !!user && (isPrincipal(user) || user.campusId === campusId);

// Matrix rows "Menu – View" and "Meal count by class – View": Principal Full, VP ¹, Kitchen ⁵.
export const canViewPublishedMenu = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);
export const canViewMealCount = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);

// "Required food quantity – View": VP ¹, Kitchen ⁵.
export const canViewRequiredQuantity = (user) => is(user, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);

// "Meal preparation status": Update Kitchen ⁵ only; View VP ¹ and Kitchen ⁵.
export const canUpdatePreparation = (user) => isKitchenStaff(user);
export const canViewPreparation = (user) => is(user, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);

// "Missing food report – Submit": Kitchen ⁵ only. The campus VP receives and supplies it (UC 6.19, screen #97).
export const canSubmitMissingFood = (user) => isKitchenStaff(user);
export const canViewMissingFood = (user) => is(user, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);
export const canSupplyMissingFood = (report, user) =>
  isVicePrincipal(user) && report?.status === MISSING_STATUS.SUBMITTED && canAccessCampus(user, report.campusId);

// UC 6.23 / 6.24: the campus Vice Principal records receipts and approves the issue slip.
export const canManageStock = (user) => isVicePrincipal(user);
export const canApproveStockIssue = (issue, user) =>
  isVicePrincipal(user) && issue?.status === ISSUE_STATUS.PENDING_APPROVAL && canAccessCampus(user, issue.campusId);

// UC 6.25: the campus Kitchen Staff confirm the ingredients received; the VP sees the reconciliation.
export const canViewIngredientReceipt = (user) => is(user, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);
export const canConfirmIngredientReceipt = (issue, user) =>
  isKitchenStaff(user) && issue?.status === ISSUE_STATUS.APPROVED && canAccessCampus(user, issue.campusId);

/** Roles per route, for the lead to register in AppRoutes. */
export const KITCHEN_ROUTE_ROLES = {
  stockReceipts: [ROLES.VICE_PRINCIPAL],
  stockIssues: [ROLES.VICE_PRINCIPAL],
  preparation: [ROLES.VICE_PRINCIPAL],
  publishedMenu: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  mealCount: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  requiredQuantity: [ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  ingredientReceipts: [ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  missingFood: [ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  preparationUpdate: [ROLES.KITCHEN_STAFF],
};
