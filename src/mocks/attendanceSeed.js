/*
 * Fictional attendance and meal data for the attendance module (no real child data).
 * Built relative to "today" so the demo always has a few past school days.
 * Collection: db.attendance (db.mealCounts / db.mealHandovers are derived by the repository).
 * Present children eat every meal session of their class's age group (`sessionsOf(cls)`).
 */

const PAST_DAYS = 5;
// Classes whose teachers already took today's attendance (others are still to do).
const TODAY_DONE_CLASSES = ['cls_c1_m1', 'cls_c1_l1', 'cls_c2_la'];

const pad = (n) => String(n).padStart(2, '0');
const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const isSchoolDay = (date) => ![0, 6].includes(new Date(`${date}T00:00:00`).getDay());

export const pastSchoolDays = (today, n = PAST_DAYS) => {
  const days = [];
  for (let d = addDays(today, -1); days.length < n; d = addDays(d, -1)) if (isSchoolDay(d)) days.unshift(d);
  return days;
};

const statusFor = (dayIndex, childIndex) => {
  const k = (dayIndex * 7 + childIndex * 3) % 23;
  if (k === 0) return 'EXCUSED';
  if (k === 11) return 'UNEXCUSED';
  return 'PRESENT';
};

const teacherOf = (classes, classId) => classes.find((c) => c.id === classId)?.homeroomTeacherId || null;

const attendanceRecord = ({ classes, sessionsOf }, date, dayIndex, ch, childIndex, recordedTime) => {
  const status = statusFor(dayIndex, childIndex);
  const cls = classes.find((c) => c.id === ch.classId);
  const meals = Object.fromEntries(sessionsOf(cls).map((s) => [s, status === 'PRESENT']));
  const recordedBy = teacherOf(classes, ch.classId);
  const recordedAt = new Date(`${date}T${recordedTime}:00+07:00`).toISOString();
  return {
    id: `att_${date.replace(/-/g, '')}_${ch.id}`,
    date,
    childId: ch.id,
    classId: ch.classId,
    campusId: ch.campusId,
    status,
    meals,
    recordedBy,
    recordedAt,
    history: [{ at: recordedAt, userId: recordedBy, action: 'RECORDED' }],
  };
};

/** Điểm danh demo của một ngày cho các trẻ đưa vào (thứ tự trẻ quyết định trạng thái, ổn định giữa các lần chạy). */
export const buildDayAttendance = ({ classes, children, date, sessionsOf, recordedTime = '07:55' }) =>
  children.map((ch, ci) => attendanceRecord({ classes, sessionsOf }, date, 0, ch, ci, recordedTime));

export const buildAttendanceSeed = ({ classes, children, today, sessionsOf }) => {
  const active = children.filter((ch) => ch.classId && ch.status === 'ACTIVE');
  const days = pastSchoolDays(today);
  const records = [];
  const makeRecord = (...args) => records.push(attendanceRecord({ classes, sessionsOf }, ...args));

  days.forEach((date, di) => active.forEach((ch, ci) => makeRecord(date, di + 1, ch, ci, '08:05')));
  if (isSchoolDay(today)) {
    active.filter((ch) => TODAY_DONE_CLASSES.includes(ch.classId)).forEach((ch, ci) => makeRecord(today, 0, ch, ci, '07:55'));
  }

  return { attendance: records, seededDays: days };
};

// Lịch sử mở lại ngày điểm danh (đã hết hạn) để màn Mở lại ngày có dữ liệu xem
export const buildAttendanceUnlocks = ({ classes, today }) => {
  const days = pastSchoolDays(today, 6);
  const specs = [
    {
      classId: 'cls_c1_m1',
      day: days[days.length - 2],
      by: 'u_lan',
      reason: 'Phụ huynh báo nghỉ muộn, cô cập nhật lại điểm danh và báo ăn.',
    },
    { classId: 'cls_c2_m1', day: days[1], by: 'u_duc', reason: 'Cô điểm danh nhầm trạng thái hai trẻ, cần sửa lại.' },
  ];
  return specs
    .filter((s) => classes.some((c) => c.id === s.classId))
    .map((s, n) => ({
      id: `att-unlock-seed-${n + 1}`,
      classId: s.classId,
      campusId: classes.find((c) => c.id === s.classId).campusId,
      date: s.day,
      validUntil: new Date(`${s.day}T17:00:00+07:00`).toISOString(),
      reason: s.reason,
      unlockedBy: s.by,
      unlockedAt: new Date(`${s.day}T09:30:00+07:00`).toISOString(),
    }));
};
