import { ROLES } from '@/models/User';
import { ISSUE_STATUS, REQUEST_STATUS, PROPOSAL_STATUS, ACTIVE_PROPOSAL_STATUSES } from '@/models/facility/facilityConstants';
import { areaAccess, areaAllows } from '@/utils/school-config/schoolConfigPermissions';

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
// Phó hiệu trưởng theo mảng CSVC của mình: Không có = không quản lý; Chỉ xem = xem; Được sửa = duyệt / tạo (trong phạm vi)
const vpSees = (user, campusId) => isVicePrincipal(user) && areaAllows(user, 'facility', campusId);
const vpEdits = (user, campusId) => isVicePrincipal(user) && areaAllows(user, 'facility', campusId, true);
export const isManager = (user) => isPrincipal(user) || (isVicePrincipal(user) && areaAccess(user, 'facility').access !== 'NONE');

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
  if (isVicePrincipal(user)) return locations.filter((l) => vpSees(user, l.campusId)).map((l) => l.id);
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

export const canViewIssue = (issue, user) => isPrincipal(user) || vpSees(user, issue?.campusId) || isIssueReporter(issue, user);

export const canDecideIssue = (issue, user) => vpEdits(user, issue?.campusId) && issue?.status === ISSUE_STATUS.SUBMITTED;

/* ---------- Additional facility requests ---------- */

export const canCreateRequest = (user) => isReporter(user);

export const canViewRequestList = (user) => isManager(user);

export const canViewRequest = (req, user) => isPrincipal(user) || vpSees(user, req?.campusId) || req?.requesterId === user?.id;

/** VP decides within authority, or forwards to the Principal (GBR-FAC-08 / UC 7.3 step 12). */
export const canReviewRequest = (req, user) => vpEdits(user, req?.campusId) && req?.status === REQUEST_STATUS.SUBMITTED;

export const canPrincipalDecideRequest = (req, user) => isPrincipal(user) && req?.status === REQUEST_STATUS.PENDING_PRINCIPAL;

/* ---------- Proposals ---------- */

export const canCreateProposal = (user) => vpEdits(user, user?.campusId);

export const canViewProposalList = (user) => isManager(user);

/** Drafts stay private to their Vice Principal; the Principal sees sent proposals of both campuses. */
export const canViewProposal = (p, user) => vpSees(user, p?.campusId) || (isPrincipal(user) && p?.status !== PROPOSAL_STATUS.DRAFT);

export const canEditProposal = (p, user) => vpEdits(user, p?.campusId) && p?.createdBy === user.id && p?.status === PROPOSAL_STATUS.DRAFT;

export const canCancelProposal = (p, user) =>
  vpEdits(user, p?.campusId) && p?.createdBy === user.id && [PROPOSAL_STATUS.DRAFT, PROPOSAL_STATUS.SUBMITTED].includes(p?.status);

export const canDecideProposal = (p, user) => isPrincipal(user) && p?.status === PROPOSAL_STATUS.SUBMITTED;

/** Whether a proposal still holds its sources (a source joins at most one active proposal). */
export const holdsSources = (proposal) => ACTIVE_PROPOSAL_STATUSES.includes(proposal?.status);

/**
 * An approved issue, or a request approved by the VP, of the VP's campus that no active proposal holds yet.
 * Requests decided by the Principal already carry the Principal's decision, so they need no proposal.
 * `proposalOf(id)` returns the proposal currently linked to the source (or undefined).
 */
export const canAddToProposal = (source, user, proposalOf = () => undefined) => {
  if (!vpEdits(user, source?.campusId) || source?.campusId !== user.campusId || source?.status !== 'APPROVED') return false;
  if (source.decidedByRole && source.decidedByRole !== ROLES.VICE_PRINCIPAL) return false;
  return !holdsSources(proposalOf(source.proposalId));
};
