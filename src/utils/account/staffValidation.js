/** Kiểm nhập liệu form nhân sự (hỗ trợ người dùng); BE kiểm lại toàn bộ (AUTH-15..17). */

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,100}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Role cần phân công campus (PHT, bếp) hay lớp (GV). */
export const assignmentTargetOf = (role) =>
  role === 'TEACHER' ? 'classroom' : ['VICE_PRINCIPAL', 'KITCHEN_STAFF'].includes(role) ? 'campus' : null;

export const validateTemporaryPassword = (password, { required = true } = {}) => {
  if (!password) return required ? 'Nhập mật khẩu tạm' : undefined;
  if (password.length < 8 || password.length > 128) return 'Mật khẩu tạm từ 8 đến 128 ký tự';
  return undefined;
};

/** assignmentRequired: người tạo là PHT (phải phân công vào campus mình). */
export const validateStaffAccount = (form, { assignmentRequired = false } = {}) => {
  const e = {};
  if (!USERNAME_PATTERN.test(form.username?.trim() || '')) e.username = 'Tên đăng nhập 3–100 ký tự: chữ, số, dấu . _ -';
  if (!form.fullName?.trim()) e.fullName = 'Nhập họ tên';
  if (form.email && !EMAIL_PATTERN.test(form.email.trim())) e.email = 'Email không hợp lệ';
  if (!form.role) e.role = 'Chọn vai trò';
  // Không có email thì hệ thống không gửi được thư đặt mật khẩu ⇒ phải giao mật khẩu tạm
  e.temporaryPassword = validateTemporaryPassword(form.temporaryPassword, { required: !form.email?.trim() }); // carenest:allow-secret
  const target = assignmentTargetOf(form.role);
  if (target === 'campus' && (assignmentRequired || form.classroomId || form.campusId) && !form.campusId) e.campusId = 'Chọn điểm trường';
  if (target === 'classroom' && (assignmentRequired || form.campusId || form.classroomId) && !form.classroomId) e.classroomId = 'Chọn lớp';
  return e;
};

export const hasErrors = (errors) => Object.values(errors).some(Boolean);
