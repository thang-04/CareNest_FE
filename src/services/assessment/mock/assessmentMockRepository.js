import { activeYearEnd, activeYearStart } from '@/mocks/roomManagers';
import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { buildAssessmentSeed } from '@/mocks/assessmentSeed';
import { EDU_SEED_VERSION, ensureEduDemo, seedTodayAttendance } from '@/mocks/educationPlanSeed';
import { EDU_STATUS, goalRequirements } from '@/models/education-plan/educationPlanConstants';
import { DAY_SECTIONS, cellKey, hocTitle, longDay, rowCell, weekRows, yearWeeks } from '@/models/education-plan/classPlan';
import { numberGoals } from '@/models/education-plan/goalTable';
import { remapCriteriaToPlan } from '@/models/education-plan/planVersions.mjs';
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
  isUnlockActive,
  unlockDeadline,
} from '@/utils/assessment/assessmentPeriods';
import {
  canCreateRewardProposal,
  canDecideRewardProposal,
  canDeleteRewardProposal,
  canEditRewardProposal,
  canIssueTickets,
  canRecordDailyAssessment,
  canUnlockAssessmentDay,
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
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';
import { orderSessions } from '@/models/attendance/attendanceConstants';
import { BEHAVIORS, EATING, NAP, POSITIVE_BEHAVIORS, PREFILL_FEVER_LEVELS } from '@/models/assessment/dailyObservationOptions';
import { HEALTH_SYMPTOMS, actionSummary } from '@/utils/dailyHealthValidation';
import { withEarlyPickup } from '@/mocks/dailyHealthMockRepository';
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

// Ngày điểm danh vắng không được đánh giá (xem saveDailyAssessments); bản ghi cũ trùng ngày vắng không đưa vào hồ sơ/tổng hợp
const absentDaysOf = (db, childId, start, end) =>
  new Set(
    (db.attendance || [])
      .filter((r) => r.childId === childId && r.date >= start && r.date <= end && r.status !== 'PRESENT')
      .map((r) => r.date),
  );

const assessmentsOf = (db, childId, start, end) => {
  const absent = absentDaysOf(db, childId, start, end);
  return db.dailyAssessments.filter((a) => a.childId === childId && a.date >= start && a.date <= end && !absent.has(a.date));
};

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

/* ---------------- Mục tiêu (MT) của giáo án ngày: kế hoạch ngày trong giáo án tuần đã duyệt của lớp ---------------- */

/** Mục tiêu năm học của mọi kế hoạch năm, ở dạng tiêu chí (MT + số) để tra tên khi hiển thị và tổng hợp. */
const goalCriteria = (db) =>
  (db.eduGoals || []).flatMap((plan) => {
    if (!plan.domains?.every((d) => d.rows)) return [];
    const numbers = numberGoals(plan.domains);
    return plan.domains.flatMap((d) =>
      d.rows
        .filter((r) => r.kind === 'goal' && numbers[r.id])
        .map((r) => ({ id: r.id, name: `MT${numbers[r.id]}`, domain: d.name, description: r.text, active: true, kind: 'MT' })),
    );
  });

/*
 * BE:EDU-19/26 (Tiền 28/10): đánh giá trẻ luôn theo MT của giáo án ngày đang dùng cho ngày đó. Giáo án ngày đổi sang
 * phiên bản kế hoạch năm mới thì MT đã chấm chuyển theo MT cùng lineage của phiên bản mới; MT bị bỏ không còn hiện.
 */
const toPlanCriteria = (db, plan, assessment) => remapCriteriaToPlan(db.eduGoals || [], plan?.yearPlanId, assessment);

/** YCCĐ có mã của bộ mục tiêu kiểu cũ (đánh giá đã lưu trước khi đổi sang giáo án tuần). */
const requirementCriteria = (db) => {
  const seen = new Set();
  return (db.eduGoals || [])
    .filter((g) => g.domains?.every((d) => Array.isArray(d.items)))
    .flatMap((g) => goalRequirements(g))
    .filter((r) => !seen.has(r.code) && seen.add(r.code))
    .map((r) => ({ id: r.code, name: r.code, domain: r.domain, description: r.text, active: true, kind: 'YCCD' }));
};

/** Bộ tiêu chí cũ + YCCĐ cũ + MT, dùng để tra tên khi hiển thị. */
const allCriteria = (db) => [...db.assessmentCriteria, ...requirementCriteria(db), ...goalCriteria(db)];

// Giờ sinh hoạt trong thời khóa biểu của đánh giá → dòng của bảng hoạt động trong giáo án tuần
const ACTIVITY_ROWS = [
  ['hoc', /^Hoạt động học/],
  ['ngoai_troi', /ngoài trời/i],
  ['goc', /trong lớp|góc/i],
  ['chieu', /chiều/i],
  ['the_duc', /^Thể dục/],
];
const rowKeyOf = (activity) => ACTIVITY_ROWS.find(([, re]) => re.test(activity))?.[0] || null;

/** Kế hoạch ngày = một ngày (Thứ 2–6) của giáo án tuần đã được duyệt (duyệt cả tuần một lần). */
const approvedDayPlan = (db, cls, date) => {
  // BE:EDU-26 — ngày có giáo án đã duyệt của nhiều phiên bản kế hoạch năm: dùng bản của phiên bản mới nhất
  const versionOfPlan = (id) => Number((db.eduGoals || []).find((g) => g.id === id)?.versionNo) || 1;
  const doc = (db.eduClassWeek || [])
    .filter((w) => w.classId === cls.id && w.status === EDU_STATUS.APPROVED && date >= w.weekStart && date <= addDays(w.weekStart, 4))
    .sort((a, b) => versionOfPlan(b.yearPlanId) - versionOfPlan(a.yearPlanId))[0];
  if (!doc) return null;
  return {
    id: doc.id,
    code: `Tuần ${doc.weekNo}`,
    themeId: doc.themeId,
    yearPlanId: doc.yearPlanId,
    doc,
    day: doc.days.findIndex((d) => d.date === date),
  };
};

const planCell = (plan, activity) => {
  const key = rowKeyOf(activity);
  const row = weekRows().find((r) => r.key === key);
  if (!plan || !row || plan.day < 0) return null;
  const cell = rowCell(plan.doc, row);
  const merged = !!row.canMerge && cell.allWeek;
  return { key: cellKey(key, merged ? 'all' : plan.day), cell, merged };
};

/** Nội dung của giờ đó trong giáo án ngày (tên đề tài giờ học hoặc hoạt động). */
const planTopic = (plan, activity) => {
  const c = planCell(plan, activity);
  if (!c) return '';
  if (c.merged) return c.cell.common || '';
  const v = c.cell.days?.[plan.day];
  return typeof v === 'string' ? v : [v?.subject, v?.topic].filter(Boolean).join(': ');
};

/*
 * Phần của kế hoạch ngày ứng với giờ đang đánh giá (HĐ học, ngoài trời, buổi chiều): tên mục, dòng mục đích yêu cầu
 * của hoạt động đó, các hoạt động của cô. Giờ không có mục riêng trong kế hoạch ngày thì null.
 */
const AIM_HEAD = {
  hoc: /^-?\s*Hoạt động học/i,
  ngoai_troi: /^-?\s*Chơi, hoạt động ngoài trời/i,
  chieu: /^-?\s*Chơi, hoạt động (theo ý thích )?buổi chiều/i,
};
const longDayOf = (plan) => {
  const day = plan?.doc.days?.[plan.day];
  return day ? longDay(day.date, plan.day) : '';
};
const planDayPart = (plan, activity) => {
  const key = rowKeyOf(activity);
  const section = DAY_SECTIONS.find((x) => x.key === key);
  const day = plan?.doc.days?.[plan.day];
  if (!section || !day) return null;
  const hoc = plan.doc.grid.hoc?.days?.[plan.day] || {};
  const lines = (t) =>
    String(t || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  return {
    dayLabel: longDay(day.date, plan.day),
    title: `${section.label}${key === 'hoc' && hocTitle(hoc) ? `: ${hocTitle(hoc)}` : ''}`,
    aims: lines(day.aims).filter((l) => AIM_HEAD[key]?.test(l)),
    steps: section.parts.flatMap((x) => lines(day.steps?.[`${section.key}.${x.key}`]?.teacher)).filter((l) => /^Hoạt động \d+/.test(l)),
  };
};

/** Tiêu chí của một giờ sinh hoạt = các mục tiêu (MT) của hoạt động đã chọn ở ô đó trong giáo án tuần. */
const planCriteria = (db, plan, activity) => {
  const c = planCell(plan, activity);
  if (!c) return [];
  // Kèm MT của phần chung cả tuần của dòng (Chơi tự do, Chơi tự chọn…)
  const keys = c.merged ? [c.key] : [c.key, cellKey(rowKeyOf(activity), 'extra')];
  const ids = [...new Set(keys.flatMap((k) => plan.doc.picks?.[k] || []).map((x) => x.goalId))];
  const known = Object.fromEntries(goalCriteria(db).map((x) => [x.id, x]));
  return ids.map((id) => known[id]).filter(Boolean);
};

/*
 * Gợi ý cờ bé ngoan của ngày (Tiền 21/10, phương án 1): trẻ được gợi ý cờ khi mọi giờ ở Kiến thức kỹ năng đều Đạt, mức tham
 * gia không "Chưa tích cực", hành vi không có mục cần lưu ý và cảm xúc không Buồn / Quấy khóc. Cô vẫn bỏ / cắm được; mỗi trẻ
 * 1 cờ / ngày. PROPOSED rule: BE phải sở hữu và chốt lại tiêu chí.
 */
const flagSuggestionOf = (db, childId, date) => {
  const obs = observationOf(db, childId, date);
  const records = db.dailyAssessments.filter((a) => a.childId === childId && a.date === date);
  const reasons = [];
  if (records.some((a) => (a.criteriaNotMet || []).length)) reasons.push('Có giờ chưa đạt ở Kiến thức kỹ năng');
  if (records.some((a) => a.participation === 'CHUA_TICH_CUC')) reasons.push('Có giờ tham gia chưa tích cực');
  if ((obs?.behaviors || []).some((b) => !POSITIVE_BEHAVIORS.includes(b))) reasons.push('Hành vi có mục cần lưu ý');
  if (['SAD', 'UPSET'].includes(obs?.emotion)) reasons.push('Cảm xúc buồn hoặc quấy khóc');
  return { eligible: reasons.length === 0, reasons };
};

/* ---------------- 3 nhóm đánh giá ngày: điền sẵn, tổng hợp theo kỳ ---------------- */

const observationOf = (db, childId, date) => (db.dailyObservations || []).find((o) => o.childId === childId && o.date === date) || null;

/** Bữa ăn của lớp = các bữa Hiệu trưởng cấu hình cho nhóm tuổi. */
const mealSessionsOf = (db, cls) => orderSessions((db.ageGroups || []).find((g) => g.id === cls.ageGroupId)?.mealSessions);

/** Giờ hh:mm theo giờ Việt Nam của một thời điểm ISO. */
const vnTime = (iso) => new Date(new Date(iso).getTime() + 7 * 3600000).toISOString().slice(11, 16);

/** Biểu hiện của một lần khám sức khỏe; thân nhiệt từ mức Sốt trở lên thêm "Sốt" (FEVER). */
const checkSigns = (e) => {
  const signs = new Set(e.symptoms || []);
  if (PREFILL_FEVER_LEVELS.includes(temperatureLevel(e.temperature)?.key)) signs.add('FEVER');
  // Cô chọn "Có dấu hiệu cần lưu ý" nhưng chỉ ghi chú (vd. chảy máu cam), không tích biểu hiện: điền "Khác"
  if (e.observation === 'NOTED' && !signs.size) signs.add('OTHER');
  return Object.keys(HEALTH_SYMPTOMS).filter((k) => signs.has(k));
};

/**
 * Khám sức khỏe trong ngày ở màn Điểm danh (chỉ đọc). prefill = biểu hiện của lần mới nhất để điền sẵn ô Sức khỏe;
 * worstTemperature chỉ dùng để tổng hợp (màn Đánh giá không hiển thị thân nhiệt).
 */
const healthCheckOf = (db, childId, date) => {
  const list = (db.dailyHealthEntries || [])
    .filter((e) => e.childId === childId && e.date === date)
    .sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
  if (!list.length) return null;
  const latest = list.at(-1);
  const temps = list.map((e) => e.temperature).filter((t) => Number.isFinite(t));
  return {
    prefill: checkSigns(latest),
    note: latest.note || '',
    // Xử trí trong ngày (đưa phòng y tế, về sớm...) để hiện ở ô Sức khỏe và đếm theo kỳ
    actions: actionSummary(list.map((e) => withEarlyPickup(db, e))),
    actionKeys: [...new Set(list.flatMap((e) => e.actions || []))],
    at: latest.recordedAt,
    time: vnTime(latest.recordedAt),
    count: list.length,
    worstTemperature: temps.length ? Math.max(...temps) : null,
  };
};

/**
 * Ô Sức khỏe của một ngày: cô chưa sửa thì theo lần khám mới nhất (tính lại mỗi lần tải); cô đã sửa thì giữ lựa chọn
 * của cô và báo khi khám sức khỏe có lần mới hơn với biểu hiện khác (để cô bấm Áp dụng).
 */
const dayHealthOf = (db, childId, date) => {
  const check = healthCheckOf(db, childId, date);
  const obs = observationOf(db, childId, date);
  const overridden = !!obs?.healthOverridden;
  const signs = overridden ? obs.healthSigns || [] : check?.prefill || [];
  const changed = overridden && !!check && check.at > (obs.healthSetAt || '') && check.prefill.join() !== signs.join();
  // Ghi chú: cô đã ghi thì giữ, chưa ghi thì lấy ghi chú của lần khám mới nhất
  const note = obs?.healthNote || (!overridden && check?.note) || '';
  return { signs, note, overridden, check, update: changed ? { time: check.time, signs: check.prefill } : null };
};

/** Bữa cô đã tắt "Tham gia ăn" khi điểm danh: cố định Không ăn. */
const skippedMealsOf = (db, childId, date, sessions) => {
  const rec = (db.attendance || []).find((r) => r.childId === childId && r.date === date);
  return rec?.meals ? sessions.filter((m) => rec.meals[m] === false) : [];
};

/** Bản ghi trước 3 nhóm chỉ có healthStatus / emotion ở từng hoạt động: quy về một ngày. */
const legacyDay = (records) => {
  if (!records.length) return null;
  return {
    legacy: true,
    meals: {},
    nap: null,
    emotion: records[0].emotion,
    behaviors: [],
  };
};

const goalOfId = (db) => Object.fromEntries(allCriteria(db).map((c) => [c.id, c]));
const themeNames = (db) => Object.fromEntries((db.eduGoals || []).flatMap((g) => g.themes || []).map((t) => [t.id, t.name || t.id]));

/**
 * Tổng hợp có cấu trúc của một trẻ trong kỳ, đếm thẳng từ ô tích (không cần AI): sức khỏe, ăn theo bữa, ngủ,
 * cảm xúc, hành vi, mức tham gia, YCCĐ đạt / chưa đạt theo chủ đề và mục tiêu năm học.
 */
export const periodSummaryOf = (db, childId, start, end) => {
  const records = assessmentsOf(db, childId, start, end);
  const days = new Set(records.map((a) => a.date));
  const absent = absentDaysOf(db, childId, start, end);
  (db.dailyObservations || []).forEach((o) => {
    if (o.childId === childId && o.date >= start && o.date <= end && !absent.has(o.date)) days.add(o.date);
  });
  const inc = (obj, key) => {
    if (key) obj[key] = (obj[key] || 0) + 1;
  };
  const health = { days: 0, normalDays: 0, signDays: {}, feverDays: {}, actionDays: {}, maxTemperature: null };
  const meals = {};
  const nap = {};
  const emotion = {};
  const behaviors = {};
  const participation = {};
  const byTheme = {};
  const byGoal = {};
  const byDomain = {};
  const themes = themeNames(db);
  const goals = goalOfId(db);
  let observedDays = 0;
  [...days].forEach((date) => {
    const day = observationOf(db, childId, date) || legacyDay(records.filter((r) => r.date === date));
    if (!day) return;
    if (!day.legacy) observedDays += 1;
    Object.entries(day.meals || {}).forEach(([session, value]) => {
      meals[session] ||= { AN_HET: 0, AN_IT: 0, KHONG_AN: 0 };
      meals[session][value] += 1;
    });
    inc(nap, day.nap);
    inc(emotion, day.emotion);
    (day.behaviors || []).forEach((b) => inc(behaviors, b));
  });
  // Sức khỏe: biểu hiện theo ô Sức khỏe của đánh giá; thân nhiệt theo khám sức khỏe (lần cao nhất trong ngày, theo mức)
  const healthDays = new Set([
    ...days,
    ...(db.dailyHealthEntries || []).filter((e) => e.childId === childId && e.date >= start && e.date <= end).map((e) => e.date),
  ]);
  healthDays.forEach((date) => {
    const h = dayHealthOf(db, childId, date);
    if (!h.check && !observationOf(db, childId, date)) return;
    health.days += 1;
    if (!h.signs.length) health.normalDays += 1;
    h.signs.forEach((x) => inc(health.signDays, x));
    const t = h.check?.worstTemperature ?? null;
    const level = temperatureLevel(t);
    if (level?.attention) inc(health.feverDays, level.key);
    if (t != null && (health.maxTemperature == null || t > health.maxTemperature)) health.maxTemperature = t;
    (h.check?.actionKeys || []).forEach((a) => inc(health.actionDays, a));
  });
  records.forEach((a) => {
    inc(participation, a.participation);
    const theme = themes[a.themeId] || 'Chưa gắn chủ đề';
    const add = (bucket, key, field) => {
      bucket[key] ||= { dat: 0, canCoGang: 0, chuaDat: 0 };
      bucket[key][field] += 1;
    };
    const goalKey = (id) => (goals[id] ? (goals[id].description ? `${goals[id].name} – ${goals[id].description}` : goals[id].name) : id);
    const domainKey = (id) => goals[id]?.domain || 'Khác';
    (a.criteriaMet || []).forEach((id) => {
      add(byTheme, theme, 'dat');
      add(byGoal, goalKey(id), 'dat');
      add(byDomain, domainKey(id), 'dat');
    });
    (a.criteriaEffort || []).forEach((id) => {
      add(byTheme, theme, 'canCoGang');
      add(byGoal, goalKey(id), 'canCoGang');
      add(byDomain, domainKey(id), 'canCoGang');
    });
    (a.criteriaNotMet || []).forEach((id) => {
      add(byTheme, theme, 'chuaDat');
      add(byGoal, goalKey(id), 'chuaDat');
      add(byDomain, domainKey(id), 'chuaDat');
    });
  });
  return {
    presentDays: countPresentDays(db, childId, start, end),
    observedDays,
    health,
    meals,
    nap,
    emotion,
    behaviors,
    positiveBehaviors: POSITIVE_BEHAVIORS.reduce((n, b) => n + (behaviors[b] || 0), 0),
    participation,
    goals: { byTheme, byDomain, byGoal },
  };
};

/**
 * Từng ngày trong kỳ cho bảng "Đánh giá hằng ngày trong kỳ": 3 nhóm như màn Đánh giá hằng ngày
 * (bản ghi cũ trước 3 nhóm chỉ có cảm xúc, tiêu chí, nhận xét).
 */
const periodDaysOf = (db, ev) => {
  const records = assessmentsOf(db, ev.childId, ev.periodStart, ev.periodEnd);
  const goals = goalOfId(db);
  const goal = (id) => ({ id, name: goals[id]?.name || id, description: goals[id]?.description || '' });
  const dates = new Set(records.map((r) => r.date));
  const absent = absentDaysOf(db, ev.childId, ev.periodStart, ev.periodEnd);
  (db.dailyObservations || []).forEach((o) => {
    if (o.childId === ev.childId && o.date >= ev.periodStart && o.date <= ev.periodEnd && !absent.has(o.date)) dates.add(o.date);
  });
  return [...dates].sort().map((date) => {
    const obs = observationOf(db, ev.childId, date);
    const day = records.filter((r) => r.date === date);
    const h = obs ? dayHealthOf(db, ev.childId, date) : null;
    const met = [...new Set(day.flatMap((r) => r.criteriaMet || []))];
    return {
      date,
      legacy: !obs,
      health: h ? { signs: h.signs, note: h.note } : null,
      meals: obs?.meals || null,
      nap: obs?.nap || null,
      emotion: obs?.emotion || day[0]?.emotion || null,
      behaviors: obs?.behaviors || [],
      behaviorNote: obs?.behaviorNote || '',
      met: met.map(goal),
      effort: [...new Set(day.flatMap((r) => r.criteriaEffort || []))].filter((id) => !met.includes(id)).map(goal),
      notMet: [...new Set(day.flatMap((r) => r.criteriaNotMet || []))].filter((id) => !met.includes(id)).map(goal),
      comment:
        obs?.comment ??
        day
          .map((r) => r.comment)
          .filter(Boolean)
          .join(' '),
      flag: obs?.flag ?? day.some((r) => r.flag),
    };
  });
};

/* ---------------- AI drafts & period jobs ---------------- */

const draftFor = (db, ev, child) => {
  const assessments = assessmentsOf(db, ev.childId, ev.periodStart, ev.periodEnd);
  // Chỉ xét mục tiêu đã có trong giáo án các ngày của kỳ (MT / YCCĐ chưa dạy không phải "cần hỗ trợ"); bộ tiêu chí cũ giữ nguyên
  const used = new Set(
    assessments.flatMap((a) => [...(a.criteriaOffered || []), ...a.criteriaMet, ...(a.criteriaEffort || []), ...(a.criteriaNotMet || [])]),
  );
  const criteria = allCriteria(db).filter((c) => !c.kind || used.has(c.id));
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
  // Giáo án của kỳ: tuần, chủ đề theo kế hoạch năm và số mục tiêu (MT) giáo án đưa vào các hoạt động đã đánh giá
  const week = ev.periodType === PERIOD_TYPE.WEEK ? planWeekOf(db, classOf(db, ev.classId), ev.schoolYear, ev.periodStart) : {};
  const plan = { ...week, offered: new Set(assessments.flatMap((a) => a.criteriaOffered || [])).size };
  return generateEvaluationDraft({
    child,
    plan,
    structured: periodSummaryOf(db, ev.childId, ev.periodStart, ev.periodEnd),
    periodType: ev.periodType,
    start: ev.periodStart,
    end: ev.periodEnd,
    assessments,
    presentDays,
    criteria,
    monthlyEvaluations,
    flagCount: flagDaysOf(db, ev.childId, ev.periodStart, ev.periodEnd),
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
  db.assessmentDayUnlocks ||= clone(seed.assessmentDayUnlocks);
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

/**
 * Dữ liệu demo (hư cấu): các ngày seed chỉ có bản ghi cũ, bổ sung nhóm Sức khỏe, ăn, ngủ / Cảm xúc, hành vi
 * như màn Đánh giá hằng ngày, rồi tạo lại bản nháp AI chưa xác nhận để tổng hợp theo dữ liệu mới.
 */
const OBS_DEMO_VERSION = 1;
const backfillDemoObservations = (db) => {
  db.dailyObservations ||= [];
  const has = new Set(db.dailyObservations.map((o) => `${o.childId}|${o.date}`));
  const behaviorKeys = Object.keys(BEHAVIORS);
  const done = new Set();
  db.dailyAssessments.forEach((a) => {
    const key = `${a.childId}|${a.date}`;
    if (!a.id.startsWith('da_') || has.has(key) || done.has(key)) return;
    done.add(key);
    const cls = classOf(db, a.classId);
    if (!cls) return;
    const k = [...key].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 9973, 7);
    const sessions = mealSessionsOf(db, cls);
    db.dailyObservations.push({
      id: `do_${a.id.slice(3)}`,
      date: a.date,
      classId: a.classId,
      campusId: a.campusId,
      childId: a.childId,
      healthOverridden: false,
      healthSigns: [],
      healthNote: '',
      healthSetAt: null,
      meals: Object.fromEntries(
        sessions.map((m, i) => [m, (k + i) % 9 === 0 ? EATING.KHONG_AN : (k + i) % 4 === 0 ? EATING.AN_IT : EATING.AN_HET]),
      ),
      nap: k % 7 === 0 ? NAP.KHONG_NGU : k % 5 === 0 ? NAP.NGU_IT : NAP.NGU_TOT,
      emotion: a.emotion,
      behaviors: k % 3 === 0 ? [behaviorKeys[k % behaviorKeys.length]] : [],
      behaviorNote: '',
      recordedBy: a.recordedBy,
      recordedAt: a.recordedAt,
      updatedAt: null,
    });
  });
  db.periodicEvaluations
    .filter((ev) => ev.status !== EVAL_STATUS.CONFIRMED && ev.aiDraft)
    .forEach((ev) => {
      try {
        ev.aiDraft.content = draftFor(db, ev, childOf(db, ev.childId) || { fullName: '' }).content;
      } catch {
        // Kỳ thiếu dữ liệu: giữ bản nháp cũ
      }
    });
  db.assessmentObsDemoVersion = OBS_DEMO_VERSION;
};

/** Seeds once, then runs the period jobs whenever a week or month has ended since the last visit. */
const ensureReady = () => {
  ensureSchoolSeeded();
  let db = readDb();
  // Đánh giá hằng ngày đọc giáo án ngày, nên cần dữ liệu kế hoạch giáo dục kể cả khi chưa mở module đó.
  if (db.eduSeedVersion !== EDU_SEED_VERSION) {
    writeDb(ensureEduDemo);
    db = readDb();
  }
  // Demo: lớp Chồi 1 đã điểm danh sẵn hôm nay để thử đánh giá theo kế hoạch ngày (mỗi ngày mới thêm một lần)
  if (db.attendance && !db.attendance.some((r) => r.classId === 'cls_c1_c1' && r.date === todayIso())) {
    writeDb((d) => void seedTodayAttendance(d));
    db = readDb();
  }
  if (!db.dailyAssessments || !db.periodicEvaluations || !db.rewardProposals) {
    writeDb(seedOnce);
    db = readDb();
  }
  if (!db.dailyObservations || !db.assessmentDayUnlocks) {
    writeDb((d) => {
      d.dailyObservations ||= [];
      d.assessmentDayUnlocks ||= [];
    });
    db = readDb();
  }
  if (db.assessmentObsDemoVersion !== OBS_DEMO_VERSION) {
    writeDb(backfillDemoObservations);
    db = readDb();
  }
  if (pendingPeriodJobs(db).length) {
    writeDb((d) => runPeriodJobs(d));
    db = readDb();
  }
  return db;
};

/*
 * Cờ bé ngoan: 1 cờ / trẻ / ngày (Tiền 20/10). Ngày đã ghi theo cách mới lưu cờ ở bản ghi ngày (dailyObservations.flag);
 * bản ghi cũ lưu cờ theo từng hoạt động thì một ngày có cờ ở bất kỳ hoạt động nào tính là 1 cờ.
 */
const flagDaysOf = (db, childId, start, end) => {
  const days = new Set();
  const decided = new Set();
  const absent = absentDaysOf(db, childId, start, end);
  (db.dailyObservations || []).forEach((o) => {
    if (o.childId !== childId || o.date < start || o.date > end || o.flag === undefined || absent.has(o.date)) return;
    decided.add(o.date);
    if (o.flag) days.add(o.date);
  });
  assessmentsOf(db, childId, start, end).forEach((a) => a.flag && !decided.has(a.date) && days.add(a.date));
  return days.size;
};

/* ---------------- tickets ---------------- */

const weekStats = (db, childId, monday, att) => {
  const end = weekEnd(monday);
  const presentDays = countPresentDays(db, childId, monday, end, att);
  const flagCount = flagDaysOf(db, childId, monday, end);
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

const campusName = (db, id) => (db.campuses || []).find((c) => c.id === id)?.name || id;

const teacherClassIds = (db, user) => new Set((db.classes || []).filter((c) => isClassTeacher(c, user)).map((c) => c.id));

// Kế hoạch giáo dục ghi năm học "2026 – 2027", đánh giá ghi "2026-2027"
const sameYear = (a, b) => String(a).replace(/\D/g, '') === String(b).replace(/\D/g, '');

/** Tuần theo kế hoạch năm đã duyệt của khối (đánh số như giáo án: Tuần 1..n, kèm chủ đề). */
const planWeekOf = (db, cls, schoolYear, monday) => {
  const plan = cls
    ? (db.eduGoals || []).find(
        (g) => g.ageGroupId === cls.ageGroupId && sameYear(g.schoolYear, schoolYear) && g.status === EDU_STATUS.APPROVED,
      )
    : null;
  const w = plan ? yearWeeks(plan).find((x) => x.type === 'week' && x.start === monday) : null;
  return w ? { weekNo: w.no, themeName: w.theme?.name || '' } : { weekNo: null, themeName: '' };
};

const withNames = (db, row) => ({
  ...row,
  childName: childOf(db, row.childId)?.fullName || '—',
  childCode: childOf(db, row.childId)?.code || '',
  childPhotoUrl: childOf(db, row.childId)?.photoUrl || null,
  className: classOf(db, row.classId)?.name || '—',
  ...(row.periodType === PERIOD_TYPE.WEEK ? planWeekOf(db, classOf(db, row.classId), row.schoolYear, row.periodStart) : {}),
});

/** Leaders never receive the AI draft text (only teacher-confirmed content is published). */
const publicEvaluation = (ev, cls, user) => (canViewAiDraft(ev, cls, user) ? ev : { ...ev, aiDraft: null, aiError: null });

/* ---------------- khóa ngày đánh giá ---------------- */

/** Lần mở lại còn hiệu lực: giáo viên sửa được đến hạn người mở chọn. */
const activeUnlockOf = (db, classId, date) =>
  (db.assessmentDayUnlocks || []).find((u) => u.classId === classId && u.date === date && isUnlockActive(u)) || null;
const fmtDeadline = (iso) => {
  const d = unlockDeadline(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const dayLocked = (db, classId, date) => isAssessmentLocked(date) && !activeUnlockOf(db, classId, date);

const unlockView = (db, u) => ({
  ...u,
  className: classOf(db, u.classId)?.name || '—',
  unlockedByName: (db.users || []).find((x) => x.id === u.unlockedBy)?.fullName || '—',
  revokedByName: u.revokedBy ? (db.users || []).find((x) => x.id === u.revokedBy)?.fullName || '—' : null,
});

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
    const plan = approvedDayPlan(db, cls, date);
    const mealSessions = mealSessionsOf(db, cls);
    const rows = activeChildrenOf(db, classId).map((child) => {
      const attendanceStatus = att.get(`${date}|${child.id}`) || null;
      const assessment = toPlanCriteria(
        db,
        plan,
        db.dailyAssessments.find((a) => a.childId === child.id && a.date === date && a.activity === current) || null,
      );
      // Sức khỏe, ăn ngủ, cảm xúc – hành vi ghi một lần cho cả ngày; bản ghi cũ lấy từ các hoạt động trong ngày
      const observation =
        observationOf(db, child.id, date) || legacyDay(db.dailyAssessments.filter((a) => a.childId === child.id && a.date === date));
      // Chỉ trẻ đã điểm danh Có mặt mới được đánh giá; chưa điểm danh coi như chưa đánh giá được
      return {
        child,
        attendanceStatus,
        present: attendanceStatus === 'PRESENT',
        assessment,
        observation,
        // Cờ của ngày (1 cờ / ngày); cô chưa quyết thì theo gợi ý
        flag: observation?.flag ?? null,
        flagSuggestion: flagSuggestionOf(db, child.id, date),
        health: dayHealthOf(db, child.id, date),
        skippedMeals: skippedMealsOf(db, child.id, date, mealSessions),
      };
    });
    return clone({
      cls,
      date,
      activity: current,
      activities,
      locked: dayLocked(db, cls.id, date),
      unlock: (() => {
        const u = activeUnlockOf(db, cls.id, date);
        return u && isAssessmentLocked(date) ? unlockView(db, u) : null;
      })(),
      attendanceTaken: rows.some((r) => r.attendanceStatus),
      mealSessions,
      plan: plan
        ? {
            id: plan.id,
            code: plan.code,
            themeId: plan.themeId || null,
            topic: planTopic(plan, current),
            dayPart: planDayPart(plan, current),
          }
        : null,
      criteria: planCriteria(db, plan, current),
      // Tiêu chí đã chấm trước đây (bộ cũ) vẫn hiện tên khi xem lại.
      legacyCriteria: db.assessmentCriteria,
      rows,
    });
  },

  /*
   * Đánh giá cả ngày trên một bảng (Tiền 20/10): mỗi giờ có MT trong kế hoạch ngày là một cột; nhóm ngày (sức khỏe, ăn,
   * ngủ, cảm xúc, hành vi), cờ (1 lần / ngày) và nhận xét ghi một lần. Cô chấm giờ nào lúc nào cũng được.
   */
  async getDailyDaySheet({ classId, date }, user) {
    await delay();
    const db = ensureReady();
    const cls = requireClassTeacher(db, classId, user);
    if (!date || date > todayIso()) throw new ApiError(422, 'Chỉ đánh giá cho hôm nay hoặc ngày đã qua.');
    if (!isSchoolDay(date)) throw new ApiError(422, 'Ngày đã chọn không phải ngày học.');
    const plan = approvedDayPlan(db, cls, date);
    const activities = assessableActivities(cls.ageGroupId).map((activity) => ({
      activity,
      topic: plan ? planTopic(plan, activity) : '',
      dayPart: plan ? planDayPart(plan, activity) : null,
      criteria: planCriteria(db, plan, activity),
    }));
    const att = attendanceIndex(db);
    const mealSessions = mealSessionsOf(db, cls);
    const rows = activeChildrenOf(db, classId).map((child) => {
      const attendanceStatus = att.get(`${date}|${child.id}`) || null;
      const records = db.dailyAssessments.filter((a) => a.childId === child.id && a.date === date);
      const observation = observationOf(db, child.id, date) || legacyDay(records);
      return {
        child,
        attendanceStatus,
        present: attendanceStatus === 'PRESENT',
        observation,
        assessments: Object.fromEntries(
          activities.map(({ activity }) => [activity, toPlanCriteria(db, plan, records.find((a) => a.activity === activity) || null)]),
        ),
        // Cờ, nhận xét của ngày: bản ghi ngày; bản cũ lấy từ các hoạt động trong ngày
        flag: observation?.flag ?? records.some((a) => a.flag),
        comment:
          observation?.comment ??
          records
            .map((a) => a.comment)
            .filter(Boolean)
            .join(' '),
        health: dayHealthOf(db, child.id, date),
        skippedMeals: skippedMealsOf(db, child.id, date, mealSessions),
      };
    });
    return clone({
      cls,
      date,
      locked: dayLocked(db, cls.id, date),
      unlock: (() => {
        const u = activeUnlockOf(db, cls.id, date);
        return u && isAssessmentLocked(date) ? unlockView(db, u) : null;
      })(),
      attendanceTaken: rows.some((r) => r.attendanceStatus),
      mealSessions,
      plan: plan ? { id: plan.id, code: plan.code, themeId: plan.themeId || null, dayLabel: longDayOf(plan) } : null,
      activities,
      legacyCriteria: db.assessmentCriteria,
      rows,
    });
  },

  /** Lưu cả ngày: entries [{ childId, ...nhóm ngày, flag, comment, activities: { [giờ]: { participation, criteriaMet, criteriaNotMet } } }]. */
  async saveDailyDay({ classId, date, entries }, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const cls = requireClassTeacher(db, classId, user);
      if (!canRecordDailyAssessment(cls, user)) forbid();
      if (!date || date > todayIso() || !isSchoolDay(date)) throw new ApiError(422, 'Ngày đánh giá không hợp lệ.');
      if (!entries?.length) throw new ApiError(422, 'Chưa có thay đổi nào để lưu.');
      if (dayLocked(db, classId, date))
        throw new ApiError(409, 'Ngày này đã khóa. Gửi mail cho Phó hiệu trưởng điểm trường hoặc Hiệu trưởng để mở lại.');
      const allowed = assessableActivities(cls.ageGroupId);
      const reopened = isAssessmentLocked(date);
      const att = attendanceIndex(db);
      const kids = new Map(activeChildrenOf(db, classId).map((c) => [c.id, c]));
      const details = {};
      entries.forEach((e) => {
        const child = kids.get(e.childId);
        if (!child) return (details[e.childId] = { childId: 'Trẻ không thuộc lớp này.' });
        const status = att.get(`${date}|${e.childId}`);
        if (!status) return (details[e.childId] = { childId: `${child.fullName} chưa được điểm danh ngày này.` });
        if (status !== 'PRESENT') return (details[e.childId] = { childId: `${child.fullName} vắng ngày này nên không thể đánh giá.` });
        const obs = observationOf(db, e.childId, date);
        if (obs && obs.recordedBy !== user.id)
          return (details[e.childId] = { childId: 'Chỉ giáo viên đã ghi nhận được sửa đánh giá này.' });
        if (Object.keys(e.activities || {}).some((a) => !allowed.includes(a)))
          return (details[e.childId] = { childId: 'Hoạt động không thuộc thời khóa biểu của lớp.' });
        const errors = validateDailyEntry(e);
        Object.values(e.activities || {}).forEach((a) => Object.assign(errors, validateDailyEntry({ ...e, ...a })));
        if (hasErrors(errors)) details[e.childId] = errors;
        return null;
      });
      if (Object.keys(details).length) throw new ApiError(422, 'Một số dòng chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', details);

      const at = nowIso();
      const plan = approvedDayPlan(db, cls, date);
      const sessions = mealSessionsOf(db, cls);
      db.dailyObservations ||= [];
      entries.forEach((e) => {
        const skipped = skippedMealsOf(db, e.childId, date, sessions);
        const prev = observationOf(db, e.childId, date);
        const overridden = !!e.healthOverridden;
        const signs = Object.keys(HEALTH_SYMPTOMS).filter((k) => (e.healthSigns || []).includes(k));
        const reselected = !prev?.healthOverridden || signs.join() !== (prev.healthSigns || []).join();
        const dayValues = {
          healthOverridden: overridden,
          healthSigns: overridden ? signs : [],
          healthNote: (e.healthNote || '').trim(),
          healthSetAt: overridden ? (reselected ? at : prev.healthSetAt) : null,
          meals: Object.fromEntries(sessions.map((m) => [m, skipped.includes(m) ? EATING.KHONG_AN : e.meals?.[m] || EATING.AN_HET])),
          nap: e.nap || NAP.NGU_TOT,
          emotion: e.emotion,
          behaviors: [...new Set(e.behaviors || [])],
          behaviorNote: (e.behaviorNote || '').trim(),
          // Cờ chỉ cắm ở màn Hoạt động chung: giữ nguyên cờ đã có
          ...(e.flag === undefined ? {} : { flag: !!e.flag }),
          comment: (e.comment || '').trim(),
        };
        if (prev) Object.assign(prev, dayValues, { updatedAt: at });
        else
          db.dailyObservations.push({
            id: uid('do'),
            date,
            classId,
            campusId: cls.campusId,
            childId: e.childId,
            ...dayValues,
            recordedBy: user.id,
            recordedAt: at,
            updatedAt: null,
          });
        Object.entries(e.activities || {}).forEach(([activity, a]) => {
          const offered = planCriteria(db, plan, activity).map((c) => c.id);
          const values = {
            emotion: e.emotion,
            participation: plan ? a.participation || 'BINH_THUONG' : null,
            criteriaMet: (a.criteriaMet || []).filter((id) => offered.includes(id)),
            criteriaNotMet: (a.criteriaNotMet || []).filter((id) => offered.includes(id) && !(a.criteriaMet || []).includes(id)),
            // Cần cố gắng: mức giữa (PROPOSED, BE chốt)
            criteriaEffort: (a.criteriaEffort || []).filter(
              (id) => offered.includes(id) && !(a.criteriaMet || []).includes(id) && !(a.criteriaNotMet || []).includes(id),
            ),
            criteriaOffered: offered,
            lessonPlanId: plan?.id || null,
            themeId: plan?.themeId || null,
            // Cờ, nhận xét ghi ở bản ghi ngày
            flag: false,
            comment: '',
          };
          const existing = db.dailyAssessments.find((x) => x.childId === e.childId && x.date === date && x.activity === activity);
          if (existing) {
            Object.assign(existing, values, { updatedAt: at, parentNotifiedAt: at });
            if (reopened) {
              const u = activeUnlockOf(db, classId, date);
              existing.corrections.push({
                at,
                userId: user.id,
                reason: `Mở lại ngày bởi ${unlockView(db, u).unlockedByName}`,
                unlockId: u.id,
              });
            }
          } else
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
              parentNotifiedAt: at,
            });
        });
      });
      return { saved: entries.length, at };
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
      if (dayLocked(db, classId, date))
        throw new ApiError(409, 'Ngày này đã khóa. Gửi mail cho Phó hiệu trưởng điểm trường hoặc Hiệu trưởng để mở lại.');
      const reopened = isAssessmentLocked(date);
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
        if (!status) {
          details[e.childId] = { childId: `${child.fullName} chưa được điểm danh ngày này. Điểm danh trước rồi mới đánh giá.` };
          return;
        }
        if (status !== 'PRESENT') {
          details[e.childId] = { childId: `${child.fullName} vắng ngày này nên không thể đánh giá.` };
          return;
        }
        const existing = db.dailyAssessments.find((a) => a.childId === e.childId && a.date === date && a.activity === activity);
        if (existing && existing.recordedBy !== user.id) {
          details[e.childId] = { childId: 'Chỉ giáo viên đã ghi nhận được sửa đánh giá này.' };
          return;
        }
        const errors = validateDailyEntry(e);
        if (hasErrors(errors)) details[e.childId] = errors;
      });
      if (Object.keys(details).length) throw new ApiError(422, 'Một số dòng chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', details);

      const at = nowIso();
      const plan = approvedDayPlan(db, cls, date);
      const offered = planCriteria(db, plan, activity).map((c) => c.id);
      const sessions = mealSessionsOf(db, cls);
      db.dailyObservations ||= [];
      entries.forEach((e) => {
        const skipped = skippedMealsOf(db, e.childId, date, sessions);
        // Sức khỏe, ăn, ngủ và Cảm xúc – hành vi: một bản ghi / trẻ / ngày. Ô Sức khỏe cô chưa sửa thì không chốt,
        // vẫn theo khám sức khỏe mới nhất; cô đã sửa thì lưu lựa chọn và thời điểm chọn.
        const prev = observationOf(db, e.childId, date);
        const overridden = !!e.healthOverridden;
        const signs = Object.keys(HEALTH_SYMPTOMS).filter((k) => (e.healthSigns || []).includes(k));
        // Thời điểm cô chọn: chỉ đổi khi cô chọn lại, để gợi ý "khám sức khỏe cập nhật" không tự mất khi lưu dòng vì ô khác
        const reselected = !prev?.healthOverridden || signs.join() !== (prev.healthSigns || []).join();
        const dayValues = {
          healthOverridden: overridden,
          healthSigns: overridden ? signs : [],
          healthNote: (e.healthNote || '').trim(),
          healthSetAt: overridden ? (reselected ? at : prev.healthSetAt) : null,
          meals: Object.fromEntries(sessions.map((m) => [m, skipped.includes(m) ? EATING.KHONG_AN : e.meals?.[m] || EATING.AN_HET])),
          nap: e.nap || NAP.NGU_TOT,
          emotion: e.emotion,
          behaviors: [...new Set(e.behaviors || [])],
          behaviorNote: (e.behaviorNote || '').trim(),
          // Cờ bé ngoan: 1 cờ / ngày, chỉ cắm ở màn Hoạt động chung
          flag: !!e.flag,
        };
        const obs = observationOf(db, e.childId, date);
        if (obs) Object.assign(obs, dayValues, { updatedAt: at });
        else
          db.dailyObservations.push({
            id: uid('do'),
            date,
            classId,
            campusId: cls.campusId,
            childId: e.childId,
            ...dayValues,
            recordedBy: user.id,
            recordedAt: at,
            updatedAt: null,
          });
        // Nhóm Kiến thức, kỹ năng theo hoạt động của giáo án; giữ healthStatus cũ cho màn hồ sơ, phiếu bé ngoan
        const values = {
          emotion: e.emotion,
          participation: plan ? e.participation || 'BINH_THUONG' : null,
          criteriaMet: (e.criteriaMet || []).filter((id) => offered.includes(id)),
          criteriaNotMet: (e.criteriaNotMet || []).filter((id) => offered.includes(id) && !(e.criteriaMet || []).includes(id)),
          criteriaOffered: offered,
          lessonPlanId: plan?.id || null,
          themeId: plan?.themeId || null,
          flag: false,
          comment: (e.comment || '').trim(),
        };
        const existing = db.dailyAssessments.find((a) => a.childId === e.childId && a.date === date && a.activity === activity);
        if (existing) {
          Object.assign(existing, values, { updatedAt: at, parentNotifiedAt: at });
          // Sửa trong ngày được mở lại: ghi vết kèm người mở
          if (reopened) {
            const u = activeUnlockOf(db, classId, date);
            existing.corrections.push({
              at,
              userId: user.id,
              reason: `Mở lại ngày bởi ${unlockView(db, u).unlockedByName}`,
              unlockId: u.id,
            });
          }
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

  /* ----- Mở lại ngày đánh giá đã khóa (PHT điểm trường / Hiệu trưởng) ----- */
  async listAssessmentDayUnlocks(user) {
    await delay();
    const db = ensureReady();
    return clone(
      db.assessmentDayUnlocks
        .filter((u) => canUnlockAssessmentDay(classOf(db, u.classId), user))
        .sort((a, b) => (a.unlockedAt < b.unlockedAt ? 1 : -1))
        .map((u) => unlockView(db, u)),
    );
  },

  /**
   * Kết thúc sớm lần mở lại ngày đánh giá (mở nhầm, giáo viên đã đánh giá xong): hạn = bây giờ, ngày khóa lại,
   * giữ lịch sử (không xóa), báo giáo viên lớp. PENDING BE: POST /assessment/day-unlocks/{id}/revoke.
   */
  async revokeAssessmentDayUnlock(id, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const u = (db.assessmentDayUnlocks || []).find((x) => x.id === id);
      if (!u) throw new ApiError(404, 'Không tìm thấy lần mở lại.');
      const cls = classOf(db, u.classId);
      if (!canUnlockAssessmentDay(cls, user)) forbid();
      if (!isUnlockActive(u)) throw new ApiError(409, 'Lần mở lại này đã hết hiệu lực.');
      const at = nowIso();
      Object.assign(u, { validUntil: at, revokedAt: at, revokedBy: user.id });
      cls.teacherIds.forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'ASSESSMENT_DAY_UNLOCK_REVOKED',
          title: 'Đã kết thúc mở lại ngày đánh giá',
          message: `${cls.name}: ngày ${u.date.split('-').reverse().join('/')} đã khóa lại.`,
          link: `/assessment/daily?classId=${cls.id}&date=${u.date}`,
        }),
      );
      return clone(unlockView(db, u));
    });
  },

  async unlockAssessmentDay({ classId, date, reason, validUntil }, user) {
    await delay();
    ensureReady();
    return writeDb((db) => {
      const cls = classOf(db, classId);
      if (!cls) throw new ApiError(404, 'Không tìm thấy lớp.');
      if (!canUnlockAssessmentDay(cls, user)) forbid();
      if (!date || !isSchoolDay(date)) throw new ApiError(422, 'Chọn một ngày học.');
      // Lùi được tới ngày bắt đầu năm học (Cần chốt 21/10/2026)
      const yearStart = activeYearStart(db);
      if (yearStart && date < yearStart) throw new ApiError(422, 'Chỉ mở lại ngày từ đầu năm học.');
      if (!isAssessmentLocked(date)) throw new ApiError(422, 'Ngày này chưa khóa, giáo viên vẫn đánh giá được.');
      if ((reason || '').length > 300) throw new ApiError(422, 'Lý do tối đa 300 ký tự.');
      const until = new Date(validUntil || '');
      if (Number.isNaN(until.getTime())) throw new ApiError(422, 'Chọn ngày giờ hết hạn mở lại.');
      if (until <= new Date()) throw new ApiError(422, 'Hạn mở lại phải sau thời điểm hiện tại.');
      // Hạn do HT / PHT chọn, không quá hết ngày kết thúc năm học
      const yearEnd = activeYearEnd(db);
      if (yearEnd && until > new Date(`${yearEnd}T23:59:59+07:00`))
        throw new ApiError(422, 'Hạn mở lại không được quá ngày kết thúc năm học.');
      const active = activeUnlockOf(db, classId, date);
      if (active) throw new ApiError(409, `Ngày này đã được mở lại cho lớp, còn hiệu lực đến ${fmtDeadline(active.validUntil)}.`);
      const at = nowIso();
      const unlock = {
        id: uid('du'),
        classId,
        campusId: cls.campusId,
        date,
        reason: (reason || '').trim(),
        unlockedBy: user.id,
        unlockedAt: at,
        validUntil: until.toISOString(),
      };
      db.assessmentDayUnlocks.push(unlock);
      cls.teacherIds.forEach((userId) =>
        pushNotification(db, {
          userId,
          type: 'ASSESSMENT_DAY_UNLOCKED',
          title: 'Đã mở lại ngày đánh giá',
          message: `${cls.name}: ngày ${date.split('-').reverse().join('/')} được mở lại, đánh giá được đến ${fmtDeadline(unlock.validUntil)}.`,
          link: `/assessment/daily?classId=${classId}&date=${date}`,
        }),
      );
      return clone(unlockView(db, unlock));
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
            // Đánh giá theo giáo án lưu số YCCĐ được chấm; đánh giá cũ dùng số tiêu chí của bộ cũ.
            const legacyCount = db.assessmentCriteria.filter((c) => c.active).length;
            const possible = list.reduce((sum, a) => sum + (a.criteriaOffered ? a.criteriaOffered.length : legacyCount), 0);
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
    const byId = Object.fromEntries(allCriteria(db).map((c) => [c.id, c]));
    daily.forEach((a) => {
      const offered = a.criteriaOffered || db.assessmentCriteria.map((c) => c.id);
      offered.forEach((id) => {
        const domain = byId[id]?.domain;
        if (!domain) return;
        domainStats[domain] ||= { domain, met: 0, possible: 0 };
        domainStats[domain].possible += 1;
        if (a.criteriaMet.includes(id)) domainStats[domain].met += 1;
      });
    });
    // Hồ sơ theo dữ liệu 3 nhóm của đánh giá hằng ngày: bảng số liệu kỳ và từng ngày (như màn đánh giá tuần / tháng)
    const days = to >= start ? periodDaysOf(db, { childId, periodStart: start, periodEnd: to }) : [];
    return clone({
      child,
      cls,
      range: { start, end: to },
      presentDays: to >= start ? countPresentDays(db, childId, start, to, att) : 0,
      flagCount: to >= start ? flagDaysOf(db, childId, start, to) : 0,
      summary: to >= start ? periodSummaryOf(db, childId, start, to) : null,
      days,
      mealSessions: cls ? mealSessionsOf(db, cls) : [],
      criteria: allCriteria(db),
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
        .map((e) => ({
          ...withNames(db, publicEvaluation(e, classOf(db, e.classId), user)),
          // Số cờ bé ngoan cô cắm trong kỳ (đánh giá hằng ngày)
          flagCount: kind === EVAL_KIND.YEAR_END ? null : flagDaysOf(db, e.childId, e.periodStart, e.periodEnd),
        }))
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
    const days = ev.periodType === PERIOD_TYPE.YEAR ? [] : periodDaysOf(db, ev);
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
      criteria: allCriteria(db),
      // The year-end view lists the confirmed monthly evaluations instead of every daily record.
      assessments: ev.periodType === PERIOD_TYPE.YEAR ? [] : assessments,
      // Bảng căn cứ theo ngày (3 nhóm) và các bữa của nhóm tuổi để hiện cột Ăn
      days,
      mealSessions: cls ? mealSessionsOf(db, cls) : [],
      monthlyEvaluations: monthly,
      summary: {
        structured: periodSummaryOf(db, ev.childId, ev.periodStart, ev.periodEnd),
        presentDays: countPresentDays(db, ev.childId, ev.periodStart, ev.periodEnd),
        assessedDays: days.length,
        assessmentCount: assessments.length,
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
  /**
   * Tổng hợp phiếu bé ngoan của lớp: mỗi trẻ số phiếu tuần, phiếu tháng, cờ bé ngoan trong năm học hoặc một tháng
   * (phiếu tuần tính vào tháng chứa thứ Hai, như GBR-REW-02). PENDING BE: GET /assessment/behaviour-tickets/summary.
   */
  async getTicketSummary({ classId, month }, user) {
    await delay();
    const db = ensureReady();
    const cls = classOf(db, classId);
    if (!cls) throw new ApiError(404, 'Không tìm thấy lớp.');
    // Giáo viên của lớp; PHT điểm trường / Hiệu trưởng xem được lớp trong phạm vi
    if (!isClassTeacher(cls, user) && !inLeaderScope(cls.campusId, user)) forbid();
    const today = todayIso();
    const { start: yStart, end: yEnd } = schoolYearRange(schoolYearOf(today));
    const from = month || yStart;
    const to = month ? monthEnd(month) : yEnd;
    const inRange = (t) =>
      t.classId === classId &&
      (month ? (t.type === TICKET_TYPE.WEEKLY ? monthOfWeek(t.periodStart) === month : t.periodStart === month) : t.periodStart >= yStart);
    const tickets = db.behaviourTickets.filter(inRange);
    const months = [
      ...new Set(
        db.behaviourTickets.filter((t) => t.classId === classId && t.periodStart >= yStart).map((t) => monthOfWeek(t.periodStart)),
      ),
    ]
      .sort()
      .reverse();
    const rows = activeChildrenOf(db, classId)
      .map((child) => {
        const mine = tickets.filter((t) => t.childId === child.id);
        const weekly = mine.filter((t) => t.type === TICKET_TYPE.WEEKLY).sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
        return {
          child: { id: child.id, code: child.code, fullName: child.fullName, photoUrl: child.photoUrl || null },
          weekly: weekly.length,
          monthly: mine.filter((t) => t.type === TICKET_TYPE.MONTHLY).length,
          flags: flagDaysOf(db, child.id, from, to),
        };
      })
      .sort((a, b) => b.weekly - a.weekly || b.monthly - a.monthly || a.child.fullName.localeCompare(b.child.fullName, 'vi'));
    return clone({
      cls: { id: cls.id, name: cls.name },
      month: month || null,
      months,
      rows,
      totals: {
        weekly: tickets.filter((t) => t.type === TICKET_TYPE.WEEKLY).length,
        monthly: tickets.filter((t) => t.type === TICKET_TYPE.MONTHLY).length,
        children: rows.filter((r) => r.weekly || r.monthly).length,
        total: rows.length,
      },
    });
  },

  /**
   * Phiếu bé ngoan các lớp cho PHT (điểm trường mình) và Hiệu trưởng (toàn trường): mỗi lớp số phiếu tuần, phiếu tháng,
   * số trẻ có phiếu trong năm học hoặc một tháng. PENDING BE: GET /assessment/behaviour-tickets/overview.
   */
  async getTicketOverview({ month, campusId }, user) {
    await delay();
    const db = ensureReady();
    if (!isLeader(user)) forbid();
    const today = todayIso();
    const { start: yStart } = schoolYearRange(schoolYearOf(today));
    const inRange = (t) =>
      month ? (t.type === TICKET_TYPE.WEEKLY ? monthOfWeek(t.periodStart) === month : t.periodStart === month) : t.periodStart >= yStart;
    const scoped = db.classes.filter((c) => inLeaderScope(c.campusId, user) && activeChildrenOf(db, c.id).length > 0);
    const rows = scoped
      .filter((c) => !campusId || c.campusId === campusId)
      .map((c) => {
        const tickets = db.behaviourTickets.filter((t) => t.classId === c.id && inRange(t));
        return {
          classId: c.id,
          className: c.name,
          campusId: c.campusId,
          children: activeChildrenOf(db, c.id).length,
          weekly: tickets.filter((t) => t.type === TICKET_TYPE.WEEKLY).length,
          monthly: tickets.filter((t) => t.type === TICKET_TYPE.MONTHLY).length,
          withTicket: new Set(tickets.map((t) => t.childId)).size,
        };
      })
      .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.className.localeCompare(b.className, 'vi'));
    const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
    const months = [
      ...new Set(
        db.behaviourTickets
          .filter((t) => scoped.some((c) => c.id === t.classId) && t.periodStart >= yStart)
          .map((t) => monthOfWeek(t.periodStart)),
      ),
    ]
      .sort()
      .reverse();
    return clone({
      month: month || null,
      months,
      campuses: [...new Set(scoped.map((c) => c.campusId))].map((id) => ({ id, name: campusName(db, id) })),
      rows,
      totals: {
        weekly: sum('weekly'),
        monthly: sum('monthly'),
        withTicket: sum('withTicket'),
        children: sum('children'),
        classes: rows.length,
      },
    });
  },

  async getTicketBoard({ classId, type = TICKET_TYPE.WEEKLY, periodStart }, user) {
    await delay();
    const db = ensureReady();
    const cls = requireClassTeacher(db, classId, user);
    const today = todayIso();
    const { start: yStart } = schoolYearRange(schoolYearOf(today));
    const classDates = db.dailyAssessments.filter((a) => a.classId === classId && a.date >= yStart).map((a) => a.date);
    const first = classDates.length ? classDates.reduce((m, d) => (d < m ? d : m)) : today;
    const periods = (type === TICKET_TYPE.WEEKLY ? weeksBetween(first, today) : monthsBetween(first, today))
      .map((s) => ({
        start: s,
        end: type === TICKET_TYPE.WEEKLY ? weekEnd(s) : monthEnd(s),
        // Tuần ghi như giáo án: Tuần N của năm học, kèm chủ đề
        ...(type === TICKET_TYPE.WEEKLY ? planWeekOf(db, cls, schoolYearOf(today), s) : {}),
      }))
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
