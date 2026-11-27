/* Hiển thị từ dữ liệu BE: giáo viên bị khóa tài khoản (lockedTeacherIds) không tính là còn đứng lớp. */
export const isLocked = (cls, teacherId) => !!cls.lockedTeacherIds?.includes(teacherId);

export const workingTeacherCount = (cls) => cls.teacherIds.filter((id) => !isLocked(cls, id)).length;
