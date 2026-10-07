/*
 * Facility issues, additional facility requests and facility proposals (SRS UC 7.2–7.4, GBR-FAC-01..10).
 * Screens #109–#112, #117–#120.
 */

/** Issue type chosen by the reporter (UC 7.2 step 6, GBR-FAC-03). */
export const ISSUE_TYPES = {
  DAMAGED: 'DAMAGED',
  MISSING: 'MISSING',
  INSUFFICIENT: 'INSUFFICIENT',
};

export const ISSUE_TYPE_LABELS = {
  DAMAGED: 'Hư hỏng',
  MISSING: 'Bị mất',
  INSUFFICIENT: 'Không đủ số lượng',
};

export const ISSUE_TYPE_HINTS = {
  DAMAGED: 'Tài sản bị hỏng, cần sửa chữa. Bắt buộc có ít nhất 1 ảnh.',
  MISSING: 'Tài sản không còn ở lớp/phòng. Ghi rõ số lượng bị mất.',
  INSUFFICIENT: 'Số lượng hiện có không đủ dùng. Ghi rõ số lượng hiện có và số cần bổ sung.',
};

/** GBR-FAC-05: Submitted -> Approved or Rejected (one way). */
export const ISSUE_STATUS = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const ISSUE_STATUS_LABELS = {
  SUBMITTED: 'Chờ PHT duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
};

/** UC 7.3: Submitted -> Approved / Rejected, or Pending Principal Approval -> Approved / Rejected. */
export const REQUEST_STATUS = {
  SUBMITTED: 'SUBMITTED',
  PENDING_PRINCIPAL: 'PENDING_PRINCIPAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const REQUEST_STATUS_LABELS = {
  SUBMITTED: 'Chờ PHT duyệt',
  PENDING_PRINCIPAL: 'Chờ Hiệu trưởng duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
};

/** Whether the requested item already exists in the location or is a new item. */
export const REQUEST_ITEM_MODES = {
  EXISTING: 'EXISTING',
  NEW: 'NEW',
};

/** GBR-FAC-10: proposal of a Vice Principal, decided by the Principal. */
export const PROPOSAL_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

export const PROPOSAL_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  SUBMITTED: 'Chờ Hiệu trưởng phê duyệt',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Bị từ chối',
  CANCELLED: 'Đã hủy',
};

/** Proposals that still hold their source issues / requests (they cannot join another proposal). */
export const ACTIVE_PROPOSAL_STATUSES = [PROPOSAL_STATUS.DRAFT, PROPOSAL_STATUS.SUBMITTED, PROPOSAL_STATUS.APPROVED];

export const PROPOSAL_ACTIONS = {
  PURCHASE: 'PURCHASE',
  REPAIR: 'REPAIR',
  REPLACE: 'REPLACE',
};

export const PROPOSAL_ACTION_LABELS = {
  PURCHASE: 'Mua mới / bổ sung',
  REPAIR: 'Sửa chữa',
  REPLACE: 'Thay thế',
};

/** Where a proposal line comes from. */
export const SOURCE_TYPES = {
  ISSUE: 'ISSUE',
  REQUEST: 'REQUEST',
  MANUAL: 'MANUAL',
};

export const SOURCE_TYPE_LABELS = {
  ISSUE: 'Báo sự cố',
  REQUEST: 'Đề nghị bổ sung',
  MANUAL: 'Nhập thêm',
};

export const FACILITY_HISTORY = {
  SUBMITTED: 'Gửi báo cáo',
  LINKED: 'Báo trùng – liên kết người báo',
  APPROVED: 'Phê duyệt',
  REJECTED: 'Từ chối',
  FORWARDED: 'Chuyển Hiệu trưởng duyệt',
  REQUEST_SUBMITTED: 'Gửi đề nghị',
  PROPOSAL_CREATED: 'Lập đề xuất (nháp)',
  PROPOSAL_UPDATED: 'Cập nhật đề xuất',
  PROPOSAL_SUBMITTED: 'Gửi Hiệu trưởng phê duyệt',
  PROPOSAL_CANCELLED: 'Hủy đề xuất',
  ADDED_TO_PROPOSAL: 'Đưa vào đề xuất',
  PROPOSAL_DECIDED: 'Hiệu trưởng ra quyết định đề xuất',
};

export const MAX_ISSUE_PHOTOS = 5;
export const MAX_QUANTITY = 999;
