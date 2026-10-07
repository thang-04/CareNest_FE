/*
 * Permission catalog = rows of SRS "4.4 Permission Matrix" (+ two use cases that the matrix does not list).
 * `defaults` keeps the matrix value per role, in the matrix column order:
 * Principal, Vice Principal, Teacher, Team Leader, Kitchen Staff, Parent (matrix column order). F = Full, R = Restricted, N = No.
 * The Parent column is kept for traceability only: parents use the mobile app, so the web configures the other five roles.
 * `notes` are the matrix footnotes that apply to the row.
 */
const ROWS = [
  // module, code, entity, action, defaults, notes, source
  [
    'account',
    'user.manage',
    'Tài khoản người dùng',
    'Tạo / sửa / vô hiệu hóa',
    'FNNNNN',
    ['⁸ Quyền của Hiệu trưởng được giả định, chờ xác nhận.'],
  ],
  ['account', 'permission.manage', 'Quyền theo vai trò', 'Quản lý', 'FNNNNN', [], 'UC 2.4'],
  ['account', 'permission.assignVicePrincipal', 'Phân quyền', 'Phân công Phó hiệu trưởng', 'FNNNNN', []],
  ['account', 'permission.assignTeacher', 'Phân quyền', 'Phân công giáo viên / tổ trưởng', 'NRNNNN', []],
  ['account', 'profile.manage', 'Hồ sơ cá nhân & mật khẩu', 'Xem / đổi', 'FFFFFF', []],
  ['account', 'notification.receive', 'Thông báo', 'Nhận', 'FFFFFF', []],
  ['schoolConfig', 'campus.manage', 'Điểm trường', 'Tạo / sửa', 'FNNNNN', []],
  ['schoolConfig', 'schoolStructure.configure', 'Năm học, nhóm tuổi & lớp', 'Cấu hình', 'FNNNNN', []],
  ['schoolConfig', 'schoolStructure.view', 'Năm học, nhóm tuổi & lớp', 'Xem', 'FRRRNN', []],
  ['schoolConfig', 'cutoff.configure', 'Giờ chốt điểm danh & suất ăn', 'Cấu hình', 'FNNNNN', [], 'UC 2.7'],
  ['children', 'children.enroll', 'Nhập học & khai báo sức khỏe', 'Tạo', 'NRNNNN', []],
  ['children', 'children.view', 'Danh sách & hồ sơ trẻ', 'Xem', 'FRRRNR', []],
  ['children', 'pickup.handover', 'Đón trẻ', 'Bàn giao / ghi kết quả', 'NNRRNN', []],
  ['attendance', 'attendance.edit', 'Điểm danh & suất ăn', 'Ghi / sửa', 'NNRRNN', ['⁶ Chỉ trước giờ chốt điểm danh trong ngày.']],
  ['attendance', 'attendance.view', 'Điểm danh & suất ăn', 'Xem', 'FRRRNR', []],
  ['attendance', 'mealCount.view', 'Số suất ăn theo lớp', 'Xem', 'FRNNRN', []],
  [
    'meal',
    'mealConfig.manage',
    'Giá suất ăn, thực phẩm & món ăn',
    'Quản lý',
    'NRNNNN',
    ['Chỉ Phó hiệu trưởng phụ trách dịch vụ chung (GBR-GEN-10).'],
  ],
  [
    'meal',
    'menu.manage',
    'Thực đơn, thực đơn dị ứng & thực đơn tuần',
    'Quản lý / gợi ý AI',
    'NRNNNN',
    ['Chỉ Phó hiệu trưởng phụ trách dịch vụ chung (GBR-GEN-10).'],
  ],
  ['meal', 'menu.balance', 'Dinh dưỡng thực đơn ngày', 'Cân đối', 'NRNNNN', []],
  ['meal', 'menu.view', 'Thực đơn', 'Xem', 'FRNNRN', []],
  ['meal', 'foodQuantity.view', 'Định lượng thực phẩm cần dùng', 'Xem', 'NRNNRN', []],
  ['meal', 'missingFood.submit', 'Báo thiếu thực phẩm', 'Gửi', 'NNNNRN', []],
  ['meal', 'mealPrep.update', 'Trạng thái chế biến', 'Cập nhật', 'NNNNRN', []],
  ['meal', 'mealPrep.view', 'Trạng thái chế biến', 'Xem', 'NRNNRN', []],
  ['health', 'health.edit', 'Số đo sức khỏe của trẻ', 'Ghi / sửa', 'NNRRNN', []],
  ['health', 'health.view', 'Hồ sơ & xu hướng sức khỏe', 'Xem', 'FRRRNR', []],
  ['assessment', 'assessment.record', 'Đánh giá hằng ngày', 'Ghi', 'NNRRNN', []],
  ['assessment', 'activities.view', 'Hoạt động & đánh giá hằng ngày', 'Xem', 'NNRRNR', []],
  ['assessment', 'evaluation.confirm', 'Đánh giá tuần / tháng / cuối năm', 'Xem lại & xác nhận (bản nháp AI)', 'NNRRNN', []],
  ['assessment', 'development.view', 'Hồ sơ phát triển của trẻ', 'Xem', 'NNRRNR', []],
  ['assessment', 'reward.create', 'Đề xuất khen thưởng cuối năm', 'Tạo', 'NNRRNN', []],
  ['assessment', 'reward.review', 'Đề xuất khen thưởng cuối năm', 'Xem xét / trả lại', 'NRNNNN', []],
  ['assessment', 'reward.approve', 'Đề xuất khen thưởng cuối năm', 'Phê duyệt / từ chối', 'FNNNNN', []],
  ['assessment', 'reward.view', 'Kết quả khen thưởng cuối năm', 'Xem', 'FRRRNR', []],
  ['education', 'goals.edit', 'Mục tiêu năm học', 'Tạo / sửa', 'NRNNNN', []],
  ['education', 'goals.view', 'Mục tiêu năm học', 'Xem', 'NRFFNN', []],
  ['education', 'thematic.edit', 'Kế hoạch chủ đề', 'Tạo / sửa', 'NNNRNN', []],
  ['education', 'thematic.view', 'Kế hoạch chủ đề', 'Xem', 'NRRRNN', []],
  ['education', 'lessonPlan.edit', 'Kế hoạch giáo dục', 'Tạo / sửa', 'NNRRNN', []],
  [
    'education',
    'lessonPlan.approve',
    'Kế hoạch giáo dục',
    'Phê duyệt / từ chối',
    'NRNRNN',
    ['⁷ Tổ trưởng duyệt trước, sau đó Phó hiệu trưởng.'],
  ],
  ['education', 'lessonPlan.view', 'Kế hoạch giáo dục', 'Xem', 'FRRRNN', []],
  ['facility', 'facilityIssue.submit', 'Báo cáo sự cố cơ sở vật chất', 'Gửi', 'NNRRRN', []],
  ['facility', 'facilityIssue.approve', 'Báo cáo sự cố cơ sở vật chất', 'Duyệt / từ chối', 'NRNNNN', []],
  ['facility', 'facilityIssue.view', 'Sự cố cơ sở vật chất', 'Xem', 'FRNNNN', []],
  ['facility', 'facilityProposal.create', 'Đề xuất cơ sở vật chất', 'Tạo', 'NRNNNN', []],
  ['facility', 'facilityProposal.approve', 'Đề xuất cơ sở vật chất', 'Phê duyệt / từ chối', 'FNNNNN', []],
  ['monitoring', 'dashboard.view', 'Bảng tổng quan toàn trường', 'Xem', 'FNNNNN', []],
  ['monitoring', 'approvals.view', 'Yêu cầu chờ phê duyệt', 'Xem', 'FRNRNN', []],
];

const LEVEL = { F: 'FULL', R: 'RESTRICTED', N: 'NONE' };
const MATRIX_COLUMNS = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'TEAM_LEADER', 'KITCHEN_STAFF', 'PARENT'];

export const PERMISSION_CATALOG = ROWS.map(([module, code, entity, action, defaults, notes, source]) => ({
  module,
  code,
  entity,
  action,
  notes,
  source: source || 'SRS 4.4',
  defaults: Object.fromEntries(MATRIX_COLUMNS.map((role, i) => [role, LEVEL[defaults[i]]])),
}));

export const permissionByCode = (code) => PERMISSION_CATALOG.find((p) => p.code === code) || null;

/** Grants of one role as defined by the SRS matrix. */
export const defaultGrants = (role) => Object.fromEntries(PERMISSION_CATALOG.map((p) => [p.code, p.defaults[role] || 'NONE']));

/** Principal must keep the right to manage permissions, otherwise nobody can fix the configuration. */
export const LOCKED_GRANTS = { PRINCIPAL: ['permission.manage'] };

export const isLockedGrant = (role, code) => (LOCKED_GRANTS[role] || []).includes(code);
