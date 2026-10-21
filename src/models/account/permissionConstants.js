/*
 * Danh mục demo từ UI G94-209; chưa phải contract của BE hiện tại.
 * Không dùng các mã này để thay quyền hoặc scope đang chạy.
 */

/** Mã quyền FE dùng để ẩn/hiện menu, route. Quyết định thật vẫn ở BE. */
export const PERMISSIONS = {
  CHILD_PROFILE_VIEW: 'CHILD_PROFILE_VIEW',
  ACCOUNT_MANAGE: 'ACCOUNT_MANAGE',
  ACCOUNT_STATUS_MANAGE: 'ACCOUNT_STATUS_MANAGE',
  STAFF_ASSIGNMENT_MANAGE: 'STAFF_ASSIGNMENT_MANAGE',
  PARENT_ACCOUNT_MANAGE: 'PARENT_ACCOUNT_MANAGE',
  PERMISSION_MANAGE: 'PERMISSION_MANAGE',
};

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
  PERMISSION_MANAGE: {
    label: 'Phân quyền toàn trường',
    hint: 'Đặt quyền theo vai trò và ngoại lệ từng người; chỉ Hiệu trưởng',
    group: 'system',
  },
};

/** Nhóm dòng bảng = khóa `feature` của catalog BE. */
export const PERMISSION_FEATURES = {
  'child-profile': { label: 'Hồ sơ trẻ', group: 'child' },
  staff: { label: 'Tài khoản & phân công nhân sự', group: 'staff' },
  'parent-account': { label: 'Tài khoản phụ huynh', group: 'parent' },
  permission: { label: 'Phân quyền', group: 'system' },
};

export const REASON_MAX_LENGTH = 500;
export const CHANGE_LOG_PAGE_SIZE = 20;
