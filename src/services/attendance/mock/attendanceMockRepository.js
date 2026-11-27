import { readDb, writeDb, clone, delay, ApiError, needsMockSeedMigration } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { buildAttendanceSeed, buildAttendanceUnlocks, buildDayAttendance } from '@/mocks/attendanceSeed';
import { AGE_GROUP_EXTRA } from '@/mocks/schoolConfigSeed';
import { activeYearEnd, activeYearId, activeYearStart } from '@/mocks/roomManagers';
import { ROLES } from '@/models/User';
import {
  ATTENDANCE_STATUS,
  DEFAULT_CUTOFF_TIME,
  HANDOVER_STATUS,
  MEAL_COUNT_STATUS,
  MEAL_SESSIONS,
  MEAL_SESSION_LABELS,
  allMeals,
  eatsAny,
  isAbsent,
  mealsIn,
  needsSubstitute,
  orderSessions,
  LEAVE_PART,
  sessionsAfterLeave,
} from '@/models/attendance/attendanceConstants';
import { MEAL_SESSIONS as KITCHEN_SESSIONS } from '@/models/kitchen/kitchenConstants';
import {
  canConfirmMealCount,
  canRecordAttendance,
  canUnlockAttendanceDay,
  canReceiveHandover,
  canSupplementHandover,
  canViewAttendance,
  canViewHandover,
  canViewMealCount,
  canViewMealCounts,
  canOpenMealHandover,
} from '@/utils/attendance/attendancePermissions';
import { validateClassAttendance, validateHandoverCheck, validateSummaryRange } from '@/utils/attendance/attendanceValidation';
import { isDayLocked, isSchoolDay, isValidTime, schoolDaysBetween, schoolNow } from '@/utils/attendance/attendanceTime';
import { formatDate, isIsoDate } from '@/utils/format';
import { isAttendanceUnlockActive } from '@/utils/attendance/attendanceUnlock';
import { uid } from '@/utils/id';
import { dailyHealthSummary } from '@/mocks/dailyHealthSummary';
import { kidAvatar } from '@/mocks/kidAvatars';

/*
 * Fake backend for attendance, meal participation, meal counts and meal handover.
 * Business rules that the Spring Boot backend must re-implement live here:
 *  - lock at the configured cut-off (GBR-ATT-02/04/08), absent => no meal (GBR-ATT-03);
 *  - ATT-02: present defaults to every meal session of the class's age group; the teacher may turn participation off;
 *  - ATT-09: "Vắng có phép" only comes from a parent's leave request; the teacher cannot send EXCUSED without one;
 *  - meal count aggregated per campus/date/session at the cut-off (GBR-ATT-07), confirmed by the VP only (GBR-ATT-06);
 *  - NUT-02: confirm is blocked while a class of the campus-day still has children not marked; only the substitute
 *    servings can be adjusted by hand and attendance changes keep that adjustment;
 *  - NUT-03: changes after confirmation go to "needs reconfirmation" instead of silently changing confirmed figures;
 *  - meal handover per class: confirm or report shortage, kitchen supplements (UC 6.26).
 * The "scheduled job" at the cut-off is emulated lazily: counts are built the first time a locked day is read.
 */

const forbidden = () => new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.');
const lockedError = (cutoff) => new ApiError(423, `Điểm danh và báo ăn đã khóa sau ${cutoff}.`);

/** School configuration (#19) owns the cut-off; tolerate the shapes another module may store. */
export const readCutoff = (db) => {
  const s = db.cutoffSettings;
  const candidates = Array.isArray(s)
    ? [...s].reverse().map((x) => x?.time || x?.cutoffTime)
    : [s?.time, s?.cutoffTime, s?.attendanceCutoff, typeof s === 'string' ? s : null];
  return candidates.find(isValidTime) || DEFAULT_CUTOFF_TIME;
};

/** Kitchen readiness comes from the meal preparation module (#98) when it exists. */
const kitchenReady = (db, campusId, date, session) => {
  // Bếp chưa theo dõi chế biến bữa phụ sáng: không chặn bàn giao bữa đó
  if (!Array.isArray(db.mealPreparations) || !KITCHEN_SESSIONS.includes(session)) return true;
  return db.mealPreparations.some(
    (p) => p.campusId === campusId && p.date === date && p.session === session && ['READY_FOR_HANDOVER', 'READY'].includes(p.status),
  );
};

const usersOf = (db, role, campusId) => (db.users || []).filter((u) => u.role === role && u.campusId === campusId);
const notifyAll = (db, users, payload) => users.forEach((u) => pushNotification(db, { ...payload, userId: u.id }));

const activeChildrenOf = (db, classId) => db.children.filter((ch) => ch.classId === classId && ch.status === 'ACTIVE');
// Chỉ lớp của năm học đang hoạt động được điểm danh và tính suất ăn (lớp năm cũ chỉ còn xem)
const currentClasses = (db) => db.classes.filter((c) => c.schoolYear === activeYearId(db));
const campusIds = (db) => [...new Set(currentClasses(db).map((c) => c.campusId))];
const findClass = (db, id) => {
  const cls = db.classes.find((c) => c.id === id);
  if (!cls) throw new ApiError(404, 'Không tìm thấy lớp');
  return cls;
};
/** Meal sessions of a class = those the Principal configured for its age group. */
const classSessions = (db, cls) => {
  const group = (db.ageGroups || []).find((g) => g.id === cls?.ageGroupId) || AGE_GROUP_EXTRA[cls?.ageGroupId];
  return orderSessions(group?.mealSessions);
};
const campusSessions = (db, campusId) =>
  MEAL_SESSIONS.filter((s) => currentClasses(db).some((c) => c.campusId === campusId && classSessions(db, c).includes(s)));
const recordOf = (db, childId, date) => db.attendance.find((r) => r.childId === childId && r.date === date);
const leaveOf = (db, childId, date) =>
  (db.leaveRequests || []).find(
    (leave) => leave.childId === childId && leave.status === 'SUBMITTED' && leave.fromDate <= date && leave.toDate >= date,
  );

/** Đơn báo nghỉ phủ `today` sẽ được ghi thành điểm danh; ready() dùng cùng điều kiện để không ghi DB lặp mỗi lần đọc. */
const leavesToRecord = (db, today) => {
  if (!isSchoolDay(today)) return [];
  return (db.leaveRequests || []).flatMap((leave) => {
    if (leave.status !== 'SUBMITTED' || leave.fromDate > today || leave.toDate < today) return [];
    const child = db.children.find((ch) => ch.id === leave.childId && ch.status === 'ACTIVE');
    if (!child || recordOf(db, child.id, today)) return [];
    // Luồng sau khóa chưa có contract: không âm thầm sửa sĩ số đã tổng hợp.
    if (db.mealCounts.some((count) => count.campusId === child.campusId && count.date === today)) return [];
    return [{ leave, child }];
  });
};

const ensureLeaveDemo = (db) => {
  const today = schoolNow().date;
  if (!db.leaveRequests) {
    // Ví dụ báo nghỉ giả lập một lần; không tạo lại đơn đã hủy hoặc ghi đè điểm danh của cô.
    db.leaveRequests = currentClasses(db).flatMap((cls) => {
      if (db.mealCounts.some((count) => count.campusId === cls.campusId && count.date === today)) return [];
      const child = activeChildrenOf(db, cls.id)
        .filter((ch) => !recordOf(db, ch.id, today))
        .at(-1);
      return child
        ? [
            {
              id: `leave-demo-${child.id}-${today}`,
              childId: child.id,
              fromDate: today,
              toDate: today,
              status: 'SUBMITTED',
              reason: 'Gia đình báo nghỉ trong ngày (dữ liệu demo).',
              submittedAt: `${today}T07:00:00+07:00`,
            },
          ]
        : [];
    });
  }
  leavesToRecord(db, today).forEach(({ leave, child }) => {
    // ATT-13: nghỉ chiều ⇒ GV điểm danh buổi sáng như thường, không tạo bản ghi
    if (leave.part === LEAVE_PART.AFTERNOON) return;
    const cls = db.classes.find((c) => c.id === child.classId);
    const xe = sessionsAfterLeave(leave.part, cls ? classSessions(db, cls) : []);
    db.attendance.push({
      id: uid('att'),
      childId: child.id,
      classId: child.classId,
      campusId: child.campusId,
      date: today,
      status: ATTENDANCE_STATUS.EXCUSED,
      // Nghỉ sáng: bữa xế theo công tắc ăn của đơn
      meals:
        leave.part === LEAVE_PART.MORNING
          ? { ...allMeals(false), ...allMeals(leave.eats !== false && child.mealRegistered !== false, xe) }
          : allMeals(false),
      ...(leave.part === LEAVE_PART.MORNING ? { absentPart: 'MORNING' } : {}),
      recordedBy: null,
      recordedAt: leave.submittedAt,
      leaveRequestId: leave.id,
      history: [{ at: leave.submittedAt, userId: null, action: 'PARENT_LEAVE', leaveRequestId: leave.id }],
    });
  });
  return db;
};

/** Totals of one class for a date and meal session, built from the saved meal participation. */
const classLine = (db, cls, date, session) => {
  const line = { classId: cls.id, className: cls.name, present: 0, absent: 0, missing: 0, normal: 0, substitute: 0 };
  activeChildrenOf(db, cls.id).forEach((ch) => {
    const rec = recordOf(db, ch.id, date);
    if (!rec) line.missing += 1;
    else if (isAbsent(rec.status)) line.absent += 1;
    else {
      line.present += 1;
      if (rec.meals?.[session]) line[needsSubstitute(ch) ? 'substitute' : 'normal'] += 1;
    }
  });
  return line;
};

const buildCount = (db, campusId, date, session) => {
  const classes = currentClasses(db)
    .filter((c) => c.campusId === campusId && classSessions(db, c).includes(session))
    .map((c) => classLine(db, c, date, session));
  return { campusId, date, session, classes };
};

// NUT-02: suất thay thế PHT đã điều chỉnh không bị điểm danh ghi đè
const withSubstituteOverrides = (count, classes) =>
  classes.map((line) =>
    count.substituteOverrides && line.classId in count.substituteOverrides
      ? { ...line, substitute: count.substituteOverrides[line.classId] }
      : line,
  );

const withTotals = (count) => ({
  ...count,
  totals: count.classes.reduce(
    (t, l) => ({
      normal: t.normal + l.normal,
      substitute: t.substitute + l.substitute,
      present: t.present + l.present,
      absent: t.absent + l.absent,
      missing: t.missing + l.missing,
    }),
    { normal: 0, substitute: 0, present: 0, absent: 0, missing: 0 },
  ),
});

const mealCountForUser = (count, user) => {
  const { pendingClasses, ...stored } = count;
  const reviewing = pendingClasses && user?.role !== ROLES.KITCHEN_STAFF;
  return withTotals({
    ...stored,
    ...(reviewing ? { classes: pendingClasses, status: MEAL_COUNT_STATUS.PENDING_CONFIRMATION } : {}),
  });
};

/** Emulates the cut-off job: lock + aggregate, then ask the campus VP to confirm. */
const materializeCounts = (db, date, { notify = true, force = false } = {}) => {
  const cutoff = readCutoff(db);
  if (!isSchoolDay(date) || (!force && !isDayLocked(date, cutoff))) return;
  campusIds(db).forEach((campusId) => {
    let created = false;
    campusSessions(db, campusId).forEach((session) => {
      if (db.mealCounts.some((m) => m.campusId === campusId && m.date === date && m.session === session)) return;
      const at = new Date().toISOString();
      db.mealCounts.push({
        id: uid('mc'),
        ...buildCount(db, campusId, date, session),
        status: MEAL_COUNT_STATUS.PENDING_CONFIRMATION,
        aggregatedAt: at,
        confirmedBy: null,
        confirmedAt: null,
        adjustments: [],
        history: [{ at, userId: null, action: 'AGGREGATED', note: `Tự động tổng hợp lúc ${cutoff}` }],
      });
      created = true;
    });
    if (created && notify) {
      notifyAll(db, usersOf(db, ROLES.VICE_PRINCIPAL, campusId), {
        type: 'MEAL_COUNT',
        title: 'Sĩ số suất ăn chờ xác nhận',
        message: `Sĩ số suất ăn ngày ${formatDate(date)} đã khóa lúc ${cutoff}, chờ bạn xác nhận.`,
        link: `/attendance/meal-count?date=${date}`,
      });
    }
  });
};

const createHandovers = (db, count) => {
  count.classes.forEach((line) => {
    if (db.mealHandovers.some((h) => h.classId === line.classId && h.date === count.date && h.session === count.session)) return;
    db.mealHandovers.push({
      id: uid('mh'),
      date: count.date,
      session: count.session,
      classId: line.classId,
      className: line.className,
      campusId: count.campusId,
      mealCountId: count.id,
      expected: { normal: line.normal, substitute: line.substitute },
      received: null,
      shortage: null,
      status: HANDOVER_STATUS.READY,
      confirmedBy: null,
      confirmedAt: null,
      history: [],
    });
  });
};

const confirmCountIn = (db, count, userId, at, role = ROLES.VICE_PRINCIPAL) => {
  count.status = MEAL_COUNT_STATUS.CONFIRMED;
  count.confirmedBy = userId;
  count.confirmedByRole = role === ROLES.PRINCIPAL ? 'PRINCIPAL' : 'VICE_PRINCIPAL';
  count.confirmedAt = at;
  count.history.push({ at, userId, action: 'CONFIRMED' });
  createHandovers(db, count);
};

const HANDOVER_TIME = { MORNING: '08:50', LUNCH: '10:40', AFTERNOON: '14:40' };

/** Xác nhận một bữa (kể cả xác nhận lại sau khi số đổi) rồi báo bếp. */
const confirmOneIn = (db, id, user) => {
  const count = db.mealCounts.find((m) => m.id === id);
  if (!count) throw new ApiError(404, 'Không tìm thấy sĩ số suất ăn');
  if (!canViewMealCount(count, user)) throw forbidden();
  if (count.status === MEAL_COUNT_STATUS.CONFIRMED && !count.needsReconfirmation)
    throw new ApiError(409, 'Sĩ số suất ăn này đã được xác nhận.');
  if (!canConfirmMealCount(mealCountForUser(count, user), user)) throw forbidden();
  // NUT-02: chặn xác nhận khi còn lớp trong cơ sở–ngày có trẻ chưa điểm danh
  const incomplete = [
    ...new Set(
      db.mealCounts
        .filter((m) => m.campusId === count.campusId && m.date === count.date)
        .flatMap((m) => buildCount(db, m.campusId, m.date, m.session).classes)
        .filter((line) => line.missing > 0)
        .map((line) => line.className),
    ),
  ];
  if (incomplete.length)
    throw new ApiError(
      409,
      `Chưa xác nhận được: lớp ${incomplete.join(', ')} còn trẻ chưa điểm danh. Liên hệ giáo viên điểm danh đủ trước.`,
    );
  if (count.pendingClasses) {
    if (count.confirmedAt) {
      count.confirmedSnapshots ||= [];
      count.confirmedSnapshots.push({ classes: clone(count.classes), confirmedAt: count.confirmedAt, confirmedBy: count.confirmedBy });
    }
    count.classes = clone(count.pendingClasses);
    delete count.pendingClasses;
    count.needsReconfirmation = false;
    count.classes.forEach((line) => {
      const handover = db.mealHandovers.find(
        (row) => row.classId === line.classId && row.date === count.date && row.session === count.session,
      );
      if (!handover || handover.status !== HANDOVER_STATUS.READY) return;
      if (handover.expected.normal === line.normal && handover.expected.substitute === line.substitute) return;
      handover.history.push({
        at: new Date().toISOString(),
        userId: user.id,
        action: 'EXPECTED_RECONFIRMED',
        previousExpected: clone(handover.expected),
      });
      handover.expected = { normal: line.normal, substitute: line.substitute };
    });
  }
  confirmCountIn(db, count, user.id, new Date().toISOString(), user.role);
  const total = count.classes.reduce((t, l) => t + l.normal + l.substitute, 0);
  notifyAll(db, usersOf(db, ROLES.KITCHEN_STAFF, count.campusId), {
    type: 'MEAL_COUNT',
    title: 'Sĩ số suất ăn đã xác nhận',
    message: `${MEAL_SESSION_LABELS[count.session]} ngày ${formatDate(count.date)}: ${total} suất. Xem chi tiết theo lớp.`,
    link: `/attendance/meal-count?date=${count.date}`,
  });
  return count;
};

// Databases saved before this module existed get demo data once.
const ensureSeeded = (db) => {
  db.attendanceDayUnlocks ||= [];
  db.mealCounts ||= [];
  db.mealHandovers ||= [];
  if (db.attendance) return db;
  const seed = buildAttendanceSeed({
    classes: db.classes,
    children: db.children,
    today: schoolNow().date,
    sessionsOf: (cls) => classSessions(db, cls),
  });
  db.attendance ||= clone(seed.attendance);
  // Past demo days are already confirmed by the VP and handed over to every class.
  seed.seededDays.forEach((date) => {
    materializeCounts(db, date, { notify: false });
    db.mealCounts
      .filter((m) => m.date === date && m.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION)
      .forEach((m) => {
        const vp = usersOf(db, ROLES.VICE_PRINCIPAL, m.campusId)[0];
        confirmCountIn(db, m, vp?.id || null, new Date(`${date}T09:05:00+07:00`).toISOString());
      });
    db.mealHandovers
      .filter((h) => h.date === date && h.status === HANDOVER_STATUS.READY)
      .forEach((h) => {
        const cls = db.classes.find((c) => c.id === h.classId);
        const at = new Date(`${date}T${HANDOVER_TIME[h.session] || '14:40'}:00+07:00`).toISOString();
        Object.assign(h, {
          status: HANDOVER_STATUS.CONFIRMED,
          received: { ...h.expected },
          confirmedBy: cls?.homeroomTeacherId,
          confirmedAt: at,
        });
        h.history.push({ at, userId: cls?.homeroomTeacherId, action: 'CONFIRMED' });
      });
  });
  return db;
};

// Demo: hôm nay có sẵn điểm danh mẫu cho các lớp (trừ Chồi 1 của giáo viên demo để tự điểm danh). Số suất chạy như thật
// (Cần chốt 21/10/2026, thay cách "xác nhận sẵn" ngày 20/10): trước giờ chốt là sổ tạm tính, tới giờ chốt mới tổng hợp,
// PHT điểm trường bấm xác nhận thì bếp mới nhận số (NUT-02).
const DEMO_OPEN_CLASSES = ['cls_c1_c1'];
// Chạy một lần mỗi ngày (todayMealDemoDate)
const ensureDemoToday = (db) => {
  const today = schoolNow().date;
  db.todayMealDemoDate = today;
  if (!isSchoolDay(today) || db.mealCounts.some((m) => m.date === today)) return db;
  const missing = currentClasses(db)
    .filter((cls) => !DEMO_OPEN_CLASSES.includes(cls.id))
    .flatMap((cls) => activeChildrenOf(db, cls.id))
    .filter((ch) => !recordOf(db, ch.id, today));
  db.attendance.push(
    ...buildDayAttendance({ classes: db.classes, children: missing, date: today, sessionsOf: (cls) => classSessions(db, cls) }),
  );
  return db;
};

// Lớp để giáo viên tự điểm danh vẫn luôn có một trẻ có mặt hôm nay, để thử các màn cần trẻ đã đến lớp (kể cả sau giờ chốt).
// Như leavesToRecord: bỏ qua campus đã tổng hợp suất ăn hôm nay; ready() dùng cùng điều kiện để không ghi DB lặp.
const demoPresentToRecord = (db, today) => {
  if (!isSchoolDay(today)) return [];
  return currentClasses(db)
    .filter((cls) => DEMO_OPEN_CLASSES.includes(cls.id))
    .filter((cls) => !db.mealCounts.some((count) => count.campusId === cls.campusId && count.date === today))
    .filter((cls) => !db.attendance.some((r) => r.classId === cls.id && r.date === today && r.status === ATTENDANCE_STATUS.PRESENT))
    .map((cls) => activeChildrenOf(db, cls.id).find((ch) => !recordOf(db, ch.id, today) && !leaveOf(db, ch.id, today)))
    .filter(Boolean);
};

const ensureDemoPresent = (db, today) => {
  db.attendance.push(
    ...buildDayAttendance({
      classes: db.classes,
      children: demoPresentToRecord(db, today),
      date: today,
      sessionsOf: (cls) => classSessions(db, cls),
      status: ATTENDANCE_STATUS.PRESENT,
    }),
  );
  return db;
};

const ready = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (!db.attendance || !db.mealCounts || !db.mealHandovers) writeDb(ensureSeeded);
  const current = readDb();
  if (!current.leaveRequests || leavesToRecord(current, schoolNow().date).length) writeDb(ensureLeaveDemo);
  if (needsMockSeedMigration(readDb(), 'attendanceUnlocks', 1, ['attendanceDayUnlocks']))
    writeDb((d) => {
      const has = new Set(d.attendanceDayUnlocks.map((u) => u.id));
      d.attendanceDayUnlocks.push(...buildAttendanceUnlocks({ classes: d.classes, today: schoolNow().date }).filter((u) => !has.has(u.id)));
      d.mockSeedVersions = { ...(d.mockSeedVersions || {}), attendanceUnlocks: 1 };
    });
  // Một lần: bỏ sổ hôm nay mà bản demo cũ đã tự tổng hợp + xác nhận trước giờ chốt, để hôm nay chạy như thật
  if (needsMockSeedMigration(readDb(), 'todayMealReal', 1, ['mealCounts']))
    writeDb((d) => {
      const now = schoolNow();
      if (!isDayLocked(now.date, readCutoff(d))) {
        const forced = (d.mealCounts || []).filter((m) => m.date === now.date).map((m) => m.id);
        d.mealCounts = (d.mealCounts || []).filter((m) => !forced.includes(m.id));
        d.mealHandovers = (d.mealHandovers || []).filter((h) => !(h.date === now.date && h.status === HANDOVER_STATUS.READY));
      }
      d.mockSeedVersions = { ...(d.mockSeedVersions || {}), todayMealReal: 1 };
    });
  const today = schoolNow().date;
  if (isSchoolDay(today) && readDb().todayMealDemoDate !== today) writeDb(ensureDemoToday);
  if (demoPresentToRecord(readDb(), today).length) writeDb((d) => ensureDemoPresent(d, today));
  return readDb();
};

/** Locked school days that have no meal count yet get one (lazy cut-off job). */
const readyFor = (date) => {
  let db = ready();
  const cutoff = readCutoff(db);
  const missing =
    isSchoolDay(date) &&
    isDayLocked(date, cutoff) &&
    campusIds(db).some((c) =>
      campusSessions(db, c).some((s) => !db.mealCounts.some((m) => m.campusId === c && m.date === date && m.session === s)),
    );
  if (missing) {
    writeDb((d) => materializeCounts(ensureSeeded(d), date));
    db = readDb();
  }
  return db;
};

const unlockView = (db, unlock) => ({
  ...unlock,
  className: db.classes.find((cls) => cls.id === unlock.classId)?.name || '—',
  unlockedByName: db.users.find((user) => user.id === unlock.unlockedBy)?.fullName || '—',
  revokedByName: unlock.revokedBy ? db.users.find((user) => user.id === unlock.revokedBy)?.fullName || '—' : null,
});
const activeUnlockOf = (db, classId, date) =>
  (db.attendanceDayUnlocks || []).find((unlock) => unlock.classId === classId && unlock.date === date && isAttendanceUnlockActive(unlock));

const dayInfo = (db, date, cls) => {
  const cutoff = readCutoff(db);
  const now = schoolNow();
  const baseLocked = isDayLocked(date, cutoff, now);
  const unlock = cls && baseLocked && cls.schoolYear === activeYearId(db) ? activeUnlockOf(db, cls.id, date) : null;
  return {
    date,
    today: now.date,
    now: now.time,
    cutoff,
    yearStart: activeYearStart(db),
    yearEnd: activeYearEnd(db),
    schoolDay: isSchoolDay(date),
    baseLocked,
    serverTime: new Date().toISOString(),
    locked: baseLocked && !unlock,
    unlock: unlock ? unlockView(db, unlock) : null,
  };
};

// photoUrl: ảnh hồ sơ trẻ (demo dùng ảnh minh họa, không dùng ảnh thật)
const childView = (ch) => ({
  id: ch.id,
  code: ch.code,
  fullName: ch.fullName,
  gender: ch.gender,
  // CHD-13: bếp không tính dị ứng của trẻ không báo ăn
  allergies: ch.mealRegistered === false ? [] : ch.allergies || [],
  mealRegistered: ch.mealRegistered !== false,
  hasAllergy: ch.mealRegistered !== false && (ch.allergies || []).length > 0,
  photoUrl: ch.photoUrl || kidAvatar(ch),
});

/** Tổng hợp một lớp trong khoảng ngày (dùng cho #66 một lớp và cộng nhiều lớp). */
const classSummary = (db, cls, from, to) => {
  const classId = cls.id;
  const children = activeChildrenOf(db, classId);
  const sessions = classSessions(db, cls);
  const days = schoolDaysBetween(from, to).filter((d) => d <= schoolNow().date);
  const perChild = Object.fromEntries(
    children.map((ch) => [
      ch.id,
      {
        child: childView(ch),
        present: 0,
        excused: 0,
        unexcused: 0,
        meals: 0,
        // ATT-14: ngày có mặt quy đổi (nửa buổi 0,5), số ngày ăn từng bữa, số ngày nghỉ sáng / chiều
        attendedDays: 0,
        mealCounts: {},
        morningOff: 0,
        afternoonOff: 0,
      },
    ]),
  );
  const records = new Map(
    db.attendance
      .filter((record) => record.classId === classId && record.date >= from && record.date <= to)
      .map((record) => [`${record.childId}:${record.date}`, record]),
  );
  const rows = days.map((date) => {
    const row = {
      date,
      present: 0,
      excused: 0,
      unexcused: 0,
      missing: 0,
      substitute: 0,
      mealTotal: 0,
      meals: allMeals(0, sessions),
      morningOff: 0,
      afternoonOff: 0,
    };
    children.forEach((ch) => {
      const rec = records.get(`${ch.id}:${date}`);
      if (!rec) {
        row.missing += 1;
        return;
      }
      const key = rec.status === ATTENDANCE_STATUS.PRESENT ? 'present' : rec.status === ATTENDANCE_STATUS.EXCUSED ? 'excused' : 'unexcused';
      row[key] += 1;
      perChild[ch.id][key] += 1;
      if (rec.status === ATTENDANCE_STATUS.PRESENT) perChild[ch.id].attendedDays += rec.absentPart ? 0.5 : 1;
      if (rec.absentPart) {
        const off = rec.absentPart === 'MORNING' ? 'morningOff' : 'afternoonOff';
        row[off] += 1;
        perChild[ch.id][off] += 1;
      }
      const participates = (rec.status === ATTENDANCE_STATUS.PRESENT || rec.absentPart === 'MORNING') && eatsAny(rec.meals, sessions);
      if (participates) {
        row.mealTotal += 1;
        perChild[ch.id].meals += 1;
        if (needsSubstitute(ch)) row.substitute += 1;
      }
      Object.entries(mealsIn(rec.meals, sessions)).forEach(([session, eats]) => {
        if (!eats) return;
        row.meals[session] += 1;
        perChild[ch.id].mealCounts[session] = (perChild[ch.id].mealCounts[session] || 0) + 1;
      });
    });
    return row;
  });
  return {
    classId,
    className: cls.name,
    campusId: cls.campusId,
    mealSessions: sessions,
    from,
    to,
    size: children.length,
    days: rows,
    children: Object.values(perChild).sort((a, b) => a.child.fullName.localeCompare(b.child.fullName, 'vi')),
  };
};

const decorateHandover = (db, h) => {
  const status =
    h.status === HANDOVER_STATUS.READY && !kitchenReady(db, h.campusId, h.date, h.session) ? HANDOVER_STATUS.WAITING_KITCHEN : h.status;
  return { ...clone(h), status };
};

export const attendanceMockRepository = {
  async getDayInfo(date, classId, user) {
    await delay(60);
    const db = ready();
    const cls = classId ? findClass(db, classId) : null;
    if (cls && !canViewAttendance(cls, user)) throw forbidden();
    return dayInfo(db, date || schoolNow().date, cls);
  },

  /** ATT-05 (BE giả): đơn nghỉ trong khoảng ngày của các lớp người dùng xem được; ATT-12 kèm buổi nghỉ và công tắc ăn. */
  async searchLeaveRequests({ from, to, campusId, classId } = {}, user) {
    await delay(120);
    const db = ready();
    const classes = currentClasses(db).filter(
      (c) => canViewAttendance(c, user) && (!campusId || c.campusId === campusId) && (!classId || c.id === classId),
    );
    const byId = Object.fromEntries(classes.map((c) => [c.id, c]));
    return (db.leaveRequests || [])
      .map((leave) => ({ leave, child: db.children.find((ch) => ch.id === leave.childId) }))
      .filter(({ leave, child }) => child && byId[child.classId] && leave.fromDate <= to && leave.toDate >= from)
      .map(({ leave, child }) => ({
        id: leave.id,
        childId: child.id,
        childName: child.fullName,
        classId: child.classId,
        className: byId[child.classId].name,
        campusId: child.campusId,
        ageGroupId: byId[child.classId].ageGroupId,
        fromDate: leave.fromDate,
        toDate: leave.toDate,
        effectiveTo: leave.status === 'SUBMITTED' ? leave.toDate : null,
        reason: leave.reason,
        status: leave.status === 'SUBMITTED' ? 'ACTIVE' : 'CANCELLED',
        part: leave.part || 'FULL_DAY',
        // ATT-12: công tắc ăn chỉ áp dụng khi buổi còn học có bữa của nhóm tuổi
        ...(() => {
          const meals = sessionsAfterLeave(leave.part || 'FULL_DAY', classSessions(db, byId[child.classId]));
          const half = leave.part && leave.part !== 'FULL_DAY';
          return { eatsMeals: half ? meals : [], eats: half && meals.length ? leave.eats !== false : null };
        })(),
        createdByName: leave.createdByName || 'Phụ huynh',
        createdAt: leave.submittedAt,
      }))
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate));
  },

  async listAttendanceDayUnlocks(user) {
    await delay(120);
    if (![ROLES.VICE_PRINCIPAL, ROLES.PRINCIPAL].includes(user?.role)) throw forbidden();
    const db = ready();
    return clone(
      (db.attendanceDayUnlocks || [])
        .filter((unlock) =>
          canUnlockAttendanceDay(
            db.classes.find((cls) => cls.id === unlock.classId),
            user,
          ),
        )
        .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt))
        .map((unlock) => unlockView(db, unlock)),
    );
  },

  async unlockAttendanceDay({ classId, date, validUntil, reason = '' }, user) {
    await delay();
    ready();
    return writeDb((db) => {
      ensureSeeded(db);
      const cls = findClass(db, classId);
      if (!canUnlockAttendanceDay(cls, user)) throw forbidden();
      if (cls.schoolYear !== activeYearId(db)) throw new ApiError(422, 'Chỉ mở lại lớp thuộc năm học đang hoạt động.');
      const info = dayInfo(db, date);
      if (!isIsoDate(date) || date > info.today || (info.yearStart && date < info.yearStart) || !info.schoolDay)
        throw new ApiError(422, 'Chọn một ngày học từ đầu năm học đến hôm nay.');
      if (!info.baseLocked) throw new ApiError(409, 'Chưa đến giờ khóa, giáo viên vẫn điểm danh được.');
      // Cần chốt 21/10/2026: không giới hạn giờ mở lại sau giờ chốt; hạn dùng do người mở chọn (Mở đến)
      const until = typeof validUntil === 'string' ? Date.parse(validUntil) : NaN;
      // Hạn do HT / PHT chọn, không quá hết ngày kết thúc năm học
      const yearEndAt = info.yearEnd ? Date.parse(`${info.yearEnd}T23:59:59+07:00`) : Infinity;
      if (!Number.isFinite(until) || until <= Date.now() || until > yearEndAt)
        throw new ApiError(422, 'Chọn hạn mở lại sau thời điểm hiện tại và không quá ngày kết thúc năm học.');
      if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 300)
        throw new ApiError(422, 'Nhập lý do mở lại, tối đa 300 ký tự.');
      if (activeUnlockOf(db, classId, date)) throw new ApiError(409, 'Lớp/ngày này đang có lần mở lại còn hiệu lực.');
      materializeCounts(db, date);
      const unlock = {
        id: uid('att-unlock'),
        classId,
        campusId: cls.campusId,
        date,
        validUntil: new Date(until).toISOString(),
        reason: reason.trim(),
        unlockedBy: user.id,
        unlockedAt: new Date().toISOString(),
      };
      db.attendanceDayUnlocks.push(unlock);
      (cls.teacherIds || []).forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'ATTENDANCE_DAY_UNLOCKED',
          title: 'Đã mở lại điểm danh',
          message: `${cls.name}: mở lại điểm danh ngày ${formatDate(date)}. Kiểm tra thời hạn trên màn điểm danh.`,
          link: `/attendance?classId=${classId}&date=${date}`,
        }),
      );
      return clone(unlockView(db, unlock));
    });
  },

  /**
   * Kết thúc sớm lần mở lại (mở nhầm, giáo viên đã điểm danh xong): hạn = bây giờ, giữ lịch sử (không xóa), báo giáo viên lớp.
   * PENDING BE: POST /attendance/day-unlocks/{id}/revoke.
   */
  async revokeAttendanceDayUnlock(id, user) {
    await delay();
    ready();
    return writeDb((db) => {
      ensureSeeded(db);
      const unlock = (db.attendanceDayUnlocks || []).find((u) => u.id === id);
      if (!unlock) throw new ApiError(404, 'Không tìm thấy lần mở lại.');
      const cls = findClass(db, unlock.classId);
      if (!canUnlockAttendanceDay(cls, user)) throw forbidden();
      if (!isAttendanceUnlockActive(unlock)) throw new ApiError(409, 'Lần mở lại này đã hết hiệu lực.');
      const at = new Date().toISOString();
      Object.assign(unlock, { validUntil: at, revokedAt: at, revokedBy: user.id });
      (cls.teacherIds || []).forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'ATTENDANCE_DAY_UNLOCK_REVOKED',
          title: 'Đã kết thúc mở lại điểm danh',
          message: `${cls.name}: lần mở lại điểm danh ngày ${formatDate(unlock.date)} đã kết thúc.`,
          link: `/attendance?classId=${cls.id}&date=${unlock.date}`,
        }),
      );
      return clone(unlockView(db, unlock));
    });
  },

  /** #64: children of the class with their attendance and meal participation for a date. */
  async getClassAttendance(classId, date, user) {
    await delay(180);
    const db = readyFor(date);
    const cls = findClass(db, classId);
    if (!canViewAttendance(cls, user)) throw forbidden();
    const sessions = classSessions(db, cls);
    const count = db.mealCounts.find((m) => m.campusId === cls.campusId && m.date === date);
    const children = activeChildrenOf(db, classId)
      .map((ch) => ({
        child: childView(ch),
        record: clone(recordOf(db, ch.id, date) || null),
        leaveRequest: clone(leaveOf(db, ch.id, date) || null),
        healthSummary: dailyHealthSummary(
          (db.dailyHealthEntries || []).filter((entry) => entry.childId === ch.id && entry.classId === classId && entry.date === date),
        ),
      }))
      .sort((a, b) => a.child.fullName.localeCompare(b.child.fullName, 'vi'));
    return {
      ...dayInfo(db, date, cls),
      classId,
      className: cls.name,
      campusId: cls.campusId,
      mealSessions: sessions,
      afternoonStart: db.afternoonStart || '13:30',
      latestAfternoonArrival: db.latestAfternoonArrival || '14:00',
      canRecord: canRecordAttendance(cls, user) && cls.schoolYear === activeYearId(db),
      mealCountStatus: count?.status || null,
      children,
      receptionStats: {
        total: children.length,
        present: children.filter(({ record }) => record?.status === ATTENDANCE_STATUS.PRESENT).length,
        absent: children.filter(({ record }) => isAbsent(record?.status)).length,
        missing: children.filter(({ record }) => !record).length,
        noted: children.filter(({ healthSummary }) => healthSummary.flagged).length,
      },
    };
  },

  /** ATT-03/B2: trẻ vắng sáng đến trong khung nhận trẻ chiều; không đổi sổ báo ăn. */
  async markArrived({ classId, childId, date }, user) {
    await delay();
    return writeDb((db) => {
      const cls = findClass(db, classId);
      if (!canRecordAttendance(cls, user)) throw forbidden();
      const info = dayInfo(db, date, cls);
      const afternoonStart = db.afternoonStart || '13:30';
      const latest = db.latestAfternoonArrival || '14:00';
      const record = recordOf(db, childId, date);
      const inWindow = date === info.today && info.baseLocked && schoolNow().time >= afternoonStart && schoolNow().time < latest;
      const morningLeave = record?.absentPart === 'MORNING';
      const morningUnexcused = record?.status === ATTENDANCE_STATUS.UNEXCUSED && !record?.absentPart;
      if (!record || (!morningLeave && !morningUnexcused) || record.status === ATTENDANCE_STATUS.PRESENT || !(inWindow || info.unlock)) {
        throw new ApiError(409, `Chỉ ghi Đã đến cho trẻ vắng buổi sáng chưa đến, từ ${afternoonStart} đến trước ${latest}`);
      }
      const at = new Date().toISOString();
      Object.assign(record, {
        status: ATTENDANCE_STATUS.PRESENT,
        absentPart: 'MORNING',
        absentPartUnexcused: morningUnexcused || !!record.absentPartUnexcused,
        recordedBy: user.id,
        recordedAt: at,
      });
      record.history.push({ at, userId: user.id, action: 'ARRIVED' });
      return { savedAt: at, total: 1, changed: 1 };
    });
  },

  /** ATT-02a: sau giờ chốt, GV chỉ được sửa nhầm báo ăn của hôm nay khi số suất chưa xác nhận. */
  async correctMealParticipation({ classId, childId, date, participates }, user) {
    await delay();
    return writeDb((db) => {
      const cls = findClass(db, classId);
      if (!canRecordAttendance(cls, user)) throw forbidden();
      const info = dayInfo(db, date, cls);
      if (date !== info.today || !info.baseLocked) throw new ApiError(409, 'Chỉ sửa nhầm báo ăn trong ngày hôm nay, sau giờ chốt.');
      materializeCounts(db, date);
      const record = recordOf(db, childId, date);
      const child = db.children.find((item) => item.id === childId);
      if (!record || record.classId !== classId || record.status !== ATTENDANCE_STATUS.PRESENT || child?.mealRegistered === false)
        throw new ApiError(409, 'Trẻ này không có suất ăn để điều chỉnh.');
      const served = sessionsAfterLeave(record.absentPart, classSessions(db, cls));
      const relevant = db.mealCounts.filter(
        (count) => count.campusId === cls.campusId && count.date === date && served.includes(count.session),
      );
      if (relevant.some((count) => count.status === MEAL_COUNT_STATUS.CONFIRMED || count.needsReconfirmation))
        throw new ApiError(409, 'Số suất ăn liên quan đã xác nhận, không thể sửa.');
      const at = new Date().toISOString();
      record.meals = {
        ...allMeals(false, classSessions(db, cls)),
        ...Object.fromEntries(served.map((session) => [session, !!participates])),
      };
      record.recordedBy = user.id;
      record.recordedAt = at;
      record.history.push({ at, userId: user.id, action: 'MEAL_PARTICIPATION_CORRECTED' });
      relevant.forEach((count) => {
        count.classes = withSubstituteOverrides(count, buildCount(db, count.campusId, date, count.session).classes);
        count.history.push({ at, userId: user.id, action: 'MEAL_PARTICIPATION_CORRECTED', classId, childId });
      });
      return { savedAt: at, total: 1, changed: 1 };
    });
  },

  /** #64/#65 save: one record per child per day, only before the cut-off of today. */
  async saveClassAttendance({ classId, date, entries }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const cls = findClass(db, classId);
      if (!canRecordAttendance(cls, user)) throw forbidden();
      if (cls.schoolYear !== activeYearId(db)) throw new ApiError(422, 'Lớp thuộc năm học đã kết thúc, chỉ xem được.');
      const info = dayInfo(db, date, cls);
      if (!info.schoolDay) throw new ApiError(422, 'Ngày đã chọn không phải ngày học.');
      // Ngày cũ chỉ sửa được khi PHT đã mở lại riêng lớp cho ngày đó
      if (date !== info.today && !info.unlock) throw new ApiError(422, 'Chỉ điểm danh được cho ngày hôm nay.');
      if (info.locked) throw lockedError(info.cutoff);
      if (info.baseLocked) materializeCounts(db, date);
      const childIds = new Set(activeChildrenOf(db, classId).map((c) => c.id));
      if (!entries?.length || entries.some((e) => !childIds.has(e.childId))) throw new ApiError(422, 'Danh sách trẻ không hợp lệ.');
      const sessions = classSessions(db, cls);
      const errors = validateClassAttendance(entries, { sessions });
      if (Object.keys(errors).length) throw new ApiError(422, 'Dữ liệu điểm danh chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', errors);
      // ATT-09: GV không tự chọn Vắng có phép; trạng thái này chỉ do báo nghỉ của phụ huynh đặt
      const excused = Object.fromEntries(
        entries
          .filter((e) => e.status === ATTENDANCE_STATUS.EXCUSED && !leaveOf(db, e.childId, date))
          .map((e) => [e.childId, { status: 'Vắng có phép chỉ áp dụng khi phụ huynh đã gửi báo nghỉ. Chọn Vắng.' }]),
      );
      if (Object.keys(excused).length) throw new ApiError(422, 'Không chọn được Vắng có phép khi chưa có báo nghỉ.', excused);
      // ATT-08 (26/11/2026): Cả ngày / Chỉ sáng / Chỉ chiều chỉ chọn khi ngày được mở lại, trẻ Có mặt
      if (entries.some((e) => e.presentPart && (!info.unlock || e.status !== ATTENDANCE_STATUS.PRESENT))) {
        throw new ApiError(400, 'Chọn Cả ngày / Chỉ sáng / Chỉ chiều chỉ khi ngày đã được mở lại và trẻ Có mặt');
      }
      // ATT-13: trẻ nghỉ chiều GV vẫn điểm danh buổi sáng; nghỉ sáng chỉ sửa khi lớp/ngày được mở lại
      entries.forEach((entry) => {
        const leave = leaveOf(db, entry.childId, date);
        const part = leave?.part || LEAVE_PART.FULL_DAY;
        // Nghỉ sáng trước giờ chốt: GV chỉ đổi công tắc ăn bữa xế, giữ trạng thái theo đơn
        const mealOnly = part === LEAVE_PART.MORNING && recordOf(db, entry.childId, date)?.status === entry.status;
        // Đơn cả ngày (user chốt 26/11/2026): trẻ vẫn đến thì ghi Có mặt ngay, không đổi thành Vắng không phép
        const fullDayLocked = part === LEAVE_PART.FULL_DAY && entry.status === ATTENDANCE_STATUS.UNEXCUSED;
        if (leave && (fullDayLocked || (part === LEAVE_PART.MORNING && !info.unlock && !mealOnly))) {
          throw new ApiError(409, 'Phụ huynh cần hủy đơn nghỉ trước giờ chốt để điểm danh lại.');
        }
      });

      const at = new Date().toISOString();
      let attendanceChanged = false;
      entries.forEach((e) => {
        // Client cũ không gửi meals: Có mặt mặc định ăn đủ. Client mới gửi rõ true/false để giáo viên có thể tắt.
        const requested = e.meals && Object.keys(e.meals).length ? e.meals : allMeals(true, sessions);
        // ATT-02a/CHD-13: trẻ không báo ăn không có suất, bỏ qua meals client gửi (không báo lỗi)
        const registered = db.children.find((c) => c.id === e.childId)?.mealRegistered !== false;
        const leave = leaveOf(db, e.childId, date);
        const fromPresent =
          e.presentPart === LEAVE_PART.MORNING ? LEAVE_PART.AFTERNOON : e.presentPart === LEAVE_PART.AFTERNOON ? LEAVE_PART.MORNING : null;
        const absentPart = e.presentPart ? fromPresent || undefined : leave && leave.part !== LEAVE_PART.FULL_DAY ? leave.part : undefined;
        // Chỉ chiều mà buổi sáng không có đơn nghỉ che ⇒ sáng vắng không phép
        const absentPartUnexcused = absentPart === LEAVE_PART.MORNING && !!e.presentPart && (!leave || leave.part === LEAVE_PART.AFTERNOON);
        const served = sessionsAfterLeave(absentPart, sessions);
        const meals =
          (isAbsent(e.status) && absentPart !== LEAVE_PART.MORNING) || !registered
            ? allMeals(false, sessions)
            : { ...allMeals(false, sessions), ...mealsIn(requested, served) };
        const existing = recordOf(db, e.childId, date);
        if (existing) {
          const changed =
            existing.status !== e.status ||
            (existing.absentPart || undefined) !== absentPart ||
            sessions.some((s) => !!existing.meals?.[s] !== meals[s]);
          if (!changed) return;
          attendanceChanged = true;
          Object.assign(existing, { status: e.status, meals, recordedBy: user.id, recordedAt: at, absentPart, absentPartUnexcused });
          existing.history.push({ at, userId: user.id, action: 'UPDATED', ...(info.unlock ? { unlockId: info.unlock.id } : {}) });
        } else {
          attendanceChanged = true;
          db.attendance.push({
            id: uid('att'),
            date,
            childId: e.childId,
            classId,
            campusId: cls.campusId,
            status: e.status,
            meals,
            absentPart,
            absentPartUnexcused,
            recordedBy: user.id,
            recordedAt: at,
            history: [{ at, userId: user.id, action: 'RECORDED', ...(info.unlock ? { unlockId: info.unlock.id } : {}) }],
          });
        }
      });
      // Sổ đã tổng hợp (mở lại sau giờ chốt, hoặc sổ demo hôm nay xác nhận sẵn trước giờ chốt) mà điểm danh đổi:
      // không sửa ngầm số đã xác nhận, đưa số mới vào chờ xác nhận lại (NUT-03, ADR-0005)
      const aggregated = db.mealCounts.some((count) => count.campusId === cls.campusId && count.date === date);
      if (attendanceChanged && (info.unlock || aggregated)) {
        db.mealCounts
          .filter((count) => count.campusId === cls.campusId && count.date === date)
          .forEach((count) => {
            const pending = withSubstituteOverrides(count, buildCount(db, count.campusId, date, count.session).classes);
            const baseline = count.pendingClasses || count.classes;
            if (JSON.stringify(pending) === JSON.stringify(baseline)) return;
            count.pendingClasses = pending;
            count.needsReconfirmation = true;
            count.history.push({
              at,
              userId: user.id,
              action: 'ATTENDANCE_REOPENED_CHANGED',
              classId,
              ...(info.unlock ? { unlockId: info.unlock.id } : {}),
            });
          });
        notifyAll(db, usersOf(db, ROLES.VICE_PRINCIPAL, cls.campusId), {
          type: 'MEAL_COUNT',
          title: info.unlock ? 'Điểm danh thay đổi sau khi mở lại' : 'Điểm danh thay đổi sau khi đã tổng hợp số suất',
          message: `${cls.name} đã lưu lại điểm danh ngày ${formatDate(date)}. Kiểm tra và xác nhận lại số suất nếu có thay đổi.`,
          link: `/attendance/meal-count?date=${date}`,
        });
      }
      return { savedAt: at, count: entries.length };
    });
  },

  /** #66: per-day and per-child totals of a class over a period. */
  /**
   * #66: tổng hợp điểm danh theo khoảng ngày. Có classId: một lớp (theo ngày + theo trẻ).
   * Không có classId (Ban giám hiệu): mọi lớp năm đang hoạt động trong phạm vi, lọc thêm campusId; cộng theo ngày + theo lớp.
   */
  async getAttendanceSummary({ classId, campusId, ageGroupId, from, to }, user) {
    await delay(200);
    const db = ready();
    const errors = validateSummaryRange({ from, to });
    if (classId) {
      const cls = findClass(db, classId);
      if (!canViewAttendance(cls, user)) throw forbidden();
      if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
      return { scope: 'CLASS', ...classSummary(db, cls, from, to) };
    }
    if (![ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(user?.role)) throw forbidden();
    if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
    const classes = currentClasses(db)
      .filter(
        (c) =>
          canViewAttendance(c, user) &&
          (!campusId || c.campusId === campusId) &&
          (!ageGroupId || String(c.ageGroupId) === String(ageGroupId)),
      )
      .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi'));
    const parts = classes.map((cls) => classSummary(db, cls, from, to));
    const mealSessions = MEAL_SESSIONS.filter((s) => parts.some((p) => p.mealSessions.includes(s)));
    const days = schoolDaysBetween(from, to)
      .filter((d) => d <= schoolNow().date)
      .map((date) => {
        const row = {
          date,
          present: 0,
          excused: 0,
          unexcused: 0,
          missing: 0,
          substitute: 0,
          mealTotal: 0,
          morningOff: 0,
          afternoonOff: 0,
          meals: allMeals(0, mealSessions),
        };
        parts.forEach((part) => {
          const d = part.days.find((x) => x.date === date);
          if (!d) return;
          ['present', 'excused', 'unexcused', 'missing', 'substitute', 'mealTotal', 'morningOff', 'afternoonOff'].forEach(
            (k) => (row[k] += d[k]),
          );
          Object.entries(d.meals || {}).forEach(([s, n]) => (row.meals[s] = (row.meals[s] || 0) + n));
        });
        return row;
      });
    const sum = (list, key) => list.reduce((t, x) => t + x[key], 0);
    return {
      scope: 'MULTI',
      campusId: campusId || null,
      from,
      to,
      size: sum(parts, 'size'),
      mealSessions,
      days,
      classes: parts.map((part) => ({
        classId: part.classId,
        className: part.className,
        campusId: part.campusId,
        size: part.size,
        present: sum(part.days, 'present'),
        excused: sum(part.days, 'excused'),
        unexcused: sum(part.days, 'unexcused'),
        meals: sum(part.days, 'mealTotal'),
      })),
    };
  },

  /** #67: meal counts of the visible campuses for a date (both sessions). Before the lock the VP sees a live preview. */
  async getMealCounts({ date }, user) {
    await delay(200);
    if (!canViewMealCounts(user)) throw forbidden();
    const db = readyFor(date);
    const info = dayInfo(db, date);
    const campuses = user.role === ROLES.PRINCIPAL ? campusIds(db) : [user.campusId];
    const counts = [];
    campuses.forEach((campusId) =>
      campusSessions(db, campusId).forEach((session) => {
        const stored = db.mealCounts.find((m) => m.campusId === campusId && m.date === date && m.session === session);
        if (stored) {
          if (canViewMealCount(stored, user)) counts.push(mealCountForUser(clone(stored), user));
        } else if (info.schoolDay && user.role !== ROLES.KITCHEN_STAFF) {
          counts.push(withTotals({ id: null, ...buildCount(db, campusId, date, session), status: 'OPEN', adjustments: [], history: [] }));
        }
      }),
    );
    return { ...info, counts };
  },

  /**
   * BE giả của `GET /meal-counts/class` (NUT-02, ATT-02): suất ăn từng bữa của một lớp cho người xem được lớp, không tên
   * trẻ. Sổ chưa lập ⇒ tạm tính từ điểm danh (OPEN); số chờ xác nhận lại ⇒ PENDING_CONFIRMATION (NUT-03).
   */
  async getClassMealCount({ classId, date }, user) {
    await delay(120);
    const db = readyFor(date);
    const cls = findClass(db, classId);
    if (!canViewAttendance(cls, user)) throw forbidden();
    const info = dayInfo(db, date, cls);
    const meals =
      info.schoolDay && date <= info.today
        ? classSessions(db, cls).map((session) => {
            const stored = db.mealCounts.find((m) => m.campusId === cls.campusId && m.date === date && m.session === session);
            const lines = stored ? stored.pendingClasses || stored.classes : buildCount(db, cls.campusId, date, session).classes;
            const line = lines.find((l) => l.classId === classId);
            return {
              session,
              normal: line?.normal ?? 0,
              substitute: line?.substitute ?? 0,
              status: !stored ? 'OPEN' : stored.needsReconfirmation ? MEAL_COUNT_STATUS.PENDING_CONFIRMATION : stored.status,
              needsReconfirmation: !!stored?.needsReconfirmation,
              confirmedAt: stored?.confirmedAt ?? null,
            };
          })
        : [];
    return clone({
      classId,
      className: cls.name,
      date,
      today: info.today,
      cutoff: info.cutoff,
      schoolDay: info.schoolDay,
      locked: info.locked,
      meals,
    });
  },

  async confirmMealCount(id, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      return withTotals(clone(confirmOneIn(db, id, user)));
    });
  },

  /**
   * NUT-02: PHT điểm trường chỉ điều chỉnh suất thay thế của một lớp (trẻ dị ứng nặng, bắt buộc lý do, lưu lịch sử);
   * suất thường chỉ đổi qua điểm danh (`normal` phải null). Có session: chỉ bữa đó, không có: mọi bữa của lớp trong ngày.
   * Bữa đã xác nhận không sửa ngầm số bếp đang dùng, chuyển sang chờ xác nhận lại (NUT-03, ADR-0005).
   */
  async getMealHandovers({ date }, user) {
    await delay(180);
    if (!canOpenMealHandover(user)) throw forbidden();
    const db = readyFor(date);
    const list = db.mealHandovers
      .filter((h) => h.date === date)
      .filter((h) =>
        canViewHandover(
          h,
          db.classes.find((c) => c.id === h.classId),
          user,
        ),
      )
      .map((h) => decorateHandover(db, h))
      .sort((a, b) => a.className.localeCompare(b.className, 'vi') || MEAL_SESSIONS.indexOf(a.session) - MEAL_SESSIONS.indexOf(b.session));
    return { ...dayInfo(db, date), handovers: list };
  },

  async confirmHandover(id, { normal, substitute, note }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const h = db.mealHandovers.find((x) => x.id === id);
      if (!h) throw new ApiError(404, 'Không tìm thấy phiếu nhận suất ăn');
      const cls = findClass(db, h.classId);
      if (!kitchenReady(db, h.campusId, h.date, h.session)) throw new ApiError(409, 'Bếp chưa chuyển trạng thái "Sẵn sàng bàn giao".');
      if (!canReceiveHandover(h, cls, user)) throw forbidden();
      const errors = validateHandoverCheck({ normal, substitute }, h.expected);
      if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
      const at = new Date().toISOString();
      Object.assign(h, {
        status: HANDOVER_STATUS.CONFIRMED,
        received: { normal: Number(normal), substitute: Number(substitute) },
        confirmedBy: user.id,
        confirmedAt: at,
      });
      h.history.push({ at, userId: user.id, action: 'CONFIRMED', note: note?.trim() || undefined });
      return decorateHandover(db, h);
    });
  },

  async reportHandoverShortage(id, { normal, substitute, note }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const h = db.mealHandovers.find((x) => x.id === id);
      if (!h) throw new ApiError(404, 'Không tìm thấy phiếu nhận suất ăn');
      const cls = findClass(db, h.classId);
      if (!canReceiveHandover(h, cls, user)) throw forbidden();
      const errors = validateHandoverCheck({ normal, substitute, note }, h.expected, { shortage: true });
      if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
      const at = new Date().toISOString();
      const missing = {
        normal: Math.max(0, h.expected.normal - Number(normal)),
        substitute: Math.max(0, h.expected.substitute - Number(substitute)),
      };
      h.status = HANDOVER_STATUS.SHORTAGE_REPORTED;
      h.shortage = {
        received: { normal: Number(normal), substitute: Number(substitute) },
        missing,
        note: note.trim(),
        reportedBy: user.id,
        reportedAt: at,
      };
      h.history.push({ at, userId: user.id, action: 'SHORTAGE_REPORTED', note: note.trim() });
      notifyAll(db, usersOf(db, ROLES.KITCHEN_STAFF, h.campusId), {
        type: 'MEAL_HANDOVER',
        title: 'Lớp báo thiếu suất ăn',
        message: `${cls.name} – ${MEAL_SESSION_LABELS[h.session].toLowerCase()}: thiếu ${missing.normal} suất thường, ${missing.substitute} suất thay thế.`,
        link: `/attendance/meal-handover?date=${h.date}`,
      });
      return decorateHandover(db, h);
    });
  },

  async supplementHandover(id, { note } = {}, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const h = db.mealHandovers.find((x) => x.id === id);
      if (!h) throw new ApiError(404, 'Không tìm thấy phiếu nhận suất ăn');
      if (!canSupplementHandover(h, user)) throw forbidden();
      const at = new Date().toISOString();
      h.status = HANDOVER_STATUS.SUPPLEMENTED;
      h.history.push({ at, userId: user.id, action: 'SUPPLEMENTED', note: note?.trim() || undefined });
      const cls = db.classes.find((c) => c.id === h.classId);
      (cls?.teacherIds || []).forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'MEAL_HANDOVER',
          title: 'Bếp đã bổ sung suất ăn',
          message: `${cls.name} – ${MEAL_SESSION_LABELS[h.session].toLowerCase()}: kiểm lại số suất và xác nhận đã nhận.`,
          link: `/attendance/meal-handover?date=${h.date}`,
        }),
      );
      return decorateHandover(db, h);
    });
  },
};
