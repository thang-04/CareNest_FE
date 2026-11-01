import { ROLES } from '@/models/User';
import { ROUND_STATUS, SHEET_STATUS } from '@/models/inventory-inspection/inspectionConstants';
import { areaAllows } from '@/utils/school-config/schoolConfigPermissions';

export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;

// Mảng CSVC của Phó hiệu trưởng: Được sửa mới tạo / duyệt đợt kiểm kê; Chỉ xem chỉ đọc
const vpEdits = (user) => isVicePrincipal(user) && areaAllows(user, 'facility', user.campusId, true);
export const canManageRounds = vpEdits;

export const canEditRound = (round, user) => vpEdits(user) && round?.status === ROUND_STATUS.DRAFT;

export const canCancelRound = (round, user) =>
  vpEdits(user) && [ROUND_STATUS.DRAFT, ROUND_STATUS.IN_PROGRESS, ROUND_STATUS.PENDING_APPROVAL].includes(round?.status);

export const isMySheet = (sheet, user) => sheet?.inspectorUserId === user?.id;

/** Inspector can count while the sheet is open (not submitted / approved). */
export const canCountSheet = (round, sheet, user) =>
  round?.status === ROUND_STATUS.IN_PROGRESS &&
  isMySheet(sheet, user) &&
  [SHEET_STATUS.ASSIGNED, SHEET_STATUS.IN_PROGRESS, SHEET_STATUS.RECOUNT_REQUESTED].includes(sheet.status);

export const canReviewSheet = (round, sheet, user) =>
  vpEdits(user) && round?.status === ROUND_STATUS.IN_PROGRESS && sheet?.status === SHEET_STATUS.SUBMITTED;

export const canApproveRound = (round, user) => vpEdits(user) && round?.status === ROUND_STATUS.PENDING_APPROVAL;

export const canViewRound = (round, user) =>
  (isVicePrincipal(user) && areaAllows(user, 'facility', user.campusId)) ||
  (round?.status !== ROUND_STATUS.DRAFT && (round?.sheets || []).some((s) => isMySheet(s, user)));
