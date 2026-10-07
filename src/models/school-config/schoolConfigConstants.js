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
 *
 * @typedef {Object} RolePermissionEntry
 * @property {string} role            one of CONFIG_ROLES
 * @property {Object<string, 'FULL'|'RESTRICTED'|'NONE'>} grants   permission code -> level
 * @property {{ userId: string, at: string, reason: string, changes: { code: string, from: string, to: string }[] }[]} history
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

export const PERMISSION_LEVEL = { FULL: 'FULL', RESTRICTED: 'RESTRICTED', NONE: 'NONE' };

export const PERMISSION_LEVEL_LABELS = {
  FULL: 'Toàn quyền',
  RESTRICTED: 'Theo phạm vi',
  NONE: 'Không',
};

/** Web roles of the SRS 4.4 Permission Matrix. Parents use the mobile app and are not configured here. */
export const CONFIG_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEAM_LEADER', 'TEACHER', 'KITCHEN_STAFF'];

export const CONFIG_ROLE_LABELS = {
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó hiệu trưởng',
  TEACHER: 'Giáo viên',
  TEAM_LEADER: 'Tổ trưởng nhóm tuổi',
  KITCHEN_STAFF: 'Nhân viên bếp',
};

export const CONFIG_ROLE_DESCRIPTIONS = {
  PRINCIPAL: 'Quản lý toàn trường: cấu hình năm học, điểm trường, lớp, phân quyền Phó hiệu trưởng.',
  VICE_PRINCIPAL: 'Quản lý điểm trường được phân công: trẻ, bán trú, kế hoạch giáo dục, cơ sở vật chất.',
  TEACHER: 'Phụ trách lớp được phân công: điểm danh, sức khỏe, đánh giá, kế hoạch lớp.',
  TEAM_LEADER: 'Giáo viên điều phối nhóm tuổi: kế hoạch chủ đề, duyệt kế hoạch của giáo viên trong khối.',
  KITCHEN_STAFF: 'Nhân viên bếp của điểm trường: xem thực đơn, suất ăn, cập nhật trạng thái chế biến.',
};

/** Footnotes of the SRS matrix: what "Theo phạm vi" means for each role. */
export const ROLE_SCOPE_NOTES = {
  PRINCIPAL: 'Toàn trường (cả hai điểm trường).',
  VICE_PRINCIPAL: 'Chỉ trẻ, lớp, nhân sự và dữ liệu của điểm trường được phân công.',
  TEACHER: 'Chỉ trẻ và hồ sơ của lớp được phân công.',
  TEAM_LEADER: 'Chỉ lớp, giáo viên và kế hoạch của nhóm tuổi được phân công (và lớp mình dạy).',
  KITCHEN_STAFF: 'Chỉ bếp của điểm trường được phân công; số suất ăn chỉ được xem.',
};

export const PERMISSION_MODULES = {
  account: 'Tài khoản & phân quyền',
  schoolConfig: 'Cấu hình trường',
  children: 'Hồ sơ trẻ',
  attendance: 'Điểm danh & suất ăn',
  meal: 'Bán trú & thực đơn',
  health: 'Sức khỏe',
  assessment: 'Đánh giá & khen thưởng',
  education: 'Kế hoạch giáo dục',
  facility: 'Cơ sở vật chất',
  monitoring: 'Giám sát & phê duyệt',
};

export const SHARED_SERVICE_LABEL = 'Phụ trách dịch vụ chung (bán trú toàn trường)';

export const CUTOFF_DEFAULT_HINT = 'Giờ Việt Nam (Asia/Ho_Chi_Minh). Sau giờ này, điểm danh và đăng ký suất ăn trong ngày bị khóa.';
