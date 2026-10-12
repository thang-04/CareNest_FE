import { ROLES } from '@/models/User';
import {
  PERMISSION_ACCESS,
  PERMISSION_SCOPE,
  VP_AREAS,
  YEAR_STATUS,
  defaultVpAreas,
  parseGrant,
} from '@/models/school-config/schoolConfigConstants';

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

/** Rooms (PROPOSED, outside SRS): Principal manages; a Vice Principal views the rooms of the assigned campus. */
export const canManageRooms = isPrincipal;
export const canViewRooms = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL);

/** UC 2.7 / GBR-CFG-03. */
export const canConfigureCutoff = isPrincipal;

/** "Campus – Create / Edit": Principal only. */
export const canManageCampus = isPrincipal;
/** Campus view is not in the matrix: assumed Principal (all) and Vice Principal (own campus). */
export const canViewCampus = (campus, user) => isPrincipal(user) || (isVicePrincipal(user) && campus?.id === user.campusId);
export const canListCampuses = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL);

/** "Permission – Assign to Vice Principal": Principal only. */
export const canAssignVicePrincipal = isPrincipal;

/**
 * Level of one permission for the signed-in user. Principal always FULL; a Vice Principal's own area of responsibility
 * (Vice Principal Assignment) wins over the role grant (Role & Permission screen).
 */
export const permissionLevel = (user, code) => {
  if (!user) return 'NONE';
  if (isPrincipal(user)) return 'FULL';
  const area = VP_AREAS.find((a) => a.code === code);
  if (area && user.areas?.[area.key]) return user.areas[area.key];
  return user.permissions?.[code] || 'NONE';
};

/** { access, scope } of a Vice Principal's area (menu, teacherAssignment, facility). Principal: EDIT whole school. */
export const areaAccess = (user, key) => {
  if (isPrincipal(user)) return { access: PERMISSION_ACCESS.EDIT, scope: PERMISSION_SCOPE.ALL };
  if (!isVicePrincipal(user)) return { access: PERMISSION_ACCESS.NONE, scope: PERMISSION_SCOPE.CAMPUS };
  return parseGrant(user.areas?.[key] || defaultVpAreas({ sharedService: user.sharedService }, user.permissions)[key]);
};
/** Area usable on the campus: not NONE and the campus is in scope. */
export const areaAllows = (user, key, campusId, needEdit = false) => {
  const a = areaAccess(user, key);
  if (a.access === PERMISSION_ACCESS.NONE || (needEdit && a.access !== PERMISSION_ACCESS.EDIT)) return false;
  return a.scope === PERMISSION_SCOPE.ALL || !campusId || campusId === user?.campusId;
};

/** { access: NONE | VIEW | EDIT, scope: ALL | CAMPUS } of one permission for the signed-in user. */
export const permissionAccess = (user, code) => parseGrant(permissionLevel(user, code));

const inScope = ({ scope }, campusId, user) => !!campusId && (scope === PERMISSION_SCOPE.ALL || user.campusId === campusId);

/**
 * "Phân công giáo viên / tổ trưởng" follows the Role & Permission screen:
 * NONE = no menu / page; VIEW = see assignments read only; EDIT = assign. Scope ALL = every campus, CAMPUS = own campus.
 */
export const ASSIGN_TEACHER = 'permission.assignTeacher';
export const canOpenTeacherAssignment = (user) => permissionAccess(user, ASSIGN_TEACHER).access !== PERMISSION_ACCESS.NONE;
export const canViewTeacherAssignments = (campusId, user) => {
  const p = permissionAccess(user, ASSIGN_TEACHER);
  return p.access !== PERMISSION_ACCESS.NONE && inScope(p, campusId, user);
};
export const canAssignTeachers = (campusId, user) => {
  const p = permissionAccess(user, ASSIGN_TEACHER);
  return p.access === PERMISSION_ACCESS.EDIT && inScope(p, campusId, user);
};

/** Staff accounts (SRS 4.4 "User account – Create / Edit / Deactivate", footnote 8: Principal, to confirm). */
export const canManageStaff = isPrincipal;

/** UC 2.4 Manage Permission: Principal only. */
export const canManageRolePermissions = isPrincipal;
