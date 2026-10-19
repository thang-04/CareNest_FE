/**
 * Food stock and kitchen day (SRS screens #90–#97, UC 6.12, 6.16, 6.18–6.20, 6.23–6.25, BF-09).
 * Meal preparation status and meal handover are not tracked: at meal time the food is taken as cooked.
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
 * @property {string} supplierName       NCC (chữ tự do, chưa có danh mục NCC – P-09)
 * @property {{ foodId: string, receivedQty: number, rejectedQty: number, acceptedQty: number, lotNo: string, expiryDate: string, unitPrice: number, note?: string }[]} items
 * @property {string} note
 * @property {string} createdBy
 * @property {string} createdAt
 *
 * @typedef {Object} StockIssue           one slip per campus and day, created when the whole day's meal count is confirmed (dry food only)
 * @property {string} id
 * @property {string} code
 * @property {string} campusId
 * @property {string} date
 * @property {'ISSUED'} status
 * @property {{ foodId: string, requiredQty: number, issuedQty: number, shortage: number }[]} items
 * @property {{ action: string, userId: string, at: string, note?: string }[]} history
 *
 * @typedef {Object} FoodSample           sổ lưu mẫu một bữa (QĐ 1246/QĐ-BYT Mẫu 5), ghi bởi bếp của cơ sở; không chặn bước nào
 * @property {string} campusId
 * @property {string} date
 * @property {string} session
 * @property {string} takenAt              giờ lấy mẫu (ISO)
 * @property {string} takenBy
 * @property {{ dishId: string, weight: string, container: string, temperature: string, note: string }[]} dishes
 * @property {string|null} destroyedAt    ghi hủy khi đã lưu đủ 24 giờ
 * @property {string|null} destroyedBy
 */

/* Same codes as the attendance module (meal counts); the SRS does not name the sessions. */
// Attendance cũ dùng danh sách này riêng cho điều kiện bàn giao; không đổi contract ngầm.
export const MEAL_SESSIONS = ['LUNCH', 'AFTERNOON'];
export { MEAL_SESSIONS as ALL_MEAL_SESSIONS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';

export const MENU_TYPE = { NORMAL: 'NORMAL', ALLERGY: 'ALLERGY' };
export const MENU_TYPE_LABELS = { NORMAL: 'Thực đơn thường', ALLERGY: 'Thực đơn thay thế (dị ứng)' };

/* Giờ dự kiến của các mốc trên trang Quy trình bếp hôm nay: chỉ để hiển thị, không chặn thao tác (giờ chốt P-03 còn PENDING). */
export const KITCHEN_DAY_TIMES = { FRESH_RECEIPT: '06:30', MEAL_COUNT: '08:30', FOOD_SAMPLE: '10:30', FORECAST: '15:00' };

/* Phiếu xuất kho đồ khô tự sinh khi chốt suất cả ngày (S8); không còn bước duyệt và bước bếp xác nhận nhận. */
export const ISSUE_STATUS = { ISSUED: 'ISSUED', PENDING_APPROVAL: 'PENDING_APPROVAL', APPROVED: 'APPROVED', RECEIVED: 'RECEIVED' };
export const ISSUE_STATUS_LABELS = {
  NO_MENU: 'Không có thực đơn',
  WAITING_MEAL_COUNT: 'Chờ chốt suất',
  ISSUED: 'Đã xuất kho',
  PENDING_APPROVAL: 'Phiếu cũ: chờ duyệt',
  APPROVED: 'Phiếu cũ: đã duyệt, chưa nhận',
  RECEIVED: 'Phiếu cũ: bếp đã nhận',
};

export const ISSUE_HISTORY_LABELS = {
  ISSUED: 'Xuất kho tự động khi chốt suất',
  ADJUSTED: 'Điều chỉnh theo số suất chốt lại',
  // Phiếu duyệt tay lập trước khảo sát 18/10/2026
  PREPARED: 'Lập phiếu xuất kho',
  APPROVED: 'Duyệt phiếu xuất kho',
  RECEIVED: 'Bếp xác nhận nhận thực phẩm',
};

/* Kiểm nhận hàng tươi theo phiếu giao hàng (S5–S6): bếp kiểm rồi gửi, PHT xác nhận hoặc trả bếp kiểm lại. */
export const FRESH_RECEIPT_STATUS = { DRAFT: 'DRAFT', SUBMITTED: 'SUBMITTED', CONFIRMED: 'CONFIRMED' };
export const FRESH_RECEIPT_STATUS_LABELS = {
  NEW: 'Chưa kiểm nhận',
  DRAFT: 'Bếp đang kiểm',
  SUBMITTED: 'Chờ PHT xác nhận',
  CONFIRMED: 'PHT đã xác nhận',
};
export const FRESH_RESULT = { OK: 'OK', SHORT: 'SHORT', RETURNED: 'RETURNED' };
export const FRESH_RESULT_LABELS = { OK: 'Đủ', SHORT: 'Thiếu', RETURNED: 'Trả lại' };

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

/* Kiểm kê kho khô theo tháng: nháp ⇒ chốt (tồn = số đếm); lệch phải chọn lý do. */
export const STOCK_COUNT_STATUS = { DRAFT: 'DRAFT', FINALIZED: 'FINALIZED' };
export const STOCK_COUNT_STATUS_LABELS = { DRAFT: 'Đang kiểm kê', FINALIZED: 'Đã chốt' };
export const COUNT_DIFF_REASON = { LOSS: 'LOSS', DAMAGED: 'DAMAGED', EXPIRED: 'EXPIRED', WRONG_ENTRY: 'WRONG_ENTRY' };
export const COUNT_DIFF_REASON_LABELS = { LOSS: 'Hao hụt', DAMAGED: 'Hỏng', EXPIRED: 'Hết hạn', WRONG_ENTRY: 'Nhập sai' };

export const NOTE_MAX = 500;

// Giữ mã lịch sử và widget bếp cũ, không mở lại luồng chế biến/bàn giao mới.
export const PREP_STATUS = { WAITING: 'WAITING', COOKING: 'COOKING', READY_FOR_HANDOVER: 'READY_FOR_HANDOVER' };
export const PREP_STATUS_ORDER = [PREP_STATUS.WAITING, PREP_STATUS.COOKING, PREP_STATUS.READY_FOR_HANDOVER];
export const PREP_STATUS_LABELS = {
  NOT_STARTED: 'Chưa cập nhật',
  WAITING: 'Chờ chế biến',
  COOKING: 'Đang nấu',
  READY_FOR_HANDOVER: 'Sẵn sàng bàn giao',
};
export const MISSING_STATUS = { SUBMITTED: 'SUBMITTED', SUPPLIED: 'SUPPLIED' };
export const MISSING_STATUS_LABELS = { SUBMITTED: 'Chờ bổ sung', SUPPLIED: 'Đã bổ sung' };
