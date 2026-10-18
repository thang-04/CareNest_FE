/**
 * School configuration (SRS 5.1 screens #16–#26, UC 2.1–2.7, GBR-CFG-01..03, GBR-GEN-03/06/10).
 *
 * @typedef {Object} SchoolYear
 * @property {string} id            same as name, e.g. '2026-2027' (used by the header year selector)
 * @property {string} name
 * @property {string} startDate     yyyy-mm-dd
 * @property {string} endDate       yyyy-mm-dd
 * @property {'PLANNED'|'ACTIVE'|'CLOSED'} status
 * @property {{ action: string, userId: string, at: string, note?: string }[]} history
 *
 * @typedef {Object} AgeGroupConfig
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string} ageRange        e.g. '24–36 tháng'
 * @property {number} mealsPerDay     3 for nursery ages, 2 for kindergarten ages
 * @property {string} nutritionNote
 *
 * @typedef {Object} CutoffSetting
 * @property {string} schoolYear
 * @property {string} time            'HH:mm', Asia/Ho_Chi_Minh
 * @property {string} effectiveFrom   yyyy-mm-dd
 * @property {string} updatedBy
 * @property {string} updatedAt
 * @property {{ time: string, effectiveFrom: string, previousTime: string|null, userId: string, at: string, note?: string }[]} history
 */

export const YEAR_STATUS = { PLANNED: 'PLANNED', ACTIVE: 'ACTIVE', CLOSED: 'CLOSED' };

export const YEAR_STATUS_LABELS = {
  PLANNED: 'Sắp diễn ra',
  ACTIVE: 'Đang hoạt động',
  CLOSED: 'Đã kết thúc',
};

export const YEAR_ACTION_LABELS = {
  CREATED: 'Tạo năm học',
  UPDATED: 'Cập nhật thông tin',
  ACTIVATED: 'Kích hoạt năm học',
  CLOSED: 'Kết thúc năm học',
};

export const CLASS_STATUS_LABELS = { ACTIVE: 'Đang hoạt động', CLOSED: 'Đã đóng' };

export const SHARED_SERVICE_LABEL = 'Phụ trách dịch vụ chung (bán trú toàn trường)';

export const CUTOFF_DEFAULT_HINT = 'Giờ Việt Nam (Asia/Ho_Chi_Minh). Sau giờ này, điểm danh và đăng ký suất ăn trong ngày bị khóa.';
