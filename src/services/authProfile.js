const BACKEND_ROLES = ['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF', 'PARENT'];
// Token Web chỉ mang role nhân sự (ADR-0022); bếp/phụ huynh bị BE chặn 403 1101. ADMIN xếp cuối vì Web chưa có màn riêng
const WEB_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'ADMIN'];
// Tổ trưởng không phải role đăng nhập: GV có phân công AGE_GROUP_TEAM_LEADER đang hiệu lực (AUTH-23)
const TEAM_LEADER_ASSIGNMENT = 'AGE_GROUP_TEAM_LEADER';

const webRoleOf = (roles, assignments) => {
  const role = WEB_ROLES.find((r) => roles.includes(r)) || null;
  return role === 'TEACHER' && assignments.some((a) => a.staffRole === TEAM_LEADER_ASSIGNMENT) ? 'TEAM_LEADER' : role;
};

export const normalizeAccountProfile = (profile) => {
  if (profile?.userId == null || !Array.isArray(profile.roles)) {
    const error = new Error('Thông tin tài khoản chưa đầy đủ. Vui lòng thử lại.');
    error.status = 503;
    throw error;
  }
  const roles = [...new Set(profile.roles.filter((role) => BACKEND_ROLES.includes(role)))];
  const assignments = (profile.assignments || []).map((assignment, index) => ({
    ...assignment,
    key: [assignment.staffRole, assignment.campusId, assignment.classroomId, assignment.validFrom, index].join(':'),
  }));
  const campusIds = [...new Set(assignments.filter((a) => a.campusId != null).map((a) => String(a.campusId)))];
  const classIds = [...new Set(assignments.filter((a) => a.classroomId != null).map((a) => String(a.classroomId)))];
  return {
    id: String(profile.userId),
    userId: profile.userId,
    username: profile.username,
    fullName: profile.fullName,
    email: profile.email,
    roles,
    // Quyền hiệu lực BE tính (ADR-0017); chỉ dùng ẩn/hiện UI, BE vẫn kiểm từng API
    permissions: Array.isArray(profile.permissions) ? [...new Set(profile.permissions)] : [],
    role: webRoleOf(roles, assignments),
    assignments,
    ageGroupId: assignments.find((a) => a.staffRole === TEAM_LEADER_ASSIGNMENT && a.ageGroupId != null)?.ageGroupId ?? null,
    childIds: profile.childIds || [],
    locationIds: campusIds,
    campusId: campusIds.length === 1 ? campusIds[0] : null,
    classIds,
    classId: classIds.length === 1 ? classIds[0] : null,
    profileEditable: false,
  };
};
