import { ROLES, isStaffRole } from '@/models/User';
import { TRANSFER_STATUS, MY_TRANSFER_ROLES, SIGNATURE_TYPES } from '@/models/facility-transfer/transferConstants';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';

/** Single source of truth for "who can do what". Mirrors server rules. */

export const isVicePrincipal = (user) => user?.role === ROLES.VICE_PRINCIPAL;

export const canCreateTransfer = (user) => isVicePrincipal(user) && !!user.campusId;

// GBR-FAC-06: a VP acts on transfers sent from their own campus; the receiving campus VP may only view.
export const isSendingCampusVp = (transfer, user) => isVicePrincipal(user) && !!transfer && transfer.fromCampusId === user.campusId;
export const isCampusVp = (transfer, user) =>
  isVicePrincipal(user) && !!transfer && [transfer.fromCampusId, transfer.toCampusId].includes(user.campusId);

export const getMyTransferRole = (transfer, user) => {
  if (!transfer || !user) return null;
  if (transfer.handoverUserId === user.id) return MY_TRANSFER_ROLES.HANDOVER;
  if (transfer.receiverUserId === user.id) return MY_TRANSFER_ROLES.RECEIVER;
  return null;
};

export const canViewTransfer = (transfer, user) =>
  (isCampusVp(transfer, user) && (transfer.status !== TRANSFER_STATUS.DRAFT || transfer.createdBy === user.id)) ||
  (isStaffRole(user?.role) && getMyTransferRole(transfer, user) != null && transfer.status !== TRANSFER_STATUS.DRAFT);

export const canEditTransfer = (transfer, user) =>
  isSendingCampusVp(transfer, user) && [TRANSFER_STATUS.DRAFT, TRANSFER_STATUS.REVISION_REQUESTED].includes(transfer?.status);

export const canCancelTransfer = (transfer, user) =>
  isSendingCampusVp(transfer, user) &&
  [TRANSFER_STATUS.DRAFT, TRANSFER_STATUS.PENDING_HANDOVER, TRANSFER_STATUS.REVISION_REQUESTED].includes(transfer?.status);

export const canHandover = (transfer, user) =>
  transfer?.status === TRANSFER_STATUS.PENDING_HANDOVER && transfer.handoverUserId === user?.id;

// While only missing units are being delivered, the document itself can no longer be revised.
export const canRequestRevision = (transfer, user) => canHandover(transfer, user) && !isSupplementMode(transfer);

export const canReceive = (transfer, user) =>
  transfer?.status === TRANSFER_STATUS.PENDING_RECEIPT &&
  transfer.receiverUserId === user?.id &&
  !!getValidSignature(transfer, SIGNATURE_TYPES.HANDOVER);

export const canResolveDiscrepancy = (transfer, user) =>
  isSendingCampusVp(transfer, user) && transfer?.status === TRANSFER_STATUS.PENDING_RESOLUTION;

export const isLocked = (transfer) => [TRANSFER_STATUS.COMPLETED, TRANSFER_STATUS.CANCELLED].includes(transfer?.status);

/** Page a staff member should open for a transfer (handover or receive view). */
export const staffTransferPath = (transfer, user) =>
  getMyTransferRole(transfer, user) === MY_TRANSFER_ROLES.HANDOVER
    ? `/facility/transfers/${transfer.id}/handover`
    : `/facility/transfers/${transfer.id}/receive`;

export const getOpenDiscrepancy = (transfer) => (transfer?.discrepancies || []).find((d) => d.status === 'OPEN') || null;

/** Back to "Chờ bàn giao" only for the VP's follow-up: deliver missing / replacement units or take back surplus units. */
export const isSupplementMode = (transfer) =>
  transfer?.status === TRANSFER_STATUS.PENDING_HANDOVER &&
  (transfer.items || []).some((i) => i.supplementRequired > 0 || i.returnRequired > 0);
