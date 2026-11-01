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
 * @property {string|null} supplierId   NCC trong danh mục (BA 01); null ở phiếu cũ chưa liên kết
 * @property {string} supplierName       tên NCC chụp lúc lưu phiếu, giữ trên chứng từ khi NCC đổi tên
 *
 * @typedef {Object} Supplier             nhà cung cấp, chỉ thông tin cơ bản (BA 01: HT quản lý, PHT xem và chọn khi nhập kho)
 * @property {string} id
 * @property {string} code                NCC001…, hệ thống sinh, không sửa
 * @property {string} name
 * @property {string} address
 * @property {string} contactName
 * @property {string} phone
 * @property {string} taxCode             mã số thuế, không bắt buộc
 * @property {'ACTIVE'|'INACTIVE'} status ngừng dùng ⇒ không chọn được cho phiếu mới
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

/*
 * Xuất kho tự động theo BA: bản chốt suất ⇒ tính nguyên liệu ⇒ thiếu một dòng thì dừng cả phiếu (chờ nhập bổ sung)
 * ⇒ đủ thì bếp chọn lô ⇒ hệ thống ghi xuất một lần. ISSUED và các trạng thái duyệt tay chỉ còn ở dữ liệu cũ.
 */
export const ISSUE_STATUS = {
  AWAITING_STOCK: 'AWAITING_STOCK',
  AWAITING_LOT_ALLOCATION: 'AWAITING_LOT_ALLOCATION',
  PROCESSING: 'PROCESSING',
  POSTED: 'POSTED',
  FAILED: 'FAILED',
  ISSUED: 'ISSUED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  RECEIVED: 'RECEIVED',
};
/** Phiếu đã trừ tồn (mới: POSTED; dữ liệu cũ: ISSUED). */
export const isIssuePosted = (status) => status === ISSUE_STATUS.POSTED || status === ISSUE_STATUS.ISSUED;
export const ISSUE_STATUS_LABELS = {
  NO_MENU: 'Không có thực đơn',
  WAITING_MEAL_COUNT: 'Chờ chốt suất',
  AWAITING_STOCK: 'Thiếu hàng, chờ nhập bổ sung',
  AWAITING_LOT_ALLOCATION: 'Chờ bếp chọn lô',
  PROCESSING: 'Đang ghi xuất',
  POSTED: 'Đã ghi xuất',
  FAILED: 'Ghi xuất lỗi',
  ISSUED: 'Đã xuất kho (dữ liệu cũ)',
  PENDING_APPROVAL: 'Phiếu cũ: chờ duyệt',
  APPROVED: 'Phiếu cũ: đã duyệt, chưa nhận',
  RECEIVED: 'Phiếu cũ: bếp đã nhận',
};

export const ISSUE_HISTORY_LABELS = {
  CREATED: 'Tính nguyên liệu từ bản chốt suất',
  BLOCKED: 'Thiếu hàng: dừng cả phiếu, chờ nhập bổ sung',
  READY: 'Đủ hàng: chờ bếp chọn lô',
  POSTED: 'Bếp chọn lô, hệ thống ghi xuất và trừ tồn',
  NEED_CHANGED: 'Số suất chốt thay đổi sau khi đã ghi xuất (chỉ ghi chú, chưa điều chỉnh kho)',
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

/* Phiếu nhập kho (BA): nháp không cộng tồn; xác nhận tạo lô, cộng tồn đúng một lần và khóa sửa. */
export const RECEIPT_STATUS = { DRAFT: 'DRAFT', CONFIRMED: 'CONFIRMED' };
export const RECEIPT_STATUS_LABELS = { DRAFT: 'Nháp', CONFIRMED: 'Đã xác nhận nhập' };

export const SUPPLIER_STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };
export const SUPPLIER_STATUS_LABELS = { ACTIVE: 'Đang dùng', INACTIVE: 'Ngừng dùng' };

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
