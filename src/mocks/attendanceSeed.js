/*
 * Fictional attendance and meal data for the attendance module (no real child data).
 * Built relative to "today" so the demo always has a few past school days.
 * Collections: db.attendance, db.childMealPlans (db.mealCounts / db.mealHandovers are derived by the repository).
 */

const SESSIONS = ['LUNCH', 'AFTERNOON'];
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

/** The third child of each class eats once a day (lunch only) – used by the meal session screen (#65). */
const buildMealPlans = (children) => {
  const byClass = {};
  children.forEach((ch) => {
    if (!ch.classId || ch.status !== 'ACTIVE') return;
    byClass[ch.classId] = [...(byClass[ch.classId] || []), ch];
  });
  return Object.values(byClass)
    .map((list) => list[2])
    .filter(Boolean)
    .map((ch) => ({ childId: ch.id, mealsPerDay: 1, defaultSession: 'LUNCH', note: 'Phụ huynh đăng ký ăn 1 bữa/ngày' }));
};

const statusFor = (dayIndex, childIndex) => {
  const k = (dayIndex * 7 + childIndex * 3) % 23;
  if (k === 0) return 'EXCUSED';
  if (k === 11) return 'UNEXCUSED';
  return 'PRESENT';
};

const teacherOf = (classes, classId) => classes.find((c) => c.id === classId)?.homeroomTeacherId || null;

export const buildAttendanceSeed = ({ classes, children, today }) => {
  const mealPlans = buildMealPlans(children);
  const onceADay = Object.fromEntries(mealPlans.map((p) => [p.childId, p]));
  const active = children.filter((ch) => ch.classId && ch.status === 'ACTIVE');
  const days = pastSchoolDays(today);
  const records = [];

  const makeRecord = (date, dayIndex, ch, childIndex, recordedTime) => {
    const status = statusFor(dayIndex, childIndex);
    const plan = onceADay[ch.id];
    const meals = Object.fromEntries(SESSIONS.map((s) => [s, status === 'PRESENT' && (!plan || s === plan.defaultSession)]));
    const recordedBy = teacherOf(classes, ch.classId);
    const recordedAt = new Date(`${date}T${recordedTime}:00+07:00`).toISOString();
    records.push({
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
    });
  };

  days.forEach((date, di) => active.forEach((ch, ci) => makeRecord(date, di + 1, ch, ci, '08:05')));
  if (isSchoolDay(today)) {
    active.filter((ch) => TODAY_DONE_CLASSES.includes(ch.classId)).forEach((ch, ci) => makeRecord(today, 0, ch, ci, '07:55'));
  }

  return { attendance: records, childMealPlans: mealPlans, seededDays: days };
};
