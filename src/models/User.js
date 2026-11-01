/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} fullName
 * @property {'PRINCIPAL'|'VICE_PRINCIPAL'|'TEAM_LEADER'|'TEACHER'|'KITCHEN_STAFF'} role
 * @property {string} email
 * @property {string} phone
 * @property {string} campusId
 * @property {string[]} locationIds  locations this user is responsible for
 * @property {string} [avatarColor]
 * @property {string} [ageGroupId]  age group the user plans lessons for (education-plan)
 * @property {string} [classId]     class the user teaches (education-plan)
 */

export const ROLES = {
  PRINCIPAL: 'PRINCIPAL',
  VICE_PRINCIPAL: 'VICE_PRINCIPAL',
  TEAM_LEADER: 'TEAM_LEADER',
  TEACHER: 'TEACHER',
  KITCHEN_STAFF: 'KITCHEN_STAFF',
};

export const ROLE_LABELS = {
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó hiệu trưởng',
  TEAM_LEADER: 'Tổ trưởng nhóm tuổi',
  TEACHER: 'Giáo viên',
  KITCHEN_STAFF: 'Nhân viên bếp',
};

/** Roles that only process transfers assigned to them. */
export const STAFF_ROLES = [ROLES.TEAM_LEADER, ROLES.TEACHER, ROLES.KITCHEN_STAFF];

export const isStaffRole = (role) => STAFF_ROLES.includes(role);
