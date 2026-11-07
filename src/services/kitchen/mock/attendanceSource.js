import { buildSeedSchoolConfig } from '@/mocks/schoolConfigSeed';
import { MEAL_SESSIONS, orderSessions } from '@/models/attendance/attendanceConstants';

export const activeKitchenClasses = (db, campusId) => {
  const years = db.schoolYears || buildSeedSchoolConfig().schoolYears;
  const activeYear = years.find((year) => year.status === 'ACTIVE')?.id;
  return (db.classes || []).filter(
    (cls) => (!campusId || cls.campusId === campusId) && (!activeYear || !cls.schoolYear || cls.schoolYear === activeYear),
  );
};

export const classMealSessions = (db, cls) => {
  const groups = db.ageGroups || buildSeedSchoolConfig().ageGroups;
  return orderSessions(groups.find((group) => group.id === cls.ageGroupId)?.mealSessions);
};

export const mealSessionsForCampus = (db, campusId) => {
  const sessions = new Set(activeKitchenClasses(db, campusId).flatMap((cls) => classMealSessions(db, cls)));
  // Sổ báo ăn từ BE (dev): điểm trường BE không có lớp trong CSDL mock, lấy bữa theo sổ đã đồng bộ
  (db.mealCounts || []).filter((m) => m.source === 'BE' && m.campusId === campusId).forEach((m) => sessions.add(m.session));
  return MEAL_SESSIONS.filter((session) => sessions.has(session));
};
