import { ROLES } from '@/models/User';
import { ROUND_STATUS, SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';

export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;

export const canManageRounds = isVicePrincipal;

export const canEditRound = (round, user) => isVicePrincipal(user) && round?.status === ROUND_STATUS.DRAFT;

export const canCancelRound = (round, user) =>
  isVicePrincipal(user) && [ROUND_STATUS.DRAFT, ROUND_STATUS.IN_PROGRESS, ROUND_STATUS.PENDING_APPROVAL].includes(round?.status);

export const isMySheet = (sheet, user) => sheet?.inspectorUserId === user?.id;

/** Inspector can count while the sheet is open (not submitted / approved). */
export const canCountSheet = (round, sheet, user) =>
  round?.status === ROUND_STATUS.IN_PROGRESS &&
  isMySheet(sheet, user) &&
  [SHEET_STATUS.ASSIGNED, SHEET_STATUS.IN_PROGRESS, SHEET_STATUS.RECOUNT_REQUESTED].includes(sheet.status);

export const canReviewSheet = (round, sheet, user) =>
  isVicePrincipal(user) && round?.status === ROUND_STATUS.IN_PROGRESS && sheet?.status === SHEET_STATUS.SUBMITTED;

export const canApproveRound = (round, user) => isVicePrincipal(user) && round?.status === ROUND_STATUS.PENDING_APPROVAL;

export const canViewRound = (round, user) =>
  isVicePrincipal(user) || (round?.status !== ROUND_STATUS.DRAFT && (round?.sheets || []).some((s) => isMySheet(s, user)));
