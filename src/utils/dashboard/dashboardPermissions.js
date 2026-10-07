import { ROLES } from '@/models/User';

/*
 * SRS 4.4 Permission Matrix rows of this module:
 *  - School-wide dashboard / View: Principal only (Full). Other roles get the dashboard of their own role
 *    (screens #11–#14) whose widgets stay inside each module's scope (¹ campus, ² class, ³ age group, ⁵ kitchen).
 *  - Pending approval requests / View: Principal (Full), Vice Principal (¹ own campus), Team Leader (³ own age group);
 *    Teacher and Kitchen Staff: No.
 * Each row of the approvals list is additionally filtered by the owning module's canDecide…/canReview… helper.
 */

export const APPROVAL_ROLES = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEADER];

export const canViewSchoolDashboard = (user) => user?.role === ROLES.PRINCIPAL;

export const canViewPendingApprovals = (user) => APPROVAL_ROLES.includes(user?.role);

/** Roles per route, for the lead to register in AppRoutes. */
export const DASHBOARD_ROUTE_ROLES = {
  approvals: APPROVAL_ROLES,
};
