import { ROLES } from '@/models/User';
import { EVAL_STATUS, REWARD_STATUS } from '@/models/assessment/assessmentConstants';

/*
 * SRS 4.4 Permission Matrix rows used by this module:
 *  - Daily assessment (record), Daily activities & assessments (view), Evaluation review & confirm,
 *    Child development profile (view), Reward proposal (create): Teacher / Team Leader acting as a teacher,
 *    own class only (footnote 2). Principal, Vice Principal, Kitchen: No.
 *  - Reward proposal review / return: Vice Principal, own campus (footnote 1).
 *  - Reward proposal approve / reject: Principal.
 *  - Year-end reward result view: Principal (all), Vice Principal (campus), Teacher / Team Leader (class).
 *  - UC 4.1 View Child Development Progress: Principal, Vice Principal (published records only).
 *  - Confirmed weekly / monthly / year-end evaluations are visible to the Vice Principal and Principal (GBR-OBS-04, UC 4.6).
 * Used by the UI (hide actions) and re-checked by the mock repository (403).
 */

export const CLASS_ROLES = [ROLES.TEACHER, ROLES.TEAM_LEADER];
export const LEADER_ROLES = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL];

/** Allowed roles per route (the lead registers them with RoleGuard). */
export const ASSESSMENT_ROUTE_ROLES = {
  daily: CLASS_ROLES,
  childList: [...CLASS_ROLES, ...LEADER_ROLES],
  profile: CLASS_ROLES,
  progress: LEADER_ROLES,
  evaluations: [...CLASS_ROLES, ...LEADER_ROLES],
  aiDraft: CLASS_ROLES,
  tickets: CLASS_ROLES,
  rewards: [...CLASS_ROLES, ...LEADER_ROLES],
  rewardForm: CLASS_ROLES,
};

const has = (user, roles) => !!user && roles.includes(user.role);

/** Footnote 2: a team leader acts as a teacher only for classes they teach, not their whole age group. */
export const isClassTeacher = (cls, user) => !!cls && has(user, CLASS_ROLES) && (cls.teacherIds || []).includes(user.id);

export const isLeader = (user) => has(user, LEADER_ROLES);
export const isPrincipal = (user) => user?.role === ROLES.PRINCIPAL;
export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;

/** Leader scope: Principal whole school, Vice Principal own campus. */
export const inLeaderScope = (campusId, user) => isPrincipal(user) || (isVicePrincipal(user) && user.campusId === campusId);

/* ---------- Daily assessment / profile ---------- */
export const canRecordDailyAssessment = (cls, user) => isClassTeacher(cls, user);
export const canViewDevelopmentProfile = (cls, user) => isClassTeacher(cls, user);
export const canViewDevelopmentProgress = (child, user) => !!child && inLeaderScope(child.campusId, user);

/* ---------- Evaluations ---------- */
export const canReviewEvaluation = (ev, cls, user) => !!ev && ev.status !== EVAL_STATUS.CONFIRMED && isClassTeacher(cls, user);

export const canViewEvaluation = (ev, cls, user) =>
  !!ev && (isClassTeacher(cls, user) || (ev.status === EVAL_STATUS.CONFIRMED && inLeaderScope(ev.campusId, user)));

/** AI drafts are working material of the class teacher only (never parents or leaders before confirmation). */
export const canViewAiDraft = (ev, cls, user) => !!ev && isClassTeacher(cls, user);

/* ---------- Good behaviour tickets ---------- */
export const canIssueTickets = (cls, user) => isClassTeacher(cls, user);

/* ---------- Year-end reward proposals ---------- */
export const canCreateRewardProposal = (user) => has(user, CLASS_ROLES);

export const canEditRewardProposal = (p, user) =>
  !!p && p.createdBy === user?.id && [REWARD_STATUS.DRAFT, REWARD_STATUS.RETURNED].includes(p.status);

export const canDeleteRewardProposal = (p, user) => !!p && p.createdBy === user?.id && p.status === REWARD_STATUS.DRAFT;

export const canReviewRewardProposal = (p, user) =>
  !!p && isVicePrincipal(user) && user.campusId === p.campusId && p.status === REWARD_STATUS.PENDING_VP;

export const canDecideRewardProposal = (p, user) => !!p && isPrincipal(user) && p.status === REWARD_STATUS.PENDING_PRINCIPAL;

/** Drafts stay private to their author; submitted proposals follow the class / campus / school scope. */
export const canViewRewardProposal = (p, cls, user) => {
  if (!p || !user) return false;
  if (p.createdBy === user.id) return true;
  if (p.status === REWARD_STATUS.DRAFT) return false;
  return isClassTeacher(cls, user) || inLeaderScope(p.campusId, user);
};
