/**
 * Food stock & meal preparation (SRS screens #90–#98, UC 6.12, 6.16–6.20, 6.23–6.25, BF-09).
 *
 * @typedef {Object} Food                 ingredient of the food catalog (menu-planning owns it)
 * @property {string} id
 * @property {string} name
 * @property {string} unit                purchasing unit, e.g. kg, lít, quả
 * @property {number} roundStep           GBR-MEAL-05: quantities are rounded up to this step
 *
 * @typedef {Object} StockReceipt         UC 6.23, one delivery recorded by the Vice Principal
 * @property {string} id
 * @property {string} code
 * @property {string} campusId
 * @property {string} date
 * @property {{ foodId: string, receivedQty: number, rejectedQty: number, acceptedQty: number, expiryDate?: string, note?: string }[]} items
 * @property {string} note
 * @property {string} createdBy
 * @property {string} createdAt
 *
 * @typedef {Object} StockIssue           UC 6.24, one slip per campus and day
 * @property {string} id
 * @property {string} code
 * @property {string} campusId
 * @property {string} date
 * @property {'PENDING_APPROVAL'|'APPROVED'|'RECEIVED'} status
 * @property {{ foodId: string, requiredQty: number }[]} items
 * @property {{ action: string, userId: string, at: string, note?: string }[]} history
 *
 * @typedef {Object} MealPreparation      one per kitchen (campus), date and meal session
 * @property {string} id
 * @property {string} campusId
 * @property {string} date
 * @property {string} session
 * @property {'WAITING'|'COOKING'|'READY_FOR_HANDOVER'} status
 * @property {string} note
 * @property {{ status: string, note: string, userId: string, at: string }[]} history
 */

/* Same codes as the attendance module (meal counts); the SRS does not name the sessions. */
export const MEAL_SESSIONS = ['LUNCH', 'AFTERNOON'];
export const MEAL_SESSION_LABELS = { LUNCH: 'Bữa trưa', AFTERNOON: 'Bữa chiều' };

export const MENU_TYPE = { NORMAL: 'NORMAL', ALLERGY: 'ALLERGY' };
export const MENU_TYPE_LABELS = { NORMAL: 'Thực đơn thường', ALLERGY: 'Thực đơn thay thế (dị ứng)' };

/* UC 6.17 / screen #98 statuses; GBR "only moves forward" – the order of this list is the allowed direction. */
export const PREP_STATUS = { WAITING: 'WAITING', COOKING: 'COOKING', READY_FOR_HANDOVER: 'READY_FOR_HANDOVER' };
export const PREP_STATUS_ORDER = [PREP_STATUS.WAITING, PREP_STATUS.COOKING, PREP_STATUS.READY_FOR_HANDOVER];
export const PREP_STATUS_LABELS = {
  NOT_STARTED: 'Chưa cập nhật',
  WAITING: 'Chờ chế biến',
  COOKING: 'Đang nấu',
  READY_FOR_HANDOVER: 'Sẵn sàng bàn giao',
};

export const ISSUE_STATUS = { PENDING_APPROVAL: 'PENDING_APPROVAL', APPROVED: 'APPROVED', RECEIVED: 'RECEIVED' };
export const ISSUE_STATUS_LABELS = {
  NO_MENU: 'Không có thực đơn',
  WAITING_MEAL_COUNT: 'Chờ xác nhận số suất ăn',
  PENDING_APPROVAL: 'Chờ Phó hiệu trưởng duyệt',
  APPROVED: 'Đã duyệt – chờ bếp xác nhận nhận',
  RECEIVED: 'Bếp đã nhận',
};

export const ISSUE_HISTORY_LABELS = {
  PREPARED: 'Lập phiếu xuất kho',
  APPROVED: 'Duyệt phiếu xuất kho',
  RECEIVED: 'Bếp xác nhận nhận thực phẩm',
};

export const MISSING_STATUS = { SUBMITTED: 'SUBMITTED', SUPPLIED: 'SUPPLIED' };
export const MISSING_STATUS_LABELS = { SUBMITTED: 'Chờ Phó hiệu trưởng bổ sung', SUPPLIED: 'Đã bổ sung' };

/* Meal count status as read from the attendance module. */
export const MEAL_COUNT_STATUS_LABELS = {
  NONE: 'Chưa có số suất',
  PENDING_CONFIRMATION: 'Chờ Phó hiệu trưởng xác nhận',
  CONFIRMED: 'Đã xác nhận',
};

/*
 * GBR-MEAL-02: portions differ by age group. The SRS gives no figures, so dish quantities are for the
 * 4–5 year group and other groups use this factor (assumption, to be replaced by menu-planning data).
 */
export const PORTION_FACTOR_BY_AGE_GROUP = { 'ag-2': 0.8, 'ag-3': 0.9, 'ag-4': 1, 'ag-5': 1.1 };

export const NOTE_MAX = 500;
