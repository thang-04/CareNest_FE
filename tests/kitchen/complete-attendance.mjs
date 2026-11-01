import { writeDb } from '@/mocks/mockDatabase';

// NUT-02: xác nhận sổ báo ăn bị chặn khi cơ sở–ngày còn trẻ chưa điểm danh ⇒ test bếp ghi đủ điểm danh (Có mặt) trước khi chốt.
export const completeAttendance = ({ campusId, date }) =>
  writeDb((db) => {
    const classIds = new Set(db.classes.filter((c) => c.campusId === campusId).map((c) => c.id));
    db.children
      .filter((ch) => ch.status === 'ACTIVE' && classIds.has(ch.classId))
      .filter((ch) => !db.attendance.some((r) => r.childId === ch.id && r.date === date))
      .forEach((ch) =>
        db.attendance.push({
          id: `att_test_${date}_${ch.id}`,
          date,
          childId: ch.id,
          classId: ch.classId,
          campusId,
          status: 'PRESENT',
          meals: {},
          recordedBy: null,
          recordedAt: `${date}T01:00:00.000Z`,
          history: [],
        }),
      );
  });
