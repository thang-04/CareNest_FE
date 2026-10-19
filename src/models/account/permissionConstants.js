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
  ON: 'Bật',
  OFF: 'Tắt',
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

/** Quyền nói bằng nghiệp vụ trường mầm non gần gũi, ẩn mã kỹ thuật tiếng Anh. */
export const PERMISSION_TASKS = {
  CHILD_PROFILE_VIEW: {
    label: 'Xem hồ sơ sức khỏe & thông tin trẻ',
    hint: 'Xem thông tin lý lịch, sức khỏe, dị ứng của trẻ trong phạm vi phân công',
    group: 'child',
  },
  ACCOUNT_MANAGE: {
    label: 'Cấp tài khoản & mật khẩu nhân viên',
    hint: 'Tạo tài khoản cho giáo viên, nhân viên bếp ở cơ sở; cấp lại mật khẩu tạm',
    group: 'staff',
  },
  ACCOUNT_STATUS_MANAGE: {
    label: 'Khóa / mở khóa tài khoản nhân viên',
    hint: 'Tạm khóa hoặc mở khóa quyền đăng nhập khi nhân sự có thay đổi',
    group: 'staff',
  },
  STAFF_ASSIGNMENT_MANAGE: {
    label: 'Xếp lớp & phân công nơi làm việc',
    hint: 'Xếp giáo viên vào lớp học, nhân viên bếp vào điểm trường phụ trách',
    group: 'staff',
  },
  PARENT_ACCOUNT_MANAGE: {
    label: 'Cấp & quản lý tài khoản phụ huynh',
    hint: 'Kích hoạt tài khoản theo SĐT, gắn liên kết trẻ, khóa/mở tài khoản phụ huynh',
    group: 'parent',
  },
  PERMISSION_MANAGE: {
    label: 'Quản lý phân quyền toàn trường',
    hint: 'Thiết lập quyền vai trò và ngoại lệ cá nhân (chỉ Hiệu trưởng)',
    group: 'system',
  },
};

export const REASON_MAX_LENGTH = 500;
export const CHANGE_LOG_PAGE_SIZE = 20;
