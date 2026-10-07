import { TRANSFER_STATUS, TRANSFER_TYPES } from '@/models/facility-transfer/transferConstants';

/**
 * @typedef {Object} TransferAttachment
 * @property {string} id
 * @property {string} name
 * @property {number} size
 * @property {string} type
 * @property {string|null} dataUrl  only kept for small files in mock mode
 */

/**
 * @typedef {Object} FacilityTransfer
 * @property {string} id
 * @property {string} code
 * @property {string} type
 * @property {string} createdDate           yyyy-mm-dd (Ngày lập)
 * @property {string} expectedHandoverDate  yyyy-mm-dd
 * @property {string} fromCampusId
 * @property {string} toCampusId
 * @property {string} fromLocationId
 * @property {string} toLocationId
 * @property {string} reason
 * @property {string} note
 * @property {string} createdBy
 * @property {string|null} handoverUserId
 * @property {string|null} receiverUserId
 * @property {boolean} notifyOnSubmit
 * @property {string} status
 * @property {number} version
 * @property {TransferAttachment[]} attachments
 * @property {import('@/models/facility-transfer/FacilityTransferItem').FacilityTransferItem[]} items
 * @property {import('@/models/facility-transfer/TransferSignature').TransferSignature[]} signatures
 * @property {import('@/models/facility-transfer/TransferRevision').TransferRevision[]} revisions
 * @property {import('@/models/facility-transfer/TransferRevision').TransferRevisionRequest[]} revisionRequests
 * @property {import('@/models/facility-transfer/TransferDiscrepancy').TransferDiscrepancy[]} discrepancies
 * @property {TransferHistoryEntry[]} history
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} TransferHistoryEntry
 * @property {string} id
 * @property {string} action   key of HISTORY_ACTIONS
 * @property {string} userId
 * @property {string} at
 * @property {string} [note]
 * @property {number} version
 */

const toDateInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Empty form state used by the create wizard. */
export const createEmptyTransferForm = (currentUser) => {
  const today = new Date();
  const expected = new Date(today.getTime() + 2 * 86400000);
  return {
    id: null,
    code: '',
    type: TRANSFER_TYPES.INTRA_CAMPUS_ROOM,
    createdDate: toDateInput(today),
    expectedHandoverDate: toDateInput(expected),
    fromCampusId: currentUser?.campusId || '',
    toCampusId: currentUser?.campusId || '',
    fromLocationId: '',
    toLocationId: '',
    reason: '',
    note: '',
    attachments: [],
    items: [],
    handoverUserId: null,
    receiverUserId: null,
    handoverPickMode: 'SUGGESTED',
    receiverPickMode: 'SUGGESTED',
    notifyOnSubmit: true,
    creatorSignatureUrl: null,
    creatorSignatureId: null,
    status: TRANSFER_STATUS.DRAFT,
    version: 0,
  };
};

/** Builds wizard form state from an existing transfer (draft or revision). */
export const transferToForm = (transfer) => ({
  id: transfer.id,
  code: transfer.code,
  type: transfer.type,
  createdDate: transfer.createdDate,
  expectedHandoverDate: transfer.expectedHandoverDate,
  fromCampusId: transfer.fromCampusId,
  toCampusId: transfer.toCampusId,
  fromLocationId: transfer.fromLocationId,
  toLocationId: transfer.toLocationId,
  reason: transfer.reason,
  note: transfer.note || '',
  attachments: transfer.attachments || [],
  items: (transfer.items || []).map((i) => ({ ...i })),
  handoverUserId: transfer.handoverUserId,
  receiverUserId: transfer.receiverUserId,
  handoverPickMode: transfer.handoverPickMode || 'SUGGESTED',
  receiverPickMode: transfer.receiverPickMode || 'SUGGESTED',
  notifyOnSubmit: transfer.notifyOnSubmit ?? true,
  creatorSignatureUrl: transfer.draftSignatureUrl || null,
  creatorSignatureId: transfer.draftSignatureId || null,
  status: transfer.status,
  version: transfer.version,
});

/** Fields whose change after the handover signature invalidates it. */
export const CRITICAL_FIELDS = ['fromCampusId', 'toCampusId', 'fromLocationId', 'toLocationId'];
