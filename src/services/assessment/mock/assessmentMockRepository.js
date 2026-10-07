import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { buildAssessmentSeed } from '@/mocks/assessmentSeed';
import { ROLES } from '@/models/User';
import {
  EVAL_KIND,
  EVAL_STATUS,
  PERIOD_TYPE,
  REWARD_STATUS,
  TICKET_RULES,
  TICKET_TYPE,
  TICKET_TYPE_LABELS,
} from '@/models/assessment/assessmentConstants';
import {
  addDays,
  assessableActivities,
  isAssessmentLocked,
  isSchoolDay,
  monthEnd,
  monthOfWeek,
  monthStart,
  monthsBetween,
  periodLabel,
  schoolDaysBetween,
  schoolYearOf,
  schoolYearRange,
  todayIso,
  weekEnd,
  weekStart,
  weeksBetween,
} from '@/utils/assessment/assessmentPeriods';
import {
  canCreateRewardProposal,
  canDecideRewardProposal,
  canDeleteRewardProposal,
  canEditRewardProposal,
  canIssueTickets,
  canRecordDailyAssessment,
  canReviewEvaluation,
  canReviewRewardProposal,
  canViewAiDraft,
  canViewDevelopmentProfile,
  canViewDevelopmentProgress,
  canViewEvaluation,
  canViewRewardProposal,
  inLeaderScope,
  isClassTeacher,
  isLeader,
} from '@/utils/assessment/assessmentPermissions';
import {
  hasErrors,
  validateDailyEntry,
  validateDecision,
  validateEvaluationContent,
  validateRewardProposal,
} from '@/utils/assessment/assessmentValidation';
import { generateEvaluationDraft } from '@/services/assessment/mock/aiEvaluationGenerator';
import { uid } from '@/utils/id';

/*
 * Fake backend for daily assessments, evaluations, good behaviour tickets and year-end rewards.
 * Every business rule here (scope, presence, lock, AI draft, ticket criteria, approval chain) must be
 * re-implemented by the Spring Boot backend.
 */

const MSG10 = 'Bạn không có quyền thực hiện thao tác này.';
const MSG37 = 'Yêu cầu này không còn ở trạng thái chờ xử lý. Hãy tải lại danh sách.';
const MSG32 = 'Thiếu dữ liệu nguồn cho kỳ này. Hãy xem lại các đánh giá hằng ngày đã ghi nhận.';
const nowIso = () => new Date().toISOString();

const forbid = (message = MSG10) => {
  throw new ApiError(403, message);
};

const evalCollection = (kind) => (kind === EVAL_KIND.YEAR_END ? 'yearEndEvaluations' : 'periodicEvaluations');

/* ---------------- source-record helpers ---------------- */

const classOf = (db, id) => (db.classes || []).find((c) => c.id === id) || null;
const childOf = (db, id) => (db.children || []).find((c) => c.id === id) || null;
const activeChildrenOf = (db, classId) => (db.children || []).filter((ch) => ch.classId === classId && ch.status === 'ACTIVE');

const attendanceIndex = (db) => {
  const map = new Map();
  (db.attendance || []).forEach((r) => map.set(`${r.date}|${r.childId}`, r.status));
  return map;
};

const assessmentsOf = (db, childId, start, end) =>
  db.dailyAssessments.filter((a) => a.childId === childId && a.date >= start && a.date <= end);

/** Attendance wins when recorded; otherwise a day with an assessment counts as present (assumption for days without attendance data). */
const countPresentDays = (db, childId, start, end, att = attendanceIndex(db)) => {
  const assessedDays = new Set(assessmentsOf(db, childId, start, end).map((a) => a.date));
  return schoolDaysBetween(start, end > todayIso() ? todayIso() : end).filter((d) => {
    const status = att.get(`${d}|${childId}`);
    return status ? status === 'PRESENT' : assessedDays.has(d);
  }).length;
};

const usersWhere = (db, fn) => (db.users || []).filter(fn);
const leadersOf = (db, campusId) =>
  usersWhere(db, (u) => u.role === ROLES.PRINCIPAL || (u.role === ROLES.VICE_PRINCIPAL && u.campusId === campusId));

/* ---------------- AI drafts & period jobs ---------------- */

const draftFor = (db, ev, child) => {
  const criteria = db.assessmentCriteria;
  const assessments = assessmentsOf(db, ev.childId, ev.periodStart, ev.periodEnd);
  const presentDays = countPresentDays(db, ev.childId, ev.periodStart, ev.periodEnd);
  const monthlyEvaluations =
    ev.periodType === PERIOD_TYPE.YEAR
      ? db.periodicEvaluations.filter(
          (m) =>
            m.childId === ev.childId &&
            m.periodType === PERIOD_TYPE.MONTH &&
            m.status === EVAL_STATUS.CONFIRMED &&
            m.schoolYear === ev.schoolYear,
        )
      : [];
  return generateEvaluationDraft({
    child,
    periodType: ev.periodType,
    start: ev.periodStart,
    end: ev.periodEnd,
    assessments,
    presentDays,
    criteria,
    monthlyEvaluations,
  });
};

/** Runs the (fake) AI service for one evaluation and stores the result as an unconfirmed draft. */
const applyDraft = (db, ev, { userId = null, redraft = false } = {}) => {
  const child = childOf(db, ev.childId) || { fullName: '' };
  try {
    const { content, source } = draftFor(db, ev, child);
    ev.aiDraft = { content, generatedAt: nowIso(), source };
    ev.aiError = null;
    ev.status = EVAL_STATUS.AWAITING_REVIEW;
    ev.history.push({ id: uid('eh'), action: redraft ? 'AI_REDRAFTED' : 'AI_DRAFTED', userId, at: nowIso() });
  } catch (err) {
    ev.aiDraft = null;
    ev.aiError = err.message || 'AI assistance is unavailable.';
    ev.status = EVAL_STATUS.AI_FAILED;
    ev.history.push({ id: uid('eh'), action: 'AI_FAILED', userId, at: nowIso(), note: ev.aiError });
  }
  return ev;
};

const newEvaluation = (cls, child, periodType, start, end, schoolYear) => ({
  id: uid(periodType === PERIOD_TYPE.YEAR ? 'ye' : 'pe'),
  periodType,
  periodStart: start,
  periodEnd: end,
  schoolYear,
  childId: child.id,
  classId: cls.id,
  campusId: cls.campusId,
  status: EVAL_STATUS.AWAITING_REVIEW,
  aiDraft: null,
  aiError: null,
  finalContent: '',
  confirmedBy: null,
  confirmedAt: null,
  publishedAt: null,
  history: [],
});

/**
 * Weekly / monthly jobs (UC 4.7 step 1, "Prepare weekly and monthly evaluations"): every finished week or month
 * of the current school year with recorded assessments gets one draft per active child (one per child and period).
 */
const pendingPeriodJobs = (db) => {
  const today = todayIso();
  const year = schoolYearOf(today);
  const { start: yStart } = schoolYearRange(year);
  const existing = new Set(db.periodicEvaluations.map((e) => `${e.childId}|${e.periodType}|${e.periodStart}`));
  const classPeriods = new Map();
  db.dailyAssessments.forEach((a) => {
    if (a.date < yStart) return;
    const set = classPeriods.get(a.classId) || new Set();
    set.add(`${PERIOD_TYPE.WEEK}|${weekStart(a.date)}`);
    set.add(`${PERIOD_TYPE.MONTH}|${monthStart(a.date)}`);
    classPeriods.set(a.classId, set);
  });
  const jobs = [];
  classPeriods.forEach((periods, classId) => {
    const cls = classOf(db, classId);
    if (!cls) return;
    periods.forEach((key) => {
      const [type, start] = key.split('|');
      const end = type === PERIOD_TYPE.WEEK ? weekEnd(start) : monthEnd(start);
      if (end >= today) return;
      activeChildrenOf(db, classId).forEach((child) => {
        if (!existing.has(`${child.id}|${type}|${start}`)) jobs.push({ cls, child, type, start, end, year });
      });
    });
  });
  return jobs;
};

const runPeriodJobs = (db, { notify = true } = {}) => {
  const jobs = pendingPeriodJobs(db);
  const notified = new Set();
  jobs.forEach(({ cls, child, type, start, end, year }) => {
    const ev = applyDraft(db, newEvaluation(cls, child, type, start, end, year));
    db.periodicEvaluations.push(ev);
    const key = `${cls.id}|${type}|${start}`;
    if (notify && !notified.has(key)) {
      notified.add(key);
      cls.teacherIds.forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'EVALUATION_DRAFT_READY',
          title: 'Bản nháp đánh giá đã sẵn sàng',
          // MSG31
          message: `Bản nháp AI đã sẵn sàng để bạn xem xét – ${cls.name}, ${periodLabel(type, start, end)}.`,
          link: '/assessment/periodic',
        }),
      );
    }
  });
  return jobs.length;
};

/** First run of the demo: seed source records, run the jobs, then age the older records (confirmed, tickets issued). */
const seedOnce = (db) => {
  const today = todayIso();
  const seed = buildAssessmentSeed({ classes: db.classes, children: db.children, today });
  db.assessmentCriteria ||= clone(seed.assessmentCriteria);
  db.dailyAssessments ||= clone(seed.dailyAssessments);
  db.periodicEvaluations ||= [];
  db.yearEndEvaluations ||= [];
  db.behaviourTickets ||= [];
  db.rewardProposals ||= clone(seed.rewardProposals);
  runPeriodJobs(db, { notify: false });

  const recent = addDays(today, -10);
  const failedOnce = new Set();
  db.periodicEvaluations.forEach((ev) => {
    const cls = classOf(db, ev.classId);
    if (ev.periodEnd < recent && ev.aiDraft) {
      ev.status = EVAL_STATUS.CONFIRMED;
      ev.finalContent = ev.aiDraft.content;
      ev.confirmedBy = cls?.homeroomTeacherId || null;
      ev.confirmedAt = new Date(`${addDays(ev.periodEnd, 1)}T16:00:00+07:00`).toISOString();
      ev.publishedAt = ev.confirmedAt;
      ev.history.push({ id: uid('eh'), action: 'CONFIRMED', userId: ev.confirmedBy, at: ev.confirmedAt });
    } else if (ev.periodType === PERIOD_TYPE.WEEK && ev.periodEnd >= recent && !failedOnce.has(ev.classId)) {
      // One failed AI request per class shows the manual path (MSG30).
      failedOnce.add(ev.classId);
      ev.status = EVAL_STATUS.AI_FAILED;
      ev.aiDraft = null;
      ev.aiError = 'Dịch vụ AI tạm thời không phản hồi. Bạn có thể yêu cầu tạo lại hoặc tự viết đánh giá.';
      ev.history.push({ id: uid('eh'), action: 'AI_FAILED', userId: null, at: nowIso(), note: ev.aiError });
    }
  });

  // Weekly tickets of older weeks were already issued by the teachers.
  db.classes.forEach((cls) => {
    const weeks = [...new Set(db.dailyAssessments.filter((a) => a.classId === cls.id).map((a) => weekStart(a.date)))];
    weeks
      .filter((w) => weekEnd(w) < recent)
      .forEach((w) =>
        activeChildrenOf(db, cls.id).forEach((child) => {
          const stats = weekStats(db, child.id, w);
          if (stats.eligible)
            db.behaviourTickets.push(makeTicket(cls, child, TICKET_TYPE.WEEKLY, w, weekEnd(w), cls.homeroomTeacherId, stats));
        }),
      );
  });

  // Year-end drafts for the classes that simulate the end of the year.
  const { start, end } = schoolYearRange(seed.schoolYear);
  seed.yearEndShells.forEach((shell) => {
    const cls = classOf(db, shell.classId);
    const child = childOf(db, shell.childId);
    if (!cls || !child) return;
    const ev = applyDraft(db, { ...newEvaluation(cls, child, PERIOD_TYPE.YEAR, start, end, seed.schoolYear), id: shell.id });
    if (shell.seedStatus === 'CONFIRMED' && ev.aiDraft) {
      ev.status = EVAL_STATUS.CONFIRMED;
      ev.finalContent = ev.aiDraft.content;
      ev.confirmedBy = cls.homeroomTeacherId;
      ev.confirmedAt = new Date('2026-09-30T16:00:00+07:00').toISOString();
      ev.history.push({ id: uid('eh'), action: 'CONFIRMED', userId: ev.confirmedBy, at: ev.confirmedAt });
    } else if (shell.seedStatus === 'AI_FAILED') {
      ev.status = EVAL_STATUS.AI_FAILED;
      ev.aiDraft = null;
      ev.aiError = 'Dịch vụ AI tạm thời không phản hồi. Bạn có thể yêu cầu tạo lại hoặc tự viết đánh giá.';
    }
    db.yearEndEvaluations.push(ev);
  });
  return db;
};

/** Seeds once, then runs the period jobs whenever a week or month has ended since the last visit. */
const ensureReady = () => {
  ensureSchoolSeeded();
  let db = readDb();
  if (!db.dailyAssessments || !db.periodicEvaluations || !db.rewardProposals) {
    writeDb(seedOnce);
    db = readDb();
  }
  if (pendingPeriodJobs(db).length) {
    writeDb((d) => runPeriodJobs(d));
    db = readDb();
  }
  return db;
};

/* ---------------- tickets ---------------- */

const weekStats = (db, childId, monday, att) => {
  const end = weekEnd(monday);
  const presentDays = countPresentDays(db, childId, monday, end, att);
  const flagCount = assessmentsOf(db, childId, monday, end).filter((a) => a.flag).length;
  return {
    presentDays,
    flagCount,
    eligible: presentDays >= TICKET_RULES.WEEK_MIN_PRESENT_DAYS && flagCount >= TICKET_RULES.WEEK_MIN_FLAGS,
  };
};

const monthStats = (db, childId, month) => {
  const weeklyTickets = db.behaviourTickets.filter(
    (t) => t.childId === childId && t.type === TICKET_TYPE.WEEKLY && monthOfWeek(t.periodStart) === month,
  ).length;
  return { weeklyTickets, eligible: weeklyTickets >= TICKET_RULES.MONTH_MIN_WEEKLY_TICKETS };
};

const makeTicket = (cls, child, type, start, end, userId, stats) => ({
  id: uid('bt'),
  type,
  periodStart: start,
  periodEnd: end,
  childId: child.id,
  classId: cls.id,
  campusId: cls.campusId,
  issuedAt: nowIso(),
  issuedBy: userId,
  presentDays: stats.presentDays ?? null,
  flagCount: stats.flagCount ?? null,
  weeklyTickets: stats.weeklyTickets ?? null,
  publishedToParentsAt: nowIso(),
});

/* ---------------- scope ---------------- */

const requireClassTeacher = (db, classId, user) => {
  const cls = classOf(db, classId);
  if (!cls) throw new ApiError(404, 'Không tìm thấy lớp.');
  if (!isClassTeacher(cls, user)) forbid();
  return cls;
};

const teacherClassIds = (db, user) => new Set((db.classes || []).filter((c) => isClassTeacher(c, user)).map((c) => c.id));

const withNames = (db, row) => ({
  ...row,
  childName: childOf(db, row.childId)?.fullName || '—',
  childCode: childOf(db, row.childId)?.code || '',
  className: classOf(db, row.classId)?.name || '—',
});

/** Leaders never receive the AI draft text (only teacher-confirmed content is published). */
const publicEvaluation = (ev, cls, user) => (canViewAiDraft(ev, cls, user) ? ev : { ...ev, aiDraft: null, aiError: null });

/* ---------------- repository ---------------- */

export const assessmentMockRepository = {
  async getCriteria() {
    await delay(60);
    return clone(ensureReady().assessmentCriteria);
  },

  /* ----- #52 Daily assessment ----- */
  async getDailySheet({ classId, date, activity }, user) {
    await delay();
    const db = ensureReady();
    const cls = requireClassTeacher(db, classId, user);
    if (!date || date > todayIso()) throw new ApiError(422, 'Chỉ đánh giá cho hôm nay hoặc ngày đã qua.');
    if (!isSchoolDay(date)) throw new ApiError(422, 'Ngày đã chọn không phải ngày học.');
    const activities = assessableActivities(cls.ageGroupId);
    const current = activities.includes(activity) ? activity : activities.find((a) => a === 'Hoạt động học') || activities[0];
    const att = attendanceIndex(db);
    const rows = activeChildrenOf(db, classId).map((child) => {
      const attendanceStatus = att.get(`${date}|${child.id}`) || null;
      const assessment = db.dailyAssessments.find((a) => a.childId === child.id && a.date === date && a.activity === current) || null;
      return { child, attendanceStatus, present: !attendanceStatus || attendanceStatus === 'PRESENT', assessment };
    });
    return clone({
      cls,
      date,
      activity: current,
      activities,
      locked: isAssessmentLocked(date),
      attendanceTaken: rows.some((r) => r.attendanceStatus),
      criteria: db.assessmentCriteria.filter((c) => c.active),
      rows,
    });
  },

  async saveDailyAssessments({ classId, date, activity, entries }, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const cls = requireClassTeacher(db, classId, user);
      if (!canRecordDailyAssessment(cls, user)) forbid();
      if (!date || date > todayIso() || !isSchoolDay(date)) throw new ApiError(422, 'Ngày đánh giá không hợp lệ.');
      if (!assessableActivities(cls.ageGroupId).includes(activity))
        throw new ApiError(422, 'Hoạt động không thuộc thời khóa biểu của lớp.');
      if (!entries?.length) throw new ApiError(422, 'Chưa có thay đổi nào để lưu.');
      const locked = isAssessmentLocked(date);
      const att = attendanceIndex(db);
      const kids = new Map(activeChildrenOf(db, classId).map((c) => [c.id, c]));
      const details = {};
      entries.forEach((e) => {
        const child = kids.get(e.childId);
        if (!child) {
          details[e.childId] = { childId: 'Trẻ không thuộc lớp này.' };
          return;
        }
        const status = att.get(`${date}|${e.childId}`);
        if (status && status !== 'PRESENT') {
          details[e.childId] = { childId: `${child.fullName} vắng ngày này nên không thể đánh giá.` };
          return;
        }
        const existing = db.dailyAssessments.find((a) => a.childId === e.childId && a.date === date && a.activity === activity);
        if (existing && existing.recordedBy !== user.id) {
          details[e.childId] = { childId: 'Chỉ giáo viên đã ghi nhận được sửa đánh giá này.' };
          return;
        }
        const errors = validateDailyEntry(e, { locked: locked && !!existing });
        if (hasErrors(errors)) details[e.childId] = errors;
      });
      if (Object.keys(details).length) throw new ApiError(422, 'Một số dòng chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', details);

      const at = nowIso();
      entries.forEach((e) => {
        const values = {
          healthStatus: e.healthStatus,
          emotion: e.emotion,
          criteriaMet: (e.criteriaMet || []).filter((id) => db.assessmentCriteria.some((c) => c.id === id)),
          flag: !!e.flag,
          comment: (e.comment || '').trim(),
        };
        const existing = db.dailyAssessments.find((a) => a.childId === e.childId && a.date === date && a.activity === activity);
        if (existing) {
          Object.assign(existing, values, { updatedAt: at, parentNotifiedAt: at });
          if (locked) existing.corrections.push({ at, userId: user.id, reason: e.correctionReason.trim() });
        } else {
          db.dailyAssessments.push({
            id: uid('da'),
            date,
            classId,
            campusId: cls.campusId,
            childId: e.childId,
            activity,
            ...values,
            recordedBy: user.id,
            recordedAt: at,
            updatedAt: null,
            corrections: [],
            // Parents use the mobile app: the backend notifies the linked parents here (UC 4.4 step 7).
            parentNotifiedAt: at,
          });
        }
      });
      return { saved: entries.length };
    });
  },

  /* ----- #53 / #54 Development profile & progress ----- */
  async getChildDevelopment(childId, { mode = 'profile', start, end }, user) {
    await delay();
    const db = ensureReady();
    const child = childOf(db, childId);
    if (!child) throw new ApiError(404, 'Không tìm thấy trẻ.');
    const cls = classOf(db, child.classId);
    const allowed = mode === 'progress' ? canViewDevelopmentProgress(child, user) : canViewDevelopmentProfile(cls, user);
    if (!allowed) forbid();
    const to = end > todayIso() ? todayIso() : end;
    const att = attendanceIndex(db);
    const daily = assessmentsOf(db, childId, start, to).sort((a, b) => (a.date < b.date ? 1 : -1));
    const confirmed = (list) => list.filter((e) => e.childId === childId && e.status === EVAL_STATUS.CONFIRMED);
    const evaluations = confirmed(db.periodicEvaluations)
      .filter((e) => e.periodEnd >= start && e.periodStart <= to)
      .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
    const weeks =
      to >= start
        ? weeksBetween(start, to).map((w) => {
            const list = assessmentsOf(db, childId, w, weekEnd(w));
            const stats = weekStats(db, childId, w, att);
            const met = list.reduce((s, a) => s + a.criteriaMet.length, 0);
            const possible = list.length * db.assessmentCriteria.filter((c) => c.active).length;
            return {
              weekStart: w,
              weekEnd: weekEnd(w),
              assessments: list.length,
              presentDays: stats.presentDays,
              flags: stats.flagCount,
              criteriaRate: possible ? Math.round((met / possible) * 100) : null,
              evaluationConfirmed: evaluations.some((e) => e.periodType === PERIOD_TYPE.WEEK && e.periodStart === w),
              finished: weekEnd(w) < todayIso(),
            };
          })
        : [];
    const domainStats = {};
    db.assessmentCriteria.forEach((c) => {
      domainStats[c.domain] ||= { domain: c.domain, met: 0, possible: 0 };
      domainStats[c.domain].possible += daily.length;
      domainStats[c.domain].met += daily.filter((a) => a.criteriaMet.includes(c.id)).length;
    });
    return clone({
      child,
      cls,
      range: { start, end: to },
      criteria: db.assessmentCriteria,
      dailyAssessments: daily,
      weeks,
      domainStats: Object.values(domainStats),
      evaluations,
      yearEnd: confirmed(db.yearEndEvaluations).filter((e) => e.periodStart <= to && e.periodEnd >= start),
      tickets: db.behaviourTickets
        .filter((t) => t.childId === childId && t.periodEnd >= start && t.periodStart <= to)
        .sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1)),
      rewards: db.rewardProposals.filter((p) => p.childId === childId && p.status === REWARD_STATUS.APPROVED),
    });
  },

  /* ----- #55 / #58 Evaluation lists ----- */
  async listEvaluations(kind, filters = {}, user) {
    await delay();
    const db = ensureReady();
    if (!user || user.role === ROLES.KITCHEN_STAFF) forbid();
    const mine = teacherClassIds(db, user);
    let list = db[evalCollection(kind)].filter((ev) => {
      if (mine.has(ev.classId)) return true;
      return isLeader(user) && ev.status === EVAL_STATUS.CONFIRMED && inLeaderScope(ev.campusId, user);
    });
    if (filters.classId) list = list.filter((e) => e.classId === filters.classId);
    if (filters.periodType) list = list.filter((e) => e.periodType === filters.periodType);
    if (filters.schoolYear) list = list.filter((e) => e.schoolYear === filters.schoolYear);
    return clone(
      list
        .map((e) => withNames(db, publicEvaluation(e, classOf(db, e.classId), user)))
        .sort((a, b) =>
          a.periodStart === b.periodStart ? a.childName.localeCompare(b.childName) : a.periodStart < b.periodStart ? 1 : -1,
        ),
    );
  },

  /* ----- #56 / #57 / #59 Evaluation detail ----- */
  async getEvaluation(kind, id, user) {
    await delay();
    const db = ensureReady();
    const ev = db[evalCollection(kind)].find((e) => e.id === id);
    if (!ev) throw new ApiError(404, 'Không tìm thấy đánh giá.');
    const cls = classOf(db, ev.classId);
    if (!canViewEvaluation(ev, cls, user)) forbid();
    const child = childOf(db, ev.childId);
    const assessments = assessmentsOf(db, ev.childId, ev.periodStart, ev.periodEnd).sort((a, b) => (a.date < b.date ? -1 : 1));
    const monthly =
      ev.periodType === PERIOD_TYPE.YEAR
        ? db.periodicEvaluations
            .filter((m) => m.childId === ev.childId && m.periodType === PERIOD_TYPE.MONTH && m.status === EVAL_STATUS.CONFIRMED)
            .sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1))
        : [];
    return clone({
      evaluation: withNames(db, publicEvaluation(ev, cls, user)),
      child,
      cls,
      criteria: db.assessmentCriteria,
      // The year-end view lists the confirmed monthly evaluations instead of every daily record.
      assessments: ev.periodType === PERIOD_TYPE.YEAR ? [] : assessments,
      monthlyEvaluations: monthly,
      summary: {
        presentDays: countPresentDays(db, ev.childId, ev.periodStart, ev.periodEnd),
        assessmentCount: assessments.length,
        flagCount: assessments.filter((a) => a.flag).length,
        activities: [...new Set(assessments.map((a) => a.activity))],
      },
    });
  },

  async saveEvaluationDraft(kind, id, content, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const ev = db[evalCollection(kind)].find((e) => e.id === id);
      if (!ev) throw new ApiError(404, 'Không tìm thấy đánh giá.');
      const cls = classOf(db, ev.classId);
      if (ev.status === EVAL_STATUS.CONFIRMED) throw new ApiError(409, MSG37);
      if (!canReviewEvaluation(ev, cls, user)) forbid();
      const errors = validateEvaluationContent(content);
      if (hasErrors(errors)) throw new ApiError(422, errors.content, errors);
      ev.finalContent = content.trim();
      ev.history.push({ id: uid('eh'), action: 'EDITED', userId: user.id, at: nowIso() });
      return clone(ev);
    });
  },

  async confirmEvaluation(kind, id, content, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const ev = db[evalCollection(kind)].find((e) => e.id === id);
      if (!ev) throw new ApiError(404, 'Không tìm thấy đánh giá.');
      const cls = classOf(db, ev.classId);
      if (ev.status === EVAL_STATUS.CONFIRMED) throw new ApiError(409, MSG37);
      if (!canReviewEvaluation(ev, cls, user)) forbid();
      const errors = validateEvaluationContent(content);
      if (hasErrors(errors)) throw new ApiError(422, errors.content, errors);
      const at = nowIso();
      Object.assign(ev, {
        status: EVAL_STATUS.CONFIRMED,
        finalContent: content.trim(),
        confirmedBy: user.id,
        confirmedAt: at,
        publishedAt: at,
      });
      ev.history.push({ id: uid('eh'), action: 'CONFIRMED', userId: user.id, at });
      const child = childOf(db, ev.childId);
      const label = periodLabel(ev.periodType, ev.periodStart, ev.periodEnd);
      const yearEnd = kind === EVAL_KIND.YEAR_END;
      // Weekly / monthly: published to parents (mobile app), VP and Principal. Year-end: stored for leadership.
      leadersOf(db, ev.campusId).forEach((u) =>
        pushNotification(db, {
          userId: u.id,
          type: 'EVALUATION_CONFIRMED',
          title: yearEnd ? 'Đánh giá cuối năm đã xác nhận' : 'Đánh giá định kỳ đã công bố',
          message: `${child?.fullName} (${cls?.name}) – ${label}.`,
          link: `/assessment/${yearEnd ? 'year-end' : 'periodic'}/${ev.id}`,
        }),
      );
      return clone(ev);
    });
  },

  async regenerateEvaluationDraft(kind, id, user) {
    await delay(900);
    ensureReady();
    return writeDb((db) => {
      const ev = db[evalCollection(kind)].find((e) => e.id === id);
      if (!ev) throw new ApiError(404, 'Không tìm thấy đánh giá.');
      const cls = classOf(db, ev.classId);
      if (ev.status === EVAL_STATUS.CONFIRMED) throw new ApiError(409, MSG37);
      if (!canReviewEvaluation(ev, cls, user)) forbid();
      // Replaces the earlier unconfirmed draft; the teacher's own edits (finalContent) are kept.
      applyDraft(db, ev, { userId: user.id, redraft: true });
      return clone(ev);
    });
  },

  /* ----- #60 Good behaviour tickets ----- */
  async getTicketBoard({ classId, type = TICKET_TYPE.WEEKLY, periodStart }, user) {
    await delay();
    const db = ensureReady();
    const cls = requireClassTeacher(db, classId, user);
    const today = todayIso();
    const { start: yStart } = schoolYearRange(schoolYearOf(today));
    const classDates = db.dailyAssessments.filter((a) => a.classId === classId && a.date >= yStart).map((a) => a.date);
    const first = classDates.length ? classDates.reduce((m, d) => (d < m ? d : m)) : today;
    const periods = (type === TICKET_TYPE.WEEKLY ? weeksBetween(first, today) : monthsBetween(first, today))
      .map((s) => ({ start: s, end: type === TICKET_TYPE.WEEKLY ? weekEnd(s) : monthEnd(s) }))
      .filter((p) => p.end < today)
      .reverse();
    const current = periods.find((p) => p.start === periodStart) || periods[0] || null;
    const att = attendanceIndex(db);
    const rows = current
      ? activeChildrenOf(db, classId).map((child) => {
          const stats = type === TICKET_TYPE.WEEKLY ? weekStats(db, child.id, current.start, att) : monthStats(db, child.id, current.start);
          const ticket =
            db.behaviourTickets.find((t) => t.childId === child.id && t.type === type && t.periodStart === current.start) || null;
          return { child, ...stats, ticket };
        })
      : [];
    return clone({ cls, type, periods, period: current, rows, rules: TICKET_RULES });
  },

  async issueTickets({ classId, type, periodStart, childIds }, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const cls = requireClassTeacher(db, classId, user);
      if (!canIssueTickets(cls, user)) forbid();
      if (!childIds?.length) throw new ApiError(422, 'Chọn ít nhất một trẻ để phát phiếu.');
      const end = type === TICKET_TYPE.WEEKLY ? weekEnd(periodStart) : monthEnd(periodStart);
      if (end >= todayIso()) throw new ApiError(422, 'Chỉ phát phiếu khi tuần hoặc tháng đã kết thúc.');
      const kids = new Map(activeChildrenOf(db, classId).map((c) => [c.id, c]));
      const att = attendanceIndex(db);
      const issued = [];
      childIds.forEach((childId) => {
        const child = kids.get(childId);
        if (!child) throw new ApiError(422, 'Trẻ không thuộc lớp này.');
        if (db.behaviourTickets.some((t) => t.childId === childId && t.type === type && t.periodStart === periodStart)) {
          throw new ApiError(409, `${child.fullName} đã được phát phiếu cho kỳ này. Hãy tải lại danh sách.`);
        }
        const stats = type === TICKET_TYPE.WEEKLY ? weekStats(db, childId, periodStart, att) : monthStats(db, childId, periodStart);
        // GBR-REW-01/02: a child who does not meet the criteria cannot receive a ticket.
        if (!stats.eligible) throw new ApiError(422, `${child.fullName} chưa đủ điều kiện nhận ${TICKET_TYPE_LABELS[type].toLowerCase()}.`);
        const ticket = makeTicket(cls, child, type, periodStart, end, user.id, stats);
        db.behaviourTickets.push(ticket);
        issued.push(ticket);
      });
      return clone(issued);
    });
  },

  /* ----- #61–#63 Year-end reward proposals ----- */
  async listRewardProposals(filters = {}, user) {
    await delay();
    const db = ensureReady();
    if (!user || user.role === ROLES.KITCHEN_STAFF) forbid();
    let list = db.rewardProposals.filter((p) => canViewRewardProposal(p, classOf(db, p.classId), user));
    if (filters.schoolYear) list = list.filter((p) => p.schoolYear === filters.schoolYear);
    return clone(
      list.map((p) => withNames(db, p)).sort((a, b) => ((a.submittedAt || a.createdAt) < (b.submittedAt || b.createdAt) ? 1 : -1)),
    );
  },

  async getRewardProposal(id, user) {
    await delay();
    const db = ensureReady();
    const p = db.rewardProposals.find((x) => x.id === id);
    if (!p) throw new ApiError(404, 'Không tìm thấy đề xuất.');
    const cls = classOf(db, p.classId);
    if (!canViewRewardProposal(p, cls, user)) forbid();
    const yearEnd = db.yearEndEvaluations.find((e) => e.childId === p.childId && e.schoolYear === p.schoolYear) || null;
    const { start, end } = schoolYearRange(p.schoolYear);
    return clone({
      proposal: withNames(db, p),
      child: childOf(db, p.childId),
      cls,
      yearEnd: yearEnd && yearEnd.status === EVAL_STATUS.CONFIRMED ? yearEnd : null,
      ticketCounts: {
        weekly: db.behaviourTickets.filter(
          (t) => t.childId === p.childId && t.type === TICKET_TYPE.WEEKLY && t.periodStart >= start && t.periodEnd <= end,
        ).length,
        monthly: db.behaviourTickets.filter(
          (t) => t.childId === p.childId && t.type === TICKET_TYPE.MONTHLY && t.periodStart >= start && t.periodEnd <= end,
        ).length,
      },
    });
  },

  /** UC 4.12 step 2: children of the teacher's classes with their confirmed year-end evaluation. */
  async getRewardCandidates(schoolYear, user) {
    await delay();
    const db = ensureReady();
    if (!canCreateRewardProposal(user)) forbid();
    const classes = db.classes.filter((c) => isClassTeacher(c, user));
    return clone(
      classes.map((cls) => ({
        cls,
        children: activeChildrenOf(db, cls.id).map((child) => {
          const ye = db.yearEndEvaluations.find((e) => e.childId === child.id && e.schoolYear === schoolYear) || null;
          return {
            child,
            yearEnd: ye && ye.status === EVAL_STATUS.CONFIRMED ? ye : null,
            yearEndStatus: ye?.status || null,
            proposals: db.rewardProposals
              .filter((p) => p.childId === child.id && p.schoolYear === schoolYear && p.status !== REWARD_STATUS.REJECTED)
              .map((p) => ({ id: p.id, rewardTitle: p.rewardTitle, status: p.status })),
          };
        }),
      })),
    );
  },

  async saveRewardProposal(id, payload, { submit = false } = {}, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      if (!canCreateRewardProposal(user)) forbid();
      const existing = id ? db.rewardProposals.find((p) => p.id === id) : null;
      if (id && !existing) throw new ApiError(404, 'Không tìm thấy đề xuất.');
      if (existing && !canEditRewardProposal(existing, user)) {
        if (existing.createdBy === user.id) throw new ApiError(409, MSG37);
        forbid();
      }
      const errors = validateRewardProposal(payload);
      if (hasErrors(errors)) throw new ApiError(422, 'Vui lòng kiểm tra các trường được đánh dấu.', errors);
      const cls = requireClassTeacher(db, payload.classId, user);
      const child = activeChildrenOf(db, cls.id).find((c) => c.id === payload.childId);
      if (!child) throw new ApiError(422, 'Trẻ không thuộc lớp đã chọn.', { childId: 'Trẻ không thuộc lớp đã chọn.' });
      const schoolYear = payload.schoolYear;
      if (submit) {
        const ye = db.yearEndEvaluations.find((e) => e.childId === child.id && e.schoolYear === schoolYear);
        if (!ye || ye.status !== EVAL_STATUS.CONFIRMED)
          throw new ApiError(422, MSG32, { childId: 'Trẻ chưa có đánh giá cuối năm đã xác nhận.' });
      }
      const title = payload.rewardTitle.trim();
      const duplicate = db.rewardProposals.some(
        (p) =>
          p.id !== id &&
          p.childId === child.id &&
          p.schoolYear === schoolYear &&
          p.rewardTitle === title &&
          p.status !== REWARD_STATUS.REJECTED,
      );
      if (duplicate)
        throw new ApiError(409, 'Trẻ đã có đề xuất với danh hiệu này trong năm học.', {
          rewardTitle: 'Danh hiệu đã được đề xuất cho trẻ.',
        });

      const at = nowIso();
      const p = existing || {
        id: uid('rp'),
        code: `KT${schoolYear.slice(2, 4)}-${String(db.rewardProposals.filter((x) => x.schoolYear === schoolYear).length + 1).padStart(3, '0')}`,
        schoolYear,
        status: REWARD_STATUS.DRAFT,
        createdBy: user.id,
        createdAt: at,
        submittedAt: null,
        vpReview: null,
        principalDecision: null,
        approvedAt: null,
        approvedBy: null,
        history: [{ id: uid('rh'), action: 'CREATED', userId: user.id, at }],
      };
      const wasReturned = p.status === REWARD_STATUS.RETURNED;
      Object.assign(p, { childId: child.id, classId: cls.id, campusId: cls.campusId, rewardTitle: title, reason: payload.reason.trim() });
      if (existing && !submit) p.history.push({ id: uid('rh'), action: 'UPDATED', userId: user.id, at });
      if (submit) {
        p.status = REWARD_STATUS.PENDING_VP;
        p.submittedAt = at;
        p.history.push({ id: uid('rh'), action: wasReturned ? 'RESUBMITTED' : 'SUBMITTED', userId: user.id, at });
        usersWhere(db, (u) => u.role === ROLES.VICE_PRINCIPAL && u.campusId === cls.campusId).forEach((u) =>
          pushNotification(db, {
            userId: u.id,
            type: 'REWARD_SUBMITTED',
            title: 'Đề xuất khen thưởng chờ xem xét',
            message: `${p.code}: ${title} – ${child.fullName} (${cls.name}).`,
            link: `/assessment/rewards/${p.id}`,
          }),
        );
      }
      if (!existing) db.rewardProposals.unshift(p);
      return clone(p);
    });
  },

  async deleteRewardProposal(id, user) {
    await delay();
    ensureReady();
    writeDb((db) => {
      const p = db.rewardProposals.find((x) => x.id === id);
      if (!p) throw new ApiError(404, 'Không tìm thấy đề xuất.');
      if (!canDeleteRewardProposal(p, user)) forbid();
      db.rewardProposals = db.rewardProposals.filter((x) => x.id !== id);
    });
  },

  /** UC 4.3: Vice Principal forwards to the Principal or returns to the teacher (reason required). */
  async reviewRewardProposal(id, { decision, comment }, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const p = db.rewardProposals.find((x) => x.id === id);
      if (!p) throw new ApiError(404, 'Không tìm thấy đề xuất.');
      if (user?.role !== ROLES.VICE_PRINCIPAL || user.campusId !== p.campusId) forbid();
      if (!canReviewRewardProposal(p, user)) throw new ApiError(409, MSG37);
      if (!['FORWARD', 'RETURN'].includes(decision)) throw new ApiError(422, 'Quyết định không hợp lệ.');
      const errors = validateDecision({ negative: decision === 'RETURN', comment });
      if (hasErrors(errors)) throw new ApiError(422, errors.comment, errors);
      const at = nowIso();
      p.vpReview = { by: user.id, at, decision, comment: (comment || '').trim() };
      p.status = decision === 'FORWARD' ? REWARD_STATUS.PENDING_PRINCIPAL : REWARD_STATUS.RETURNED;
      p.history.push({
        id: uid('rh'),
        action: decision === 'FORWARD' ? 'FORWARDED' : 'RETURNED',
        userId: user.id,
        at,
        note: p.vpReview.comment,
      });
      const child = childOf(db, p.childId);
      pushNotification(db, {
        userId: p.createdBy,
        type: 'REWARD_REVIEWED',
        title: decision === 'FORWARD' ? 'Đề xuất khen thưởng đã chuyển Hiệu trưởng' : 'Đề xuất khen thưởng bị trả lại',
        message: `${p.code}: ${p.rewardTitle} – ${child?.fullName}.${decision === 'RETURN' ? ` Lý do: ${p.vpReview.comment}` : ''}`,
        link: `/assessment/rewards/${p.id}`,
      });
      if (decision === 'FORWARD') {
        usersWhere(db, (u) => u.role === ROLES.PRINCIPAL).forEach((u) =>
          pushNotification(db, {
            userId: u.id,
            type: 'REWARD_PENDING_APPROVAL',
            title: 'Đề xuất khen thưởng chờ phê duyệt',
            message: `${p.code}: ${p.rewardTitle} – ${child?.fullName}.`,
            link: `/assessment/rewards/${p.id}`,
          }),
        );
      }
      return clone(p);
    });
  },

  /** UC 4.2: Principal approves or rejects (reason required); teacher and reviewing VP are notified. */
  async decideRewardProposal(id, { decision, comment }, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const p = db.rewardProposals.find((x) => x.id === id);
      if (!p) throw new ApiError(404, 'Không tìm thấy đề xuất.');
      if (user?.role !== ROLES.PRINCIPAL) forbid();
      if (!canDecideRewardProposal(p, user)) throw new ApiError(409, MSG37);
      if (!['APPROVE', 'REJECT'].includes(decision)) throw new ApiError(422, 'Quyết định không hợp lệ.');
      const errors = validateDecision({ negative: decision === 'REJECT', comment });
      if (hasErrors(errors)) throw new ApiError(422, errors.comment, errors);
      const at = nowIso();
      p.principalDecision = { by: user.id, at, decision, comment: (comment || '').trim() };
      if (decision === 'APPROVE') {
        p.status = REWARD_STATUS.APPROVED;
        p.approvedAt = at;
        p.approvedBy = user.id;
        // Approved rewards are published to parents through the mobile app.
        p.publishedToParentsAt = at;
      } else {
        p.status = REWARD_STATUS.REJECTED;
      }
      p.history.push({
        id: uid('rh'),
        action: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        userId: user.id,
        at,
        note: p.principalDecision.comment,
      });
      const child = childOf(db, p.childId);
      [p.createdBy, p.vpReview?.by].filter(Boolean).forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'REWARD_DECIDED',
          title: decision === 'APPROVE' ? 'Đề xuất khen thưởng đã được phê duyệt' : 'Đề xuất khen thưởng bị từ chối',
          message: `${p.code}: ${p.rewardTitle} – ${child?.fullName}.${decision === 'REJECT' ? ` Lý do: ${p.principalDecision.comment}` : ''}`,
          link: `/assessment/rewards/${p.id}`,
        }),
      );
      return clone(p);
    });
  },
};
