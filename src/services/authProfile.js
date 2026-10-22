const BACKEND_ROLES = ['ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF', 'PARENT'];
const WEB_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];

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
    role: WEB_ROLES.find((role) => roles.includes(role)) || null,
    assignments,
    childIds: profile.childIds || [],
    locationIds: campusIds,
    campusId: campusIds.length === 1 ? campusIds[0] : null,
    classIds,
    classId: classIds.length === 1 ? classIds[0] : null,
    profileEditable: false,
  };
};
