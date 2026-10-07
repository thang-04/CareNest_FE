import { ROLES } from '@/models/User';
import { ISSUE_STATUS, REQUEST_STATUS, PROPOSAL_STATUS, ACTIVE_PROPOSAL_STATUSES } from '@/models/facility/facilityConstants';

/*
 * Who may do what in the facility module (SRS 4.4 Permission Matrix + UC 7.2–7.4).
 * Used by the UI to hide actions AND by the mock repository to answer 403.
 *  - Facility issue report / Submit: Teacher, Team Leader (own class ²), Kitchen Staff (own kitchen ⁵).
 *  - Facility issue report / Approve-Reject: Vice Principal of the item's campus ¹.
 *  - Facility issue / View: Principal (whole school), Vice Principal (own campus). Reporters see their own reports (UC 7.2 postcondition).
 *  - Facility proposal / Create: Vice Principal ¹. Approve-Reject: Principal.
 *  - Additional facility request (UC 7.3): staff submit, VP reviews or forwards, Principal decides forwarded ones.
 */

export const isPrincipal = (user) => user?.role === ROLES.PRINCIPAL;
export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;
export const isManager = (user) => isPrincipal(user) || isVicePrincipal(user);

/** Roles that report issues and request items for their own class / room / kitchen. */
export const REPORTER_ROLES = [ROLES.TEACHER, ROLES.TEAM_LEADER, ROLES.KITCHEN_STAFF];
export const isReporter = (user) => REPORTER_ROLES.includes(user?.role);

/**
 * Locations whose facility list the user may see (GBR-FAC-01, GBR-FAC-03).
 * Teacher / Team Leader: rooms of their classes + rooms they are responsible for.
 * Kitchen Staff: only the kitchen of their campus (footnote ⁵).
 * `null` means "every location" (Principal).
 */
export const facilityLocationIds = (user, { locations = [], classes = [] } = {}) => {
  if (!user) return [];
  if (isPrincipal(user)) return null;
  if (isVicePrincipal(user)) return locations.filter((l) => l.campusId === user.campusId).map((l) => l.id);
  if (user.role === ROLES.KITCHEN_STAFF)
    return locations.filter((l) => l.type === 'KITCHEN' && l.campusId === user.campusId).map((l) => l.id);
  const ids = new Set(user.locationIds || []);
  classes
    .filter((c) => c.locationId && (c.homeroomTeacherId === user.id || (c.teacherIds || []).includes(user.id)))
    .forEach((c) => ids.add(c.locationId));
  locations.filter((l) => l.managerUserId === user.id && l.type !== 'KITCHEN').forEach((l) => ids.add(l.id));
  return [...ids];
};

export const inScope = (scopeIds, locationId) => scopeIds === null || scopeIds.includes(locationId);

/* ---------- Issues ---------- */

export const canReportIssue = (user) => isReporter(user);

export const canViewIssueList = (user) => isManager(user);

const isIssueReporter = (issue, user) => issue?.reporterId === user?.id || (issue?.linkedReports || []).some((r) => r.userId === user?.id);

export const canViewIssue = (issue, user) =>
  isPrincipal(user) || (isVicePrincipal(user) && issue?.campusId === user.campusId) || isIssueReporter(issue, user);

export const canDecideIssue = (issue, user) =>
  isVicePrincipal(user) && issue?.campusId === user.campusId && issue?.status === ISSUE_STATUS.SUBMITTED;

/* ---------- Additional facility requests ---------- */

export const canCreateRequest = (user) => isReporter(user);

export const canViewRequestList = (user) => isManager(user);

export const canViewRequest = (req, user) =>
  isPrincipal(user) || (isVicePrincipal(user) && req?.campusId === user.campusId) || req?.requesterId === user?.id;

/** VP decides within authority, or forwards to the Principal (GBR-FAC-08 / UC 7.3 step 12). */
export const canReviewRequest = (req, user) =>
  isVicePrincipal(user) && req?.campusId === user.campusId && req?.status === REQUEST_STATUS.SUBMITTED;

export const canPrincipalDecideRequest = (req, user) => isPrincipal(user) && req?.status === REQUEST_STATUS.PENDING_PRINCIPAL;

/* ---------- Proposals ---------- */

export const canCreateProposal = (user) => isVicePrincipal(user);

export const canViewProposalList = (user) => isManager(user);

/** Drafts stay private to their Vice Principal; the Principal sees sent proposals of both campuses. */
export const canViewProposal = (p, user) =>
  (isVicePrincipal(user) && p?.campusId === user.campusId) || (isPrincipal(user) && p?.status !== PROPOSAL_STATUS.DRAFT);

export const canEditProposal = (p, user) => isVicePrincipal(user) && p?.createdBy === user.id && p?.status === PROPOSAL_STATUS.DRAFT;

export const canCancelProposal = (p, user) =>
  isVicePrincipal(user) && p?.createdBy === user.id && [PROPOSAL_STATUS.DRAFT, PROPOSAL_STATUS.SUBMITTED].includes(p?.status);

export const canDecideProposal = (p, user) => isPrincipal(user) && p?.status === PROPOSAL_STATUS.SUBMITTED;

/** Whether a proposal still holds its sources (a source joins at most one active proposal). */
export const holdsSources = (proposal) => ACTIVE_PROPOSAL_STATUSES.includes(proposal?.status);

/**
 * An approved issue, or a request approved by the VP, of the VP's campus that no active proposal holds yet.
 * Requests decided by the Principal already carry the Principal's decision, so they need no proposal.
 * `proposalOf(id)` returns the proposal currently linked to the source (or undefined).
 */
export const canAddToProposal = (source, user, proposalOf = () => undefined) => {
  if (!isVicePrincipal(user) || source?.campusId !== user.campusId || source?.status !== 'APPROVED') return false;
  if (source.decidedByRole && source.decidedByRole !== ROLES.VICE_PRINCIPAL) return false;
  return !holdsSources(proposalOf(source.proposalId));
};
