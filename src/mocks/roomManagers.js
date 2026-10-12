import { buildSeedSchoolConfig } from './schoolConfigSeed';

/*
 * Người phụ trách phòng (quyết định 10/10/2026): phòng loại Lớp học không lưu người phụ trách,
 * mà lấy giáo viên chủ nhiệm của lớp đang dùng phòng trong năm học đang hoạt động ("—" nếu chưa có).
 * Phòng loại khác giữ người phụ trách do Hiệu trưởng chọn. BE phải tính giống vậy.
 */
export const activeYearId = (db) => (db.schoolYears || buildSeedSchoolConfig().schoolYears).find((y) => y.status === 'ACTIVE')?.id || null;

/** Locations with the effective person in charge (`managerUserId`), plus `managerFromClass` / `managerClassId` for classrooms. */
export const withRoomManagers = (db) => {
  const year = activeYearId(db);
  return (db.locations || []).map((l) => {
    if (l.type !== 'CLASS') return l;
    const cls = (db.classes || []).find((c) => c.schoolYear === year && c.locationId === l.id);
    return { ...l, managerUserId: cls?.homeroomTeacherId || null, managerFromClass: true, managerClassId: cls?.id || null };
  });
};

export const findRoom = (db, id) => withRoomManagers(db).find((l) => l.id === id) || null;
