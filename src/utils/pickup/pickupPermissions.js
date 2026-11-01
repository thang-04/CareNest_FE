import { ROLES } from '@/models/User';

/*
 * SRS 4.4 Permission Matrix, "Child pickup – Hand over / Record result":
 * Teacher, and Team Leader acting as a teacher, for the children of the assigned class only (²).
 * Principal, Vice Principal and Kitchen Staff: No.
 */
export const canHandOverChildren = (cls, user) =>
  !!cls && [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role) && (cls.teacherIds || []).includes(user.id);

export const canOpenPickup = (user) => [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role);
