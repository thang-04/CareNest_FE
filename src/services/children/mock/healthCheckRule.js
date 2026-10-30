import { pushNotification } from '@/mocks/notificationMockRepository';
import { schoolYearIdOfDate } from '@/mocks/schoolYearScope';
import { ROLES } from '@/models/User';
import { FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import {
  CAMPAIGN_KIND,
  CAMPAIGN_STATUS,
  EXTERNAL_RESULT_DUE_DAYS,
  FOLLOW_UP_FIELD_LIMITS,
  FOLLOW_UP_STATUS,
  SCHEDULE_MIN_GAP,
  SCHEDULE_WARNING,
} from '@/models/children/healthCheckConstants';
import { CONCLUSION_ACTION, EXAM_STATUS, FOLLOW_UP_FINDING } from '@/models/children/healthExamForm';
import { formatDate, localDateOf as localDate, todayInput } from '@/utils/format';
import { uid } from '@/utils/id';

/*
 * Backend giả: trạng thái đợt khám (user chốt 2026-10-15, PROPOSED — BE sở hữu rule thật).
 * Nhập/sửa kết quả chỉ khi đợt đang diễn ra; đợt đã đóng khóa kết quả tới khi Hiệu trưởng mở lại.
 */
export const campaignStatusOf = (c, today = todayInput()) => {
  if (c.cancelledAt) return CAMPAIGN_STATUS.CANCELLED;
  if (c.closedAt) return CAMPAIGN_STATUS.CLOSED;
  return today < c.startDate ? CAMPAIGN_STATUS.UPCOMING : CAMPAIGN_STATUS.IN_PROGRESS;
};

export const isOpenForEntry = (c) => !!c && campaignStatusOf(c) === CAMPAIGN_STATUS.IN_PROGRESS;

/** Đợt chưa đóng (sắp diễn ra hoặc đang diễn ra) của điểm trường: tối đa 1, tính chung đợt khám và kỳ cân đo (M3). */
export const unclosedCampaignOf = (db, campusId, excludeId) =>
  (db.healthCheckCampaigns || []).find((c) => c.campusId === campusId && c.id !== excludeId && !c.closedAt && !c.cancelledAt) || null;

/** Đợt lưu trước khi có kỳ cân đo không có kind: là đợt khám. */
export const campaignKindOf = (c) => c?.kind || CAMPAIGN_KIND.EXAM;
export const isExamCampaign = (c) => campaignKindOf(c) === CAMPAIGN_KIND.EXAM;

const addMonths = (date, n) => {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
};

/** Ngày bắt đầu sớm nhất không còn "sát" ngày date: date + 2 tháng + 15 ngày (user chốt 2026-10-31). */
const gapEndOf = (date) => addDays(addMonths(date, SCHEDULE_MIN_GAP.months), SCHEDULE_MIN_GAP.days);

/**
 * Cảnh báo khi tạo/sửa kỳ hoặc đợt (user chốt 2026-10-31; M1, M2): kỳ/đợt khác cùng điểm trường, chưa hủy, có ngày bắt đầu
 * cách dưới 2 tháng 15 ngày (cả trước lẫn sau); đợt khám thêm cảnh báo năm học đã có đợt khám. Không chặn lưu.
 */
export const scheduleWarningsOf = (db, { campusId, kind, startDate, excludeId }) => {
  const others = (db.healthCheckCampaigns || []).filter((c) => c.campusId === campusId && c.id !== excludeId && !c.cancelledAt);
  const brief = (code, c) => ({ code, campaignId: c.id, name: c.name, kind: campaignKindOf(c), startDate: c.startDate });
  const tooClose = others
    .filter((c) => c.startDate < gapEndOf(startDate) && startDate < gapEndOf(c.startDate))
    .map((c) => brief(SCHEDULE_WARNING.TOO_CLOSE, c));
  const yearId = kind === CAMPAIGN_KIND.EXAM ? schoolYearIdOfDate(db, startDate) : null;
  const examInYear = yearId
    ? others
        .filter((c) => isExamCampaign(c) && schoolYearIdOfDate(db, c.startDate) === yearId)
        .map((c) => brief(SCHEDULE_WARNING.EXAM_IN_SCHOOL_YEAR, c))
    : [];
  return [...tooClose, ...examInYear].sort((a, b) => a.startDate.localeCompare(b.startDate));
};

/*
 * Phiếu theo dõi dài hạn (user chốt 2026-10-16, PROPOSED — đề xuất HLT-09 cho BE).
 * history là dòng thời gian, mỗi sự kiện mang dữ liệu của nó. Vòng theo dõi bắt đầu khi mở phiếu, hoặc khi có kết quả
 * "Cần theo dõi sát" mới sau khi vòng trước đã trao đổi với phụ huynh. Trạng thái = tiến độ của vòng hiện tại.
 */
export const FOLLOW_UP_CONTACT_DUE_DAYS = 7;
const S = FOLLOW_UP_STATUS;

export const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/** Trạng thái và vòng hiện tại của phiếu, tính lại từ dòng thời gian. roundStarts: các mốc `at` bắt đầu vòng. */
export const followUpState = (f, today = todayInput()) => {
  const history = f.history || [];
  let start = null;
  let contacted = false;
  let firstContactOn = null;
  let external = false;
  const roundStarts = [];
  history.forEach((e) => {
    // Kết quả mới khi vòng hiện tại chưa trao đổi thì gộp vào vòng đó, không lùi hạn.
    // Lần khám không có bất thường mới (newFinding: false) chỉ vào dòng thời gian, không mở vòng.
    if (e.action === 'OPENED' || (e.action === 'MEASUREMENT_ADDED' && e.newFinding !== false && (!start || contacted))) {
      start = e;
      contacted = false;
      firstContactOn = null;
      external = false;
      roundStarts.push(e.at);
    } else if (e.action === 'PARENT_CONTACTED') {
      if (!contacted) firstContactOn = e.on || localDate(e.at);
      contacted = true;
    } else if (e.action === 'EXTERNAL_RESULT' && contacted) external = true;
  });
  if (f.closedAt) return { status: S.CLOSED, round: null, roundStarts };
  const startedAt = start?.at || f.openedAt;
  const dueOn = addDays(localDate(startedAt), FOLLOW_UP_CONTACT_DUE_DAYS);
  const status = external ? S.EXTERNAL_RESULT_RECORDED : contacted ? S.PARENT_CONTACTED : S.WAITING_PARENT_CONTACT;
  return {
    status,
    roundStarts,
    round: {
      startedAt,
      // Ngày trao đổi không trước ngày khám của kết quả mở vòng.
      contactFrom: start?.examOn || localDate(startedAt),
      dueOn,
      contacted,
      firstContactOn,
      external,
      overdueDays: status === S.WAITING_PARENT_CONTACT && today > dueOn ? daysBetween(dueOn, today) : 0,
    },
  };
};

export const normalizeFollowUp = (f) => ({ ...f, status: followUpState(f).status });

/** Kết quả khám bên ngoài gần nhất (theo ngày khám) của phiếu. */
export const latestExternalOf = (f) =>
  (f.history || [])
    .filter((e) => e.action === 'EXTERNAL_RESULT')
    .sort((a, b) => a.on.localeCompare(b.on) || a.at.localeCompare(b.at))
    .pop() || null;

/** Tóm tắt phiếu cho Sổ sức khỏe và danh sách trẻ của đợt khám. */
export const followUpBrief = (f, today = todayInput()) => {
  const { status, round } = followUpState(f, today);
  const ext = latestExternalOf(f);
  return {
    id: f.id,
    status,
    openedAt: f.openedAt,
    dueOn: round?.dueOn || null,
    overdueDays: round?.overdueDays || 0,
    latestExternalResult: ext ? { on: ext.on, note: ext.note, facility: ext.facility || '', nextVisitOn: ext.nextVisitOn || null } : null,
  };
};

/** Người nhận thông báo của phiếu: Hiệu trưởng, Phó hiệu trưởng điểm trường của trẻ, giáo viên lớp hiện tại. */
const recipients = (d, child, { managers = true, exclude = null } = {}) => {
  const cls = child.classId ? d.classes.find((c) => c.id === child.classId) : null;
  const ids = new Set([
    ...(managers
      ? (d.users || [])
          .filter((u) => u.role === ROLES.PRINCIPAL || (u.role === ROLES.VICE_PRINCIPAL && u.campusId === child.campusId))
          .map((u) => u.id)
      : []),
    ...(cls?.teacherIds || []),
  ]);
  ids.delete(exclude);
  return [...ids];
};

const notify = (d, userIds, f, title, message) =>
  userIds.forEach((userId) =>
    pushNotification(d, { userId, type: 'HEALTH_FOLLOW_UP', title, message, link: `/children/health-follow-ups/${f.id}` }),
  );

/** Người đi cùng đã nghe bác sĩ kết luận tại buổi khám (phiếu Phụ lục II có người đi cùng). */
const examCompanionOf = (measurement) => {
  const admin = measurement.exam?.admin;
  return admin?.hasCompanion === 'YES' && admin.companion?.fullName?.trim() ? admin.companion : null;
};

const examContactNote = (measurement, companion) => {
  const c = measurement.exam.conclusion || {};
  const parts = [`Bác sĩ trao đổi kết luận với ${companion.fullName.trim()} (${companion.relation || 'người đi cùng'}) tại buổi khám.`];
  if (c.tbRisk) parts.push('Kết luận có nguy cơ mắc lao (tiền sử tiếp xúc).');
  if (c.followUpFinding === FOLLOW_UP_FINDING.NEW_FINDING && c.issueText?.trim())
    parts.push(`Bất thường mới: ${c.issueText.trim().replace(/[.!?]?$/, '.')}`);
  if (c.specialty?.trim() && (c.action === CONCLUSION_ACTION.REFERRAL || c.followUpFinding))
    parts.push(`Đề nghị khám chuyên khoa: ${c.specialty.trim()}.`);
  if (c.adviceText?.trim()) parts.push(`Lời dặn: ${c.adviceText.trim()}`);
  // Ý kiến phụ huynh đặt trước để không bị cắt khi ghi chú dài (user chốt 2026-10-23).
  if (c.parentOpinion?.trim()) parts.splice(1, 0, `Ý kiến phụ huynh: ${c.parentOpinion.trim().replace(/[.!?]?$/, '.')}`);
  return parts.join(' ').slice(0, FOLLOW_UP_FIELD_LIMITS.note);
};

const isMeasurementEvent = (e) => e.action === 'OPENED' || e.action === 'MEASUREMENT_ADDED';

/** Lần khám trong phiếu không mở vòng: mẫu FOLLOW_UP "Chưa ghi nhận thêm bất thường" hoặc "Tư vấn" (user chốt 2026-10-21). */
export const notedMeasurementIds = (f) =>
  new Set((f.history || []).filter((e) => e.action === 'MEASUREMENT_ADDED' && e.newFinding === false).map((e) => e.measurementId));

// Mẫu FOLLOW_UP: chỉ "Có thêm bất thường mới" hoặc nguy cơ lao đưa phiếu sang vòng mới; mẫu thường luôn là kết quả mới.
const newFindingOf = (measurement) => {
  const c = measurement.exam?.conclusion || {};
  return !c.followUpFinding || c.followUpFinding === FOLLOW_UP_FINDING.NEW_FINDING || !!c.tbRisk;
};

/** Lần trao đổi tại buổi khám (có người đi cùng) và thông báo khi kết quả mở phiếu hoặc mở vòng mới. */
const announceRound = (d, child, f, measurement, user, { isNew, reopened }) => {
  const companion = examCompanionOf(measurement);
  const contactedAtExam = f.history.some((e) => e.action === 'PARENT_CONTACTED' && e.atExam && e.measurementId === measurement.id);
  if (companion && !contactedAtExam)
    f.history.push({
      at: new Date().toISOString(),
      userId: user.id,
      action: 'PARENT_CONTACTED',
      on: measurement.date,
      note: examContactNote(measurement, companion),
      atExam: true,
      measurementId: measurement.id,
    });
  const { status, round } = followUpState(f);
  f.status = status;
  const c = measurement.exam?.conclusion || {};
  const tbRisk = !!c.tbRisk;
  const newFinding = c.followUpFinding === FOLLOW_UP_FINDING.NEW_FINDING;
  const specialty = c.specialty?.trim();
  const action = specialty
    ? `bác sĩ đề nghị khám chuyên khoa (${specialty})`
    : newFinding
      ? 'bác sĩ ghi nhận thêm bất thường mới trong lúc đang theo dõi'
      : 'kết quả khám ở mức Cần theo dõi sát';
  const message = companion
    ? `${child.fullName}: ${action}, bác sĩ đã trao đổi với người đi cùng tại buổi khám. Giáo viên lớp hỏi lại phụ huynh kết quả khám chuyên khoa.`
    : `${child.fullName}: ${action}. Giáo viên lớp trao đổi với phụ huynh trước ngày ${formatDate(round.dueOn)}.`;
  // Nguy cơ lao luôn báo Hiệu trưởng, Phó hiệu trưởng điểm trường và giáo viên lớp (user chốt 2026-10-17).
  if (isNew || reopened || tbRisk)
    notify(
      d,
      recipients(d, child, { exclude: user.id }),
      f,
      tbRisk
        ? 'Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc)'
        : isNew
          ? 'Trẻ cần theo dõi sát'
          : newFinding
            ? 'Trẻ có thêm bất thường mới'
            : 'Trẻ lại ở mức Cần theo dõi sát',
      message,
    );
};

/**
 * Kết quả "Cần theo dõi sát" ⇒ mở phiếu; trẻ đã có phiếu chưa đóng thì ghi kết quả vào phiếu đó (1 phiếu mở/trẻ).
 * Vòng trước đã trao đổi ⇒ phiếu vào vòng mới, về "Chờ trao đổi phụ huynh". Lưu kết luận không bao giờ đóng phiếu.
 * Mẫu FOLLOW_UP (trẻ đang có phiếu): "Chưa ghi nhận thêm" hoặc "Tư vấn" chỉ vào dòng thời gian; "Có thêm bất thường mới"
 * mở vòng như chuyển khám; sửa đổi lựa chọn thì vòng tính lại (user chốt 2026-10-21).
 * Phiếu khám có người đi cùng ⇒ ghi sẵn lần trao đổi tại buổi khám, kèm ý kiến phụ huynh: không có hạn 7 ngày (user chốt 2026-10-17,
 * 2026-10-23). Sửa phiếu thì ghi chú của lần trao đổi đó theo kết luận mới.
 */
export const trackFollowUp = (d, child, measurement, followUpLevel, user) => {
  d.healthFollowUps ||= [];
  const newFinding = newFindingOf(measurement);
  const followUpMode = !!measurement.exam?.conclusion?.followUpFinding;
  const linked = d.healthFollowUps.find((f) => f.measurementIds.includes(measurement.id));
  if (linked) {
    const event = linked.history.find((e) => isMeasurementEvent(e) && e.measurementId === measurement.id);
    if (event) event.examOn = measurement.date;
    const contact = linked.history.find((e) => e.action === 'PARENT_CONTACTED' && e.atExam && e.measurementId === measurement.id);
    const companion = examCompanionOf(measurement);
    if (contact && companion) Object.assign(contact, { on: measurement.date, note: examContactNote(measurement, companion) });
    const changed = event?.action === 'MEASUREMENT_ADDED' && followUpMode && (event.newFinding !== false) !== newFinding;
    if (changed && !linked.closedAt) {
      const reopened = newFinding && followUpState(linked).status !== S.WAITING_PARENT_CONTACT;
      event.newFinding = newFinding;
      linked.updatedAt = new Date().toISOString();
      if (newFinding) announceRound(d, child, linked, measurement, user, { isNew: false, reopened });
      else linked.status = followUpState(linked).status;
    }
    return linked;
  }
  if (followUpLevel !== FOLLOW_UP_LEVEL.CLOSE_WATCH) return null;
  const at = new Date().toISOString();
  const event = { at, userId: user.id, measurementId: measurement.id, examOn: measurement.date };
  let f = d.healthFollowUps.find((x) => x.childId === child.id && !x.closedAt);
  const reopened = !!f && newFinding && f.status !== S.WAITING_PARENT_CONTACT;
  if (f) {
    f.measurementIds.push(measurement.id);
    f.history.push({ ...event, action: 'MEASUREMENT_ADDED', ...(followUpMode ? { newFinding } : {}) });
    f.updatedAt = at;
  } else {
    f = {
      id: uid('fu'),
      childId: child.id,
      campusId: child.campusId,
      measurementIds: [measurement.id],
      status: S.WAITING_PARENT_CONTACT,
      openedAt: at,
      updatedAt: at,
      closeReason: null,
      closedAt: null,
      closedBy: null,
      history: [{ ...event, action: 'OPENED' }],
    };
    d.healthFollowUps.push(f);
  }
  const isNew = f.history.length === 1;
  if (!newFinding) {
    f.status = followUpState(f).status;
    return f;
  }
  announceRound(d, child, f, measurement, user, { isNew, reopened });
  return f;
};

/**
 * Lần khám đã làm gì với phiếu theo dõi (màn kết quả sau khi lưu): OPENED mở phiếu · NEW_ROUND mở vòng mới · MERGED gộp vào
 * vòng đang chờ trao đổi · NOTED chỉ ghi vào dòng thời gian (không có bất thường mới) · null không thuộc phiếu nào.
 */
export const followUpEffectOf = (f, measurementId) => {
  const e = f && (f.history || []).find((x) => isMeasurementEvent(x) && x.measurementId === measurementId);
  if (!e) return null;
  if (e.action === 'OPENED') return 'OPENED';
  if (e.newFinding === false) return 'NOTED';
  return followUpState(f).roundStarts.includes(e.at) ? 'NEW_ROUND' : 'MERGED';
};

/**
 * Phiếu khám mức "Cần theo dõi sát" đã trao đổi với phụ huynh chưa (user chốt 2026-10-23): có người đi cùng ⇒ đã trao đổi tại buổi
 * khám; không có ⇒ chưa, tới khi giáo viên ghi trao đổi trong phiếu theo dõi sau lần khám này. Kết quả khác: null.
 */
export const parentContactOf = (db, m, followUpLevel) => {
  if (m.examStatus !== EXAM_STATUS.CONCLUDED || followUpLevel !== FOLLOW_UP_LEVEL.CLOSE_WATCH) return null;
  if (examCompanionOf(m)) return { contacted: true, atExam: true, on: m.date, opinion: m.exam.conclusion?.parentOpinion || '' };
  const f = (db.healthFollowUps || []).find((x) => x.measurementIds.includes(m.id));
  const from = f ? f.history.findIndex((e) => isMeasurementEvent(e) && e.measurementId === m.id) : -1;
  const contact = from < 0 ? null : f.history.slice(from + 1).find((e) => e.action === 'PARENT_CONTACTED');
  return { contacted: !!contact, atExam: false, on: contact ? contact.on || localDate(contact.at) : null, opinion: '' };
};

/** Cho trẻ nghỉ học ⇒ đóng phiếu đang mở của trẻ (user chốt 2026-10-16). Trả số phiếu đã đóng. */
export const closeFollowUpsOfWithdrawnChild = (d, child, reason, userId) => {
  const at = new Date().toISOString();
  const note = `Trẻ nghỉ học: ${reason}`.slice(0, FOLLOW_UP_FIELD_LIMITS.reason);
  const open = (d.healthFollowUps || []).filter((f) => f.childId === child.id && !f.closedAt);
  open.forEach((f) => {
    Object.assign(f, { status: S.CLOSED, closeReason: note, closedAt: at, closedBy: userId, updatedAt: at });
    f.history.push({ at, userId, action: 'CLOSED', note, auto: 'CHILD_WITHDRAWN' });
  });
  return open.length;
};

/**
 * Nhắc việc còn thiếu (mock thay job hằng ngày của BE): quá hạn trao đổi mỗi vòng 1 lần; tới ngày hẹn khám lại mỗi kết quả 1 lần;
 * 30 ngày sau lần trao đổi đầu của vòng mà chưa có kết quả khám chuyên khoa, mỗi vòng 1 lần (user chốt 2026-10-17).
 */
export const dueFollowUpReminders = (db, today = todayInput()) =>
  (db.healthFollowUps || []).flatMap((f) => {
    if (f.closedAt) return [];
    const { round } = followUpState(f, today);
    const out = [];
    if (round.overdueDays > 0 && !f.history.some((e) => e.action === 'OVERDUE_REMINDED' && e.roundAt === round.startedAt))
      out.push({ followUpId: f.id, kind: 'OVERDUE', roundAt: round.startedAt, dueOn: round.dueOn });
    if (
      round.contacted &&
      !round.external &&
      round.firstContactOn &&
      daysBetween(round.firstContactOn, today) >= EXTERNAL_RESULT_DUE_DAYS &&
      !f.history.some((e) => e.action === 'EXTERNAL_RESULT_REMINDED' && e.roundAt === round.startedAt)
    )
      out.push({ followUpId: f.id, kind: 'EXTERNAL_DUE', roundAt: round.startedAt, contactedOn: round.firstContactOn });
    f.history
      .filter((e) => e.action === 'EXTERNAL_RESULT' && e.nextVisitOn && e.nextVisitOn <= today)
      .forEach((e) => {
        const done = f.history.some(
          (x) => (x.action === 'NEXT_VISIT_REMINDED' && x.ref === e.at) || (x.action === 'EXTERNAL_RESULT' && x.on >= e.nextVisitOn),
        );
        if (!done) out.push({ followUpId: f.id, kind: 'NEXT_VISIT', ref: e.at, nextVisitOn: e.nextVisitOn });
      });
    return out;
  });

export const applyFollowUpReminders = (d, reminders) => {
  const at = new Date().toISOString();
  reminders.forEach((r) => {
    const f = d.healthFollowUps.find((x) => x.id === r.followUpId);
    const child = f && d.children.find((c) => c.id === f.childId);
    if (!child) return;
    if (r.kind === 'OVERDUE') {
      f.history.push({ at, userId: null, action: 'OVERDUE_REMINDED', roundAt: r.roundAt, dueOn: r.dueOn });
      notify(
        d,
        recipients(d, child),
        f,
        'Phiếu theo dõi quá hạn trao đổi',
        `${child.fullName}: giáo viên lớp chưa ghi trao đổi với phụ huynh, hạn là ngày ${formatDate(r.dueOn)}.`,
      );
    } else if (r.kind === 'EXTERNAL_DUE') {
      f.history.push({ at, userId: null, action: 'EXTERNAL_RESULT_REMINDED', roundAt: r.roundAt, contactedOn: r.contactedOn });
      notify(
        d,
        recipients(d, child, { managers: false }),
        f,
        'Chưa có kết quả khám chuyên khoa',
        `${child.fullName}: đã ${EXTERNAL_RESULT_DUE_DAYS} ngày từ lần trao đổi ngày ${formatDate(r.contactedOn)} mà chưa có kết quả khám chuyên khoa. Hỏi phụ huynh và ghi vào phiếu theo dõi.`,
      );
    } else {
      f.history.push({ at, userId: null, action: 'NEXT_VISIT_REMINDED', ref: r.ref, nextVisitOn: r.nextVisitOn });
      notify(
        d,
        recipients(d, child, { managers: false }),
        f,
        'Tới ngày hẹn khám lại',
        `${child.fullName} có hẹn khám lại ngày ${formatDate(r.nextVisitOn)}. Hỏi phụ huynh kết quả và ghi vào phiếu theo dõi.`,
      );
    }
  });
};

/**
 * Phiếu dạng cũ (1 contact, 1 externalResult) ⇒ dòng thời gian mang dữ liệu; giữ nguyên nội dung.
 * examOnOf(measurementId): ngày khám của kết quả, để kiểm tra ngày trao đổi.
 */
export const toTimelineFollowUp = (f, examOnOf = () => null) => {
  const { contact, externalResult, ...rest } = f;
  let next = 0;
  const history = (f.history || []).map((e) => {
    if (e.action === 'OPENED' || e.action === 'MEASUREMENT_ADDED') {
      const measurementId = e.measurementId ?? f.measurementIds[next] ?? null;
      next += 1;
      return { ...e, measurementId, examOn: e.examOn ?? examOnOf(measurementId) };
    }
    if (e.action === 'PARENT_CONTACTED') return { ...e, on: e.on ?? contact?.on ?? localDate(e.at), note: e.note ?? contact?.note ?? '' };
    if (e.action === 'EXTERNAL_RESULT')
      return {
        ...e,
        on: e.on ?? externalResult?.on ?? localDate(e.at),
        note: e.note ?? externalResult?.note ?? '',
        nextVisitOn: e.nextVisitOn ?? null,
      };
    return e;
  });
  return normalizeFollowUp({ ...rest, history });
};
