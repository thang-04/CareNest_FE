import { ROUND_TYPES } from '@/models/inventory-inspection/inspectionConstants';

/**
 * @typedef {Object} InspectionRound  Đợt kiểm kê
 * @property {string} id
 * @property {string} code               KK001
 * @property {string} name
 * @property {'PERIODIC'|'ADHOC'} type
 * @property {'SCHOOL'|'CAMPUS'|'LOCATION_TYPE'|'CUSTOM'} locationMode  where to count
 * @property {string[]} campusIds
 * @property {string[]} locationTypes
 * @property {string[]} locationIds
 * @property {'ALL'|'CATEGORY'|'ASSET'} assetMode                  what to count
 * @property {string[]} categoryIds
 * @property {string[]} assetCodes
 * @property {string} startDate          yyyy-mm-dd
 * @property {string} deadline           yyyy-mm-dd
 * @property {string} note
 * @property {string} createdBy
 * @property {string} status             ROUND_STATUS
 * @property {{locationId:string, inspectorUserId:string}[]} scope   chosen while drafting
 * @property {InspectionSheet[]} sheets  created when the round starts
 * @property {Object[]} signatures       { type: CREATOR|APPROVER, signedBy, signedByName, signatureUrl, signedAt }
 * @property {Object[]} adjustments      stock / condition changes applied at completion
 * @property {boolean} applyAdjustments
 * @property {string} approvalNote
 * @property {Object[]} history
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} InspectionSheet  Phiếu kiểm kê of one location
 * @property {string} id
 * @property {string} code               KK001-01
 * @property {string} locationId
 * @property {string} inspectorUserId
 * @property {string} status             SHEET_STATUS
 * @property {InspectionItem[]} items
 * @property {Object|null} inspectorSignature  { signatureUrl, signedAt, signedByName }
 * @property {Object[]} recountRequests  { reason, itemIds, requestedBy, requestedAt }
 * @property {number} submitCount
 * @property {string|null} submittedAt
 * @property {string|null} approvedAt
 * @property {string|null} approvedBy
 */

/**
 * @typedef {Object} InspectionItem
 * @property {string} assetId
 * @property {string} assetCode
 * @property {string} assetName
 * @property {string} unit
 * @property {string} categoryId
 * @property {number} bookQuantity        locked "sổ sách" quantity
 * @property {string} bookCondition
 * @property {number|null} actualQuantity
 * @property {string|null} actualCondition
 * @property {string} note
 * @property {string[]} images
 * @property {boolean} flagged            VP asked to recount this item
 */

const toInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const createEmptyRoundForm = (user) => {
  const today = new Date();
  return {
    id: null,
    name: '',
    type: ROUND_TYPES.ADHOC,
    locationMode: 'CAMPUS',
    campusIds: user?.campusId ? [user.campusId] : [],
    locationTypes: ['CLASS'],
    locationIds: [],
    assetMode: 'ALL',
    categoryIds: [],
    assetCodes: [],
    startDate: toInput(today),
    deadline: toInput(new Date(today.getTime() + 3 * 86400000)),
    note: '',
    scope: [],
    creatorSignatureUrl: null,
  };
};

export const itemVariance = (item) => (item.actualQuantity == null ? null : item.actualQuantity - item.bookQuantity);

export const isItemCounted = (item) => item.actualQuantity != null && item.actualQuantity !== '' && !!item.actualCondition;

export const sheetSummary = (sheet) => {
  const items = sheet.items || [];
  const counted = items.filter(isItemCounted).length;
  const variance = items.filter((i) => isItemCounted(i) && i.actualQuantity !== i.bookQuantity).length;
  const damaged = items.filter((i) => ['NEED_REPAIR', 'BROKEN'].includes(i.actualCondition)).length;
  return { total: items.length, counted, variance, damaged };
};
