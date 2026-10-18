import { readDb, writeDb, clone, delay, ApiError, applyMockSeedMigration, needsMockSeedMigration } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { buildAttendanceSeed } from '@/mocks/attendanceSeed';
import { ROLES } from '@/models/User';
import {
  ATTENDANCE_STATUS,
  DEFAULT_CUTOFF_TIME,
  MEAL_COUNT_STATUS,
  MEAL_SESSIONS,
  MEAL_SESSION_LABELS,
  SUMMARY_MAX_DAYS,
  allMeals,
  isAbsent,
  needsSubstitute,
} from '@/models/attendance/attendanceConstants';
import {
  canConfirmMealCount,
  canCorrectMealAfterLock,
  canRecordAttendance,
  canViewAttendance,
  canViewMealCount,
  canViewMealCounts,
} from '@/utils/attendance/attendancePermissions';
import { validateClassAttendance, validateMealCorrection, validateSummaryRange } from '@/utils/attendance/attendanceValidation';
import { isDayLocked, isSchoolDay, isValidTime, schoolDaysBetween, schoolNow } from '@/utils/attendance/attendanceTime';
import { formatDate } from '@/utils/format';
import { uid } from '@/utils/id';

/*
 * Fake backend for attendance, meal participation and meal counts. Meal handover is not tracked (user decision 16/10/2026).
 * Business rules that the Spring Boot backend must re-implement live here:
 *  - lock at the configured cut-off (GBR-ATT-02/04/08), absent => no meal (GBR-ATT-03);
 *  - meal count aggregated per campus/date/session at the cut-off (GBR-ATT-07), confirmed by the VP only (GBR-ATT-06);
 *  - later corrections update the count and notify the kitchen without a new approval (UC 6.10 alt flow);
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

const usersOf = (db, role, campusId) => (db.users || []).filter((u) => u.role === role && u.campusId === campusId);
const notifyAll = (db, users, payload) => users.forEach((u) => pushNotification(db, { ...payload, userId: u.id }));

const activeChildrenOf = (db, classId) => db.children.filter((ch) => ch.classId === classId && ch.status === 'ACTIVE');
const campusIds = (db) => [...new Set(db.classes.map((c) => c.campusId))];
const findClass = (db, id) => {
  const cls = db.classes.find((c) => c.id === id);
  if (!cls) throw new ApiError(404, 'Không tìm thấy lớp');
  return cls;
};
const recordOf = (db, childId, date) => db.attendance.find((r) => r.childId === childId && r.date === date);

/** Totals of one class for a date and meal session, built from the attendance records. */
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
  const classes = db.classes.filter((c) => c.campusId === campusId).map((c) => classLine(db, c, date, session));
  return { campusId, date, session, classes };
};

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

/** Emulates the cut-off job: lock + aggregate, then ask the campus VP to confirm. */
const materializeCounts = (db, date, { notify = true } = {}) => {
  const cutoff = readCutoff(db);
  if (!isSchoolDay(date) || !isDayLocked(date, cutoff)) return;
  campusIds(db).forEach((campusId) => {
    let created = false;
    MEAL_SESSIONS.forEach((session) => {
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

const confirmCountIn = (db, count, userId, at) => {
  count.status = MEAL_COUNT_STATUS.CONFIRMED;
  count.confirmedBy = userId;
  count.confirmedAt = at;
  count.history.push({ at, userId, action: 'CONFIRMED' });
};

// Databases saved before this module existed get demo data once.
const ensureSeeded = (db) => {
  const seed = buildAttendanceSeed({ classes: db.classes, children: db.children, today: schoolNow().date });
  const keys = ['attendance', 'childMealPlans', 'mealCounts'];
  const migrate = needsMockSeedMigration(db, 'attendance', 1, keys);
  applyMockSeedMigration(db, 'attendance', 1, { attendance: seed.attendance, childMealPlans: seed.childMealPlans, mealCounts: [] });
  if (!migrate) return db;
  // Past demo days are already confirmed by the VP.
  seed.seededDays.forEach((date) => {
    materializeCounts(db, date, { notify: false });
    db.mealCounts
      .filter((m) => m.date === date && m.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION)
      .forEach((m) => {
        const vp = usersOf(db, ROLES.VICE_PRINCIPAL, m.campusId)[0];
        confirmCountIn(db, m, vp?.id || null, new Date(`${date}T09:05:00+07:00`).toISOString());
      });
  });
  return db;
};

const ready = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (needsMockSeedMigration(db, 'attendance', 1, ['attendance', 'childMealPlans', 'mealCounts'])) writeDb(ensureSeeded);
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
      MEAL_SESSIONS.some((s) => !db.mealCounts.some((m) => m.campusId === c && m.date === date && m.session === s)),
    );
  if (missing) {
    writeDb((d) => materializeCounts(ensureSeeded(d), date));
    db = readDb();
  }
  return db;
};

const dayInfo = (db, date) => {
  const cutoff = readCutoff(db);
  const now = schoolNow();
  return { date, today: now.date, now: now.time, cutoff, schoolDay: isSchoolDay(date), locked: isDayLocked(date, cutoff, now) };
};

const childView = (ch) => ({ id: ch.id, code: ch.code, fullName: ch.fullName, gender: ch.gender, allergies: ch.allergies || [] });

export const attendanceMockRepository = {
  async getDayInfo(date) {
    await delay(60);
    const db = ready();
    return dayInfo(db, date || schoolNow().date);
  },

  /** #64: children of the class with their attendance and meal participation for a date. */
  async getClassAttendance(classId, date, user) {
    await delay(180);
    const db = readyFor(date);
    const cls = findClass(db, classId);
    if (!canViewAttendance(cls, user)) throw forbidden();
    const plans = Object.fromEntries(db.childMealPlans.map((p) => [p.childId, p]));
    const count = db.mealCounts.find((m) => m.campusId === cls.campusId && m.date === date);
    return {
      ...dayInfo(db, date),
      classId,
      className: cls.name,
      campusId: cls.campusId,
      canRecord: canRecordAttendance(cls, user),
      mealCountStatus: count?.status || null,
      children: activeChildrenOf(db, classId)
        .map((ch) => ({ child: childView(ch), record: clone(recordOf(db, ch.id, date) || null), mealPlan: plans[ch.id] || null }))
        .sort((a, b) => a.child.fullName.localeCompare(b.child.fullName, 'vi')),
    };
  },

  /** #64/#65 save: one record per child per day, only before the cut-off of today. */
  async saveClassAttendance({ classId, date, entries }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const cls = findClass(db, classId);
      if (!canRecordAttendance(cls, user)) throw forbidden();
      const info = dayInfo(db, date);
      if (!info.schoolDay) throw new ApiError(422, 'Ngày đã chọn không phải ngày học.');
      if (date !== info.today) throw new ApiError(422, 'Chỉ điểm danh được cho ngày hôm nay.');
      if (info.locked) throw lockedError(info.cutoff);
      const childIds = new Set(activeChildrenOf(db, classId).map((c) => c.id));
      if (!entries?.length || entries.some((e) => !childIds.has(e.childId))) throw new ApiError(422, 'Danh sách trẻ không hợp lệ.');
      const plans = Object.fromEntries(db.childMealPlans.map((p) => [p.childId, p]));
      const errors = validateClassAttendance(entries, plans);
      if (Object.keys(errors).length) throw new ApiError(422, 'Dữ liệu điểm danh chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', errors);

      const at = new Date().toISOString();
      entries.forEach((e) => {
        const meals = Object.fromEntries(MEAL_SESSIONS.map((s) => [s, !isAbsent(e.status) && !!e.meals?.[s]]));
        const existing = recordOf(db, e.childId, date);
        if (existing) {
          const changed = existing.status !== e.status || MEAL_SESSIONS.some((s) => !!existing.meals?.[s] !== meals[s]);
          if (!changed) return;
          Object.assign(existing, { status: e.status, meals, recordedBy: user.id, recordedAt: at });
          existing.history.push({ at, userId: user.id, action: 'UPDATED' });
        } else {
          db.attendance.push({
            id: uid('att'),
            date,
            childId: e.childId,
            classId,
            campusId: cls.campusId,
            status: e.status,
            meals,
            recordedBy: user.id,
            recordedAt: at,
            history: [{ at, userId: user.id, action: 'RECORDED' }],
          });
        }
      });
      return { savedAt: at, count: entries.length };
    });
  },

  /**
   * After the lock a teacher can only cancel a meal of today (e.g. child sent home sick).
   * The count is updated and the kitchen notified without a new approval (UC 6.10 alt flow).
   */
  async correctMealAfterLock({ childId, date, session, note }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const rec = recordOf(db, childId, date);
      if (!rec) throw new ApiError(404, 'Trẻ chưa có dữ liệu điểm danh ngày này.');
      const cls = findClass(db, rec.classId);
      if (!canCorrectMealAfterLock(cls, user)) throw forbidden();
      const errors = validateMealCorrection({ session, note });
      if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
      const info = dayInfo(db, date);
      if (date !== info.today || !info.locked) throw new ApiError(422, 'Chỉ điều chỉnh sau giờ khóa của ngày hôm nay.');
      if (!rec.meals?.[session]) throw new ApiError(409, 'Trẻ không đăng ký bữa này.');
      materializeCounts(db, date);

      const at = new Date().toISOString();
      const child = db.children.find((c) => c.id === childId);
      const kind = needsSubstitute(child) ? 'substitute' : 'normal';
      rec.meals[session] = false;
      rec.history.push({ at, userId: user.id, action: 'MEAL_CANCELLED', note: `${MEAL_SESSION_LABELS[session]}: ${note.trim()}` });

      const count = db.mealCounts.find((m) => m.campusId === cls.campusId && m.date === date && m.session === session);
      const line = count?.classes.find((l) => l.classId === cls.id);
      if (line) line[kind] = Math.max(0, line[kind] - 1);
      count?.adjustments.push({
        at,
        userId: user.id,
        classId: cls.id,
        childId,
        normal: kind === 'normal' ? -1 : 0,
        substitute: kind === 'substitute' ? -1 : 0,
        note: note.trim(),
      });

      if (count?.status === MEAL_COUNT_STATUS.CONFIRMED) {
        notifyAll(db, usersOf(db, ROLES.KITCHEN_STAFF, cls.campusId), {
          type: 'MEAL_COUNT',
          title: 'Điều chỉnh sĩ số suất ăn',
          message: `${cls.name}: giảm 1 suất ${kind === 'substitute' ? 'thay thế' : 'thường'} ${MEAL_SESSION_LABELS[session].toLowerCase()} ngày ${formatDate(date)}.`,
          link: `/attendance/meal-count?date=${date}`,
        });
      }
      return clone(rec);
    });
  },

  /** #66: per-day and per-child totals of a class over a period. */
  async getAttendanceSummary({ classId, from, to }, user) {
    await delay(200);
    const db = ready();
    const cls = findClass(db, classId);
    if (!canViewAttendance(cls, user)) throw forbidden();
    const errors = validateSummaryRange({ from, to }, SUMMARY_MAX_DAYS);
    if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
    const children = activeChildrenOf(db, classId);
    const days = schoolDaysBetween(from, to).filter((d) => d <= schoolNow().date);
    const perChild = Object.fromEntries(
      children.map((ch) => [ch.id, { child: childView(ch), present: 0, excused: 0, unexcused: 0, meals: 0 }]),
    );
    const rows = days.map((date) => {
      const row = { date, present: 0, excused: 0, unexcused: 0, missing: 0, substitute: 0, meals: allMeals(0) };
      children.forEach((ch) => {
        const rec = recordOf(db, ch.id, date);
        if (!rec) {
          row.missing += 1;
          return;
        }
        const key =
          rec.status === ATTENDANCE_STATUS.PRESENT ? 'present' : rec.status === ATTENDANCE_STATUS.EXCUSED ? 'excused' : 'unexcused';
        row[key] += 1;
        perChild[ch.id][key] += 1;
        MEAL_SESSIONS.forEach((s) => {
          if (!rec.meals?.[s]) return;
          row.meals[s] += 1;
          perChild[ch.id].meals += 1;
          if (needsSubstitute(ch)) row.substitute += 1;
        });
      });
      return row;
    });
    return {
      classId,
      className: cls.name,
      from,
      to,
      size: children.length,
      days: rows,
      children: Object.values(perChild).sort((a, b) => a.child.fullName.localeCompare(b.child.fullName, 'vi')),
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
      MEAL_SESSIONS.forEach((session) => {
        const stored = db.mealCounts.find((m) => m.campusId === campusId && m.date === date && m.session === session);
        if (stored) {
          if (canViewMealCount(stored, user)) counts.push(withTotals(clone(stored)));
        } else if (info.schoolDay && user.role !== ROLES.KITCHEN_STAFF) {
          counts.push(withTotals({ id: null, ...buildCount(db, campusId, date, session), status: 'OPEN', adjustments: [], history: [] }));
        }
      }),
    );
    return { ...info, counts };
  },

  /** Chốt suất cả ngày (S2): một lần xác nhận mọi bữa của cơ sở trong ngày; bếp nhận một thông báo. */
  async confirmMealCountDay({ campusId, date }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const counts = db.mealCounts.filter((m) => m.campusId === campusId && m.date === date);
      if (!counts.length) throw new ApiError(404, 'Chưa có sĩ số suất ăn của ngày này.');
      if (counts.every((c) => c.status === MEAL_COUNT_STATUS.CONFIRMED)) throw new ApiError(409, 'Suất ăn ngày này đã được chốt.');
      const pending = counts.filter((c) => c.status === MEAL_COUNT_STATUS.PENDING_CONFIRMATION);
      if (!pending.length || !pending.every((c) => canConfirmMealCount(c, user))) throw forbidden();
      const at = new Date().toISOString();
      pending.forEach((c) => confirmCountIn(db, c, user.id, at));
      const parts = counts.map(
        (c) => `${MEAL_SESSION_LABELS[c.session]} ${c.classes.reduce((t, l) => t + l.normal + l.substitute, 0)} suất`,
      );
      notifyAll(db, usersOf(db, ROLES.KITCHEN_STAFF, campusId), {
        type: 'MEAL_COUNT',
        title: 'Đã chốt suất ăn cả ngày',
        message: `Ngày ${formatDate(date)}: ${parts.join(', ')}. Đồ khô đã xuất kho theo số chốt.`,
        link: `/kitchen/meal-count?date=${date}`,
      });
      return counts.map((c) => withTotals(clone(c)));
    });
  },
};
