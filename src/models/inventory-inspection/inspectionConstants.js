/** Inventory round (đợt kiểm kê). */
export const ROUND_STATUS = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const ROUND_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  IN_PROGRESS: 'Đang kiểm kê',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

/** Rounds that lock the asset data of their locations. */
export const LOCKING_ROUND_STATUSES = [ROUND_STATUS.IN_PROGRESS, ROUND_STATUS.PENDING_APPROVAL];

/** Inventory sheet (phiếu kiểm kê) – one per class / room / storeroom. */
export const SHEET_STATUS = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  RECOUNT_REQUESTED: 'RECOUNT_REQUESTED',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
};

export const SHEET_STATUS_LABELS = {
  ASSIGNED: 'Chờ kiểm kê',
  IN_PROGRESS: 'Đang kiểm kê',
  SUBMITTED: 'Đã nộp – chờ duyệt',
  RECOUNT_REQUESTED: 'Yêu cầu kiểm lại',
  APPROVED: 'Đã duyệt',
  CANCELLED: 'Đã hủy',
};

export const ROUND_TYPES = {
  PERIODIC: 'PERIODIC',
  ADHOC: 'ADHOC',
};

export const ROUND_TYPE_LABELS = {
  PERIODIC: 'Định kỳ (cuối năm học / tài chính)',
  ADHOC: 'Đột xuất',
};

export const INSPECTION_HISTORY = {
  CREATED: 'Tạo đợt kiểm kê (nháp)',
  UPDATED: 'Cập nhật đợt kiểm kê',
  STARTED: 'Bắt đầu kiểm kê, khóa dữ liệu tài sản',
  SHEET_SAVED: 'Lưu tạm phiếu kiểm kê',
  SHEET_SUBMITTED: 'Nộp phiếu kiểm kê',
  SHEET_APPROVED: 'Duyệt phiếu kiểm kê',
  RECOUNT_REQUESTED: 'Yêu cầu kiểm lại',
  COMPLETED: 'Phê duyệt kết quả, hoàn thành kiểm kê',
  CANCELLED: 'Hủy đợt kiểm kê',
};
