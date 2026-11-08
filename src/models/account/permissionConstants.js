/*
 * Nhãn hiển thị cho mã quyền BE (BE:src/main/java/com/carenest/utils/enums/Permission.java);
 * STAFF_ACCOUNT_VIEW, PARENT_ACCOUNT_VIEW là đề xuất của UI G94-209, BE chưa có.
 * Không dùng các mã này để thay quyền hoặc scope đang chạy.
 */

/** Mã quyền FE dùng để ẩn/hiện menu, route (dùng chung nhiều module). */
export { PERMISSIONS } from '@/models/bePermissions';

/** Thứ tự cột của ma trận: cả 6 role của BE. */
export const PERMISSION_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF', 'PARENT', 'ADMIN'];

export const PERMISSION_ROLE_LABELS = {
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó hiệu trưởng',
  TEACHER: 'Giáo viên',
  KITCHEN_STAFF: 'Nhân viên bếp',
  PARENT: 'Phụ huynh',
  ADMIN: 'Quản trị hệ thống',
};

export const PERMISSION_MODULE_LABELS = {
  account: 'Tài khoản & phân quyền',
  child: 'Hồ sơ trẻ',
  staff: 'Nhân sự & phân công',
};

/** Quyền mở màn Nhân sự (BE AUTH-15..17). */
export const STAFF_MANAGEMENT_PERMISSIONS = ['ACCOUNT_MANAGE', 'ACCOUNT_STATUS_MANAGE', 'STAFF_ASSIGNMENT_MANAGE'];

export const ACCOUNT_STATUS_LABELS = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Đã khóa' };

export const OVERRIDE_EFFECT = { INHERIT: 'INHERIT', GRANT: 'GRANT', REVOKE: 'REVOKE' };

export const OVERRIDE_EFFECT_LABELS = {
  INHERIT: 'Theo vai trò',
  GRANT: 'Cấp thêm',
  REVOKE: 'Thu hồi',
};

export const PERMISSION_STATE_LABELS = {
  ON: 'Có',
  OFF: 'Không',
  GRANT: 'Cấp thêm',
  REVOKE: 'Thu hồi',
  INHERIT: 'Theo vai trò',
};

export const PERMISSION_GROUPS = {
  child: { key: 'child', label: 'Hồ sơ trẻ & Phát triển' },
  staff: { key: 'staff', label: 'Quản trị nhân sự & Phân công' },
  parent: { key: 'parent', label: 'Tài khoản phụ huynh' },
  meals: { key: 'meals', label: 'Suất ăn' },
  system: { key: 'system', label: 'Quản lý hệ thống' },
};

/**
 * Mỗi quyền = một việc cụ thể, viết bằng lời thường (một dòng bảng phân quyền).
 * `label` theo endpoint BE đang kiểm (BE:docs/modules/identity-access.md); đổi guard BE thì sửa theo. `hint` hiện ở tooltip.
 */
export const PERMISSION_TASKS = {
  CHILD_PROFILE_VIEW: {
    label: 'Xem lý lịch, sức khỏe, dị ứng của trẻ',
    hint: 'Chỉ trẻ trong lớp/điểm trường được phân công',
    group: 'child',
  },
  CHILD_ENROLL: {
    label: 'Tiếp nhận trẻ, nhập Excel, mở lại hồ sơ đã nghỉ',
    hint: 'Trẻ của điểm trường phụ trách',
    group: 'child',
  },
  CHILD_PROFILE_EDIT: {
    label: 'Sửa hồ sơ trẻ, khai báo sức khỏe',
    hint: 'Trẻ của điểm trường phụ trách',
    group: 'child',
  },
  CHILD_PLACEMENT: {
    label: 'Xếp lớp, chuyển lớp, cho trẻ nghỉ học',
    hint: 'Trẻ của điểm trường phụ trách',
    group: 'child',
  },
  STAFF_ACCOUNT_VIEW: {
    label: 'Xem danh sách, chi tiết tài khoản nhân sự',
    hint: 'Giáo viên, nhân viên bếp trong phạm vi phụ trách',
    group: 'staff',
  },
  ACCOUNT_MANAGE: {
    label: 'Tạo tài khoản, cấp lại mật khẩu tạm',
    hint: 'Tạo tài khoản cho giáo viên, nhân viên bếp; cấp lại mật khẩu tạm',
    group: 'staff',
  },
  ACCOUNT_STATUS_MANAGE: {
    label: 'Khóa / mở tài khoản nhân sự',
    hint: 'Tạm khóa hoặc mở lại quyền đăng nhập khi nhân sự thay đổi',
    group: 'staff',
  },
  STAFF_ASSIGNMENT_MANAGE: {
    label: 'Xếp lớp, phân công nơi làm việc',
    hint: 'Xếp giáo viên vào lớp, nhân viên bếp vào điểm trường; kết thúc phân công',
    group: 'staff',
  },
  PARENT_ACCOUNT_VIEW: {
    label: 'Xem tài khoản phụ huynh, liên kết với trẻ',
    hint: 'Phụ huynh của trẻ đang học trong phạm vi phụ trách',
    group: 'parent',
  },
  PARENT_ACCOUNT_MANAGE: {
    label: 'Kích hoạt, gắn/gỡ trẻ, khóa/mở tài khoản phụ huynh',
    hint: 'Kích hoạt theo SĐT, gắn hoặc gỡ liên kết trẻ, khóa/mở, cấp mật khẩu tạm',
    group: 'parent',
  },
  MEAL_COUNT_CONFIRM: {
    label: 'Xác nhận, điều chỉnh số suất ăn',
    hint: 'Số suất của điểm trường phụ trách',
    group: 'meals',
  },
  // Bán trú chia theo cấp của BE (BE:docs/business/flows/meal-management-permissions.md): danh mục, kho khô, thực đơn
  NUTRITION_MANAGE: {
    label: 'Quản lý danh mục bán trú',
    hint: 'Thực phẩm, món ăn, cấu hình nhóm tuổi, nhà cung cấp',
    group: 'meal-catalog',
  },
  STOCK_MANAGE: {
    label: 'Nhập kho khô, kiểm nhận hàng tươi',
    hint: 'Phiếu nhập kho khô, bản dự trù và kiểm nhận hàng tươi theo điểm trường',
    group: 'meal-stock',
  },
  FOOD_SAFETY_APPROVE: {
    label: 'Duyệt lưu mẫu thức ăn, duyệt hủy mẫu',
    hint: 'Theo điểm trường; Hiệu trưởng có thể nâng lên cả trường',
    group: 'meal-safety',
  },
  KITCHEN_RECORD: {
    label: 'Ghi lưu mẫu, hủy mẫu, đăng ảnh bữa ăn',
    hint: 'Tài khoản bếp chung của điểm trường',
    group: 'meal-record',
  },
  MENU_MANAGE: {
    label: 'Lập và công bố thực đơn tuần',
    hint: 'Lập, sửa kế hoạch tuần và công bố cả tuần cho cả trường',
    group: 'meal-menu',
  },
  PERMISSION_MANAGE: {
    label: 'Phân quyền toàn trường',
    hint: 'Đặt quyền theo vai trò và ngoại lệ từng người; chỉ Hiệu trưởng',
    group: 'system',
  },
};

/** Nhóm dòng bảng (cấp 2) = khóa `feature` của catalog BE; `flow` = luồng lớn (cấp 1) chứa nó. */
export const PERMISSION_FEATURES = {
  'child-profile': { label: 'Hồ sơ trẻ', group: 'child', flow: 'child' },
  staff: { label: 'Tài khoản & phân công nhân sự', group: 'staff', flow: 'staff' },
  'parent-account': { label: 'Tài khoản phụ huynh', group: 'parent', flow: 'child' },
  permission: { label: 'Phân quyền', group: 'system', flow: 'system' },
  meals: { label: 'Suất ăn', group: 'meals', flow: 'meals' },
  'meal-catalog': { label: 'Danh mục bán trú', group: 'meals', flow: 'meals' },
  'meal-stock': { label: 'Kho khô', group: 'meals', flow: 'meals' },
  'meal-menu': { label: 'Thực đơn', group: 'meals', flow: 'meals' },
  'meal-safety': { label: 'Duyệt mẫu thức ăn', group: 'meals', flow: 'meals' },
  'meal-record': { label: 'Bếp ghi lưu mẫu, ảnh bữa ăn', group: 'meals', flow: 'meals' },
};

/** Luồng lớn (cấp 1) của ma trận quyền: tick cả luồng thì mọi việc nhỏ bên trong được tick theo. */
export const PERMISSION_FLOWS = {
  child: { label: 'Hồ sơ trẻ & phụ huynh' },
  staff: { label: 'Nhân sự & phân công' },
  meals: { label: 'Bán trú' },
  system: { label: 'Phân quyền toàn trường' },
};

export const REASON_MAX_LENGTH = 500;
export const CHANGE_LOG_PAGE_SIZE = 20;
