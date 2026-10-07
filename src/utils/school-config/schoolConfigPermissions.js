import { ROLES } from '@/models/User';
import { YEAR_STATUS } from '@/models/school-config/schoolConfigConstants';

/*
 * Who may do what in school configuration – SRS 4.4 Permission Matrix + UC 2.1–2.7 (GBR-CFG-01).
 * Used to hide buttons AND re-checked by the mock repository (403). The backend owns the real check.
 */

const is = (user, ...roles) => !!user && roles.includes(user.role);
export const isPrincipal = (user) => is(user, ROLES.PRINCIPAL);
export const isVicePrincipal = (user) => is(user, ROLES.VICE_PRINCIPAL);

/** "School year, age group & class – Configure": Principal only. */
export const canConfigureSchool = isPrincipal;

/** "School year, age group & class – View": Principal full; VP / Teacher / Team leader within their scope. */
export const canViewSchoolStructure = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.TEAM_LEADER);

export const canEditYear = (year, user) => isPrincipal(user) && !!year && year.status !== YEAR_STATUS.CLOSED;
export const canActivateYear = (year, user) => isPrincipal(user) && year?.status === YEAR_STATUS.PLANNED;
export const canCloseYear = (year, user) => isPrincipal(user) && year?.status === YEAR_STATUS.ACTIVE;
/** Only a planned year can be deleted (the repository also checks it has no classes – MSG53). */
export const canDeleteYear = (year, user) => isPrincipal(user) && year?.status === YEAR_STATUS.PLANNED;

/** Classes and age groups of a closed year are history: read only. */
export const canManageClasses = (year, user) => isPrincipal(user) && !!year && year.status !== YEAR_STATUS.CLOSED;
export const canManageAgeGroups = isPrincipal;

/** UC 2.7 / GBR-CFG-03. */
export const canConfigureCutoff = isPrincipal;

/** "Campus – Create / Edit": Principal only. */
export const canManageCampus = isPrincipal;
/** Campus view is not in the matrix: assumed Principal (all) and Vice Principal (own campus). */
export const canViewCampus = (campus, user) => isPrincipal(user) || (isVicePrincipal(user) && campus?.id === user.campusId);
export const canListCampuses = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL);

/** "Permission – Assign to Vice Principal": Principal only. */
export const canAssignVicePrincipal = isPrincipal;

/** "Permission – Assign to Teacher / Team Leader": Vice Principal of that campus only (Principal: No). */
export const canAssignTeachers = (campusId, user) => isVicePrincipal(user) && !!campusId && user.campusId === campusId;

/** UC 2.4 Manage Permission: Principal only. */
export const canManageRolePermissions = isPrincipal;
