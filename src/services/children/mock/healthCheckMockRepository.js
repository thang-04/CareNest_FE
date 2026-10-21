import { writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { CHILD_STATUS } from '@/models/School';
import { FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import {
  CAMPAIGN_STATUS,
  CHILD_RESULT_STATUS,
  FOLLOW_UP_CLOSE_OUTCOME,
  FOLLOW_UP_FIELD_LIMITS,
  FOLLOW_UP_STATUS,
  HEALTH_CHECK_FIELD_LIMITS,
} from '@/models/children/healthCheckConstants';
import { formatDate, localDateOf } from '@/utils/format';
import { uid } from '@/utils/id';
import { hasErrors, validateFollowUpAction, validateHealthCheck } from '@/utils/children/childrenValidation';
import {
  canManageHealthCheck,
  canUpdateFollowUp,
  canViewHealthChecks,
  isPrincipal,
  isVicePrincipal,
  teachesClass,
} from '@/utils/children/childrenPermissions';
import { CONCLUSION_CATEGORY, EXAM_STATUS } from '@/models/children/healthExamForm';
import {
  KNOWN_CONDITION_HISTORY_MAX,
  ensureChildRecordsSeeded,
  isExamDraft,
  recordKnownCondition,
  selfHistoryWith,
} from './childrenMockRepository';
import {
  campaignStatusOf,
  followUpBrief,
  followUpState,
  isOpenForEntry,
  latestExternalOf,
  notedMeasurementIds,
  unclosedCampaignOf,
} from './healthCheckRule';
import { screenMeasurement } from './healthScreeningRule';

/*
 * Backend giả của đợt khám sức khỏe (user chốt 2026-10-15, PROPOSED — chờ BE ghi HLT-07).
 * Owns db.healthCheckCampaigns và db.healthFollowUps (phiếu theo dõi, HLT-09 đề xuất); đọc db.healthMeasurements (nối qua campaignId).
 * Phạm vi: Hiệu trưởng mọi điểm trường; Phó hiệu trưởng điểm trường của mình; giáo viên/tổ trưởng điểm trường của lớp
 * được phân công và chỉ thấy lớp mình.
 */

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const NOT_FOUND = 'Không tìm thấy đợt khám.';
const nowIso = () => new Date().toISOString();

const forbid = () => {
  throw new ApiError(403, FORBIDDEN);
};

const invalid = (errors, message = 'Thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.') => {
  throw new ApiError(422, message, errors);
};

const userName = (db, id) => db.users?.find((u) => u.id === id)?.fullName || '';
const campusName = (db, id) => db.campuses?.find((c) => c.id === id)?.name || '';

/** Lớp người dùng được xem trong một điểm trường. */
const scopedClasses = (db, user, campusId) => {
  const ofCampus = db.classes.filter((c) => c.campusId === campusId);
  if (isPrincipal(user)) return ofCampus;
  if (isVicePrincipal(user)) return user.campusId === campusId ? ofCampus : [];
  return ofCampus.filter((c) => teachesClass(c, user));
};

const canSeeCampaign = (db, user, c) =>
  isPrincipal(user) || (isVicePrincipal(user) && user.campusId === c.campusId) || scopedClasses(db, user, c.campusId).length > 0;

const findCampaign = (db, id, user) => {
  const c = db.healthCheckCampaigns.find((x) => x.id === id);
  // Ngoài phạm vi trả 404 như không tồn tại, không lộ đợt của điểm trường khác.
  if (!c || !canSeeCampaign(db, user, c)) throw new ApiError(404, NOT_FOUND);
  return c;
};

const latestBefore = (db, childId, date, excludeId) =>
  db.healthMeasurements
    .filter((m) => m.childId === childId && m.id !== excludeId && m.date < date && !isExamDraft(m))
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

/** Kết luận bác sĩ rút gọn (phiếu Phụ lục II) cho danh sách, phiếu theo dõi, đợt sau. */
export const conclusionBrief = (m) => {
  const c = m?.examStatus === EXAM_STATUS.CONCLUDED ? m.exam?.conclusion : null;
  return c
    ? {
        doctorName: c.doctorName,
        issueText: c.issueText || '',
        tbRisk: !!c.tbRisk,
        action: c.action,
        adviceText: c.adviceText || '',
        specialty: c.specialty || '',
        issueKind: c.issueKind || '',
        followUpFinding: c.followUpFinding || '',
      }
    : null;
};

/** Kết quả mới nhất trong phiếu đã mở vòng (lần khám không có bất thường mới không phải đề nghị chuyển khám). */
const referralExamOf = (db, f) => {
  const noted = notedMeasurementIds(f);
  return (
    f.measurementIds
      .map((id) => db.healthMeasurements.find((m) => m.id === id))
      .filter((m) => m && conclusionBrief(m) && !noted.has(m.id))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null
  );
};

const tbRiskOf = (db, f) => f.measurementIds.some((id) => conclusionBrief(db.healthMeasurements.find((m) => m.id === id))?.tbRisk);

/** Phiếu đang mở của trẻ cho bước Kết luận của phiếu khám (D1): chuyên khoa đề nghị gần nhất, kết quả chuyên khoa gần nhất. */
export const openFollowUpBriefOf = (db, f) => {
  const referral = referralExamOf(db, f);
  const brief = conclusionBrief(referral);
  return {
    ...followUpBrief(f),
    openedOn: f.history.find((e) => e.action === 'OPENED')?.examOn || localDateOf(f.openedAt),
    tbRisk: tbRiskOf(db, f),
    referral: referral
      ? { date: referral.date, issueText: brief.issueText, specialty: brief.specialty, adviceText: brief.adviceText }
      : null,
  };
};

const resultStatusOf = (m, campaignStatus) => {
  if (!m) return campaignStatus === CAMPAIGN_STATUS.CLOSED ? CHILD_RESULT_STATUS.ABSENT : CHILD_RESULT_STATUS.NOT_RECORDED;
  if (isExamDraft(m))
    return campaignStatus === CAMPAIGN_STATUS.CLOSED ? CHILD_RESULT_STATUS.NOT_CONCLUDED : CHILD_RESULT_STATUS.IN_PROGRESS;
  return CHILD_RESULT_STATUS.RECORDED;
};

const openFollowUpOf = (db, childId) =>
  (db.healthFollowUps || []).find((f) => f.childId === childId && f.status !== FOLLOW_UP_STATUS.CLOSED) || null;

/** Danh sách trẻ của lớp trong đợt + kết quả (BE trả, UI không tự tính). */
const rosterOf = (db, campaign, cls) => {
  const status = campaignStatusOf(campaign);
  const resultByChild = Object.fromEntries(db.healthMeasurements.filter((m) => m.campaignId === campaign.id).map((m) => [m.childId, m]));
  const absent = new Set(campaign.absentChildIds || []);
  const kids = db.children.filter(
    (ch) =>
      ch.classId === cls.id &&
      (resultByChild[ch.id] || (status === CAMPAIGN_STATUS.CLOSED ? absent.has(ch.id) : ch.status === CHILD_STATUS.ACTIVE)),
  );
  return kids
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
    .map((ch) => {
      const m = resultByChild[ch.id];
      const draft = !!m && isExamDraft(m);
      const screen = m && !draft ? screenMeasurement(m, ch.dateOfBirth) : null;
      const prev = latestBefore(db, ch.id, m?.date || campaign.startDate, m?.id);
      const prevCampaign = prev?.campaignId ? db.healthCheckCampaigns.find((c) => c.id === prev.campaignId) : null;
      const followUp = openFollowUpOf(db, ch.id);
      return {
        childId: ch.id,
        code: ch.code,
        fullName: ch.fullName,
        dateOfBirth: ch.dateOfBirth,
        classId: cls.id,
        className: cls.name,
        result: resultStatusOf(m, status),
        measurementId: m?.id || null,
        date: m?.date || null,
        examStatus: m?.examStatus || null,
        // Kết quả nhập theo mẫu cũ trong đợt (trước phiếu Phụ lục II): xem ở Sổ sức khỏe, không mở trang phiếu.
        source: screen?.source || (draft ? 'EXAM' : null),
        followUpLevel: screen?.followUpLevel || null,
        conclusionCategory: screen?.conclusionCategory || null,
        conclusion: conclusionBrief(m),
        criteria: screen?.criteria || [],
        published: !!m?.published,
        previous: prev
          ? {
              date: prev.date,
              campaignName: prevCampaign?.name || null,
              followUpLevel: screenMeasurement(prev, ch.dateOfBirth).followUpLevel,
              conclusion: conclusionBrief(prev),
            }
          : null,
        followUp: followUp ? followUpBrief(followUp) : null,
      };
    });
};

const summarize = (rows) => ({
  total: rows.length,
  recorded: rows.filter((r) => r.result === CHILD_RESULT_STATUS.RECORDED).length,
  notRecorded: rows.filter((r) => r.result === CHILD_RESULT_STATUS.NOT_RECORDED).length,
  inProgress: rows.filter((r) => r.result === CHILD_RESULT_STATUS.IN_PROGRESS).length,
  notConcluded: rows.filter((r) => r.result === CHILD_RESULT_STATUS.NOT_CONCLUDED).length,
  absent: rows.filter((r) => r.result === CHILD_RESULT_STATUS.ABSENT).length,
  watch: rows.filter((r) => r.followUpLevel === FOLLOW_UP_LEVEL.WATCH).length,
  closeWatch: rows.filter((r) => r.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH).length,
  byConclusion: Object.fromEntries(
    Object.values(CONCLUSION_CATEGORY).map((k) => [k, rows.filter((r) => r.conclusionCategory === k).length]),
  ),
});

const toCampaignView = (db, c, user) => {
  const rows = scopedClasses(db, user, c.campusId).flatMap((cls) => rosterOf(db, c, cls));
  const { absentChildIds: _absent, ...rest } = clone(c);
  const waiting = rows.filter((r) => r.followUp?.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT);
  return {
    ...rest,
    campusName: campusName(db, c.campusId),
    status: campaignStatusOf(c),
    createdByName: userName(db, c.createdBy),
    closedByName: userName(db, c.closedBy),
    hasResults: db.healthMeasurements.some((m) => m.campaignId === c.id),
    progress: summarize(rows),
    waitingFollowUpCount: waiting.length,
    overdueFollowUpCount: waiting.filter((r) => r.followUp.overdueDays > 0).length,
    history: (c.history || []).map((h) => ({ ...h, userName: userName(db, h.userId) })),
  };
};

const cleanPayload = (p) => ({
  name: (p.name || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.name),
  startDate: p.startDate,
  endDate: p.endDate,
  examiner: (p.examiner || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.examiner),
  note: (p.note || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.note),
});

const notifyCampus = (db, campaign, title, message) => {
  const teacherIds = new Set(db.classes.filter((c) => c.campusId === campaign.campusId).flatMap((c) => c.teacherIds || []));
  const vpIds = (db.users || []).filter((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === campaign.campusId).map((u) => u.id);
  [...teacherIds, ...vpIds].forEach((userId) =>
    pushNotification(db, { userId, type: 'HEALTH_CHECK', title, message, link: `/children/health-checks/${campaign.id}` }),
  );
};

const assertManage = (user) => {
  if (!canManageHealthCheck(user)) forbid();
};

/* ------------------------------ Phiếu theo dõi ------------------------------ */
const FOLLOW_UP_NOT_FOUND = 'Không tìm thấy phiếu theo dõi.';
const FOLLOW_UP_ORDER = [
  FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT,
  FOLLOW_UP_STATUS.PARENT_CONTACTED,
  FOLLOW_UP_STATUS.EXTERNAL_RESULT_RECORDED,
  FOLLOW_UP_STATUS.CLOSED,
];

const followUpContext = (db, f) => {
  const child = db.children.find((c) => c.id === f.childId) || null;
  const cls = child?.classId ? db.classes.find((c) => c.id === child.classId) || null : null;
  return { child, cls };
};

// Cùng phạm vi với sổ sức khỏe: Hiệu trưởng tất cả, PHT điểm trường của trẻ, giáo viên lớp hiện tại của trẻ.
const canSeeFollowUp = (db, user, f) => {
  const { child, cls } = followUpContext(db, f);
  if (!child) return false;
  if (isPrincipal(user)) return true;
  if (isVicePrincipal(user)) return child.campusId === user.campusId;
  return teachesClass(cls, user);
};

/**
 * Kết quả đóng phiếu chọn được (user chốt 2026-10-21): "bác sĩ kết luận bình thường" cần kết quả chuyên khoa hoặc lần khám sau
 * ngày mở phiếu; "chuyên khoa xác định có vấn đề" cần kết quả chuyên khoa; "không có kết quả chuyên khoa" luôn chọn được.
 */
const closeOutcomeOptionsOf = (db, f, child) => {
  const O = FOLLOW_UP_CLOSE_OUTCOME;
  const hasExternal = (f.history || []).some((e) => e.action === 'EXTERNAL_RESULT');
  const openedOn = f.history.find((e) => e.action === 'OPENED')?.examOn || localDateOf(f.openedAt);
  const examAfter = db.healthMeasurements.some(
    (m) =>
      m.childId === f.childId &&
      m.date > openedOn &&
      !isExamDraft(m) &&
      screenMeasurement(m, child.dateOfBirth).followUpLevel !== FOLLOW_UP_LEVEL.UNAVAILABLE,
  );
  return [...(hasExternal || examAfter ? [O.DOCTOR_NORMAL] : []), ...(hasExternal ? [O.KNOWN_CONDITION] : []), O.NO_SPECIALIST_RESULT];
};

const toFollowUpView = (db, f, user, { full = false } = {}) => {
  const { child, cls } = followUpContext(db, f);
  const { status, round, roundStarts } = followUpState(f);
  const measurements = f.measurementIds
    .map((id) => db.healthMeasurements.find((m) => m.id === id))
    .filter((m) => m && !isExamDraft(m))
    .sort((a, b) => a.date.localeCompare(b.date));
  const campaignName = (m) => db.healthCheckCampaigns.find((c) => c.id === m.campaignId)?.name || null;
  const screened = measurements.map((m) => ({ m, sc: screenMeasurement(m, child.dateOfBirth) }));
  const last = screened[screened.length - 1];
  const ext = latestExternalOf(f);
  const canUpdate = !f.closedAt && canUpdateFollowUp(child, user, cls);
  // Lần khám gần nhất của trẻ ở mọi mức, để giáo viên thấy diễn biến sau các kết quả trong phiếu.
  const newest = db.healthMeasurements
    .filter((m) => m.childId === child.id && !isExamDraft(m))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const brief = (m) => {
    const sc = screenMeasurement(m, child.dateOfBirth);
    return {
      id: m.id,
      date: m.date,
      campaignName: campaignName(m),
      followUpLevel: sc.followUpLevel,
      criteria: sc.criteria,
      source: sc.source,
      conclusion: conclusionBrief(m),
    };
  };
  // Kết luận bác sĩ của kết quả mới nhất đã mở vòng trong phiếu (chuyên khoa được chuyển, lời dặn).
  const lastExam = referralExamOf(db, f);
  return {
    id: f.id,
    status,
    openedAt: f.openedAt,
    updatedAt: f.updatedAt,
    closedAt: f.closedAt,
    closedByName: userName(db, f.closedBy),
    closeReason: f.closeReason,
    closeOutcome: f.closeOutcome || null,
    closeConditionText: f.closeConditionText || null,
    closeOutcomeOptions: canUpdate ? closeOutcomeOptionsOf(db, f, child) : [],
    child: {
      id: child.id,
      fullName: child.fullName,
      code: child.code,
      classId: child.classId,
      className: cls?.name || '',
      campusId: child.campusId,
      campusName: campusName(db, child.campusId),
    },
    latest: last
      ? {
          measurementId: last.m.id,
          date: last.m.date,
          campaignName: campaignName(last.m),
          followUpLevel: last.sc.followUpLevel,
          criteria: last.sc.criteria,
          source: last.sc.source,
        }
      : null,
    tbRisk: tbRiskOf(db, f),
    referral: lastExam ? { date: lastExam.date, measurementId: lastExam.id, ...conclusionBrief(lastExam) } : null,
    currentRound: round
      ? {
          startedAt: round.startedAt,
          contactFrom: round.contactFrom,
          dueOn: round.dueOn,
          contacted: round.contacted,
          overdueDays: round.overdueDays,
        }
      : null,
    latestExternalResult: ext
      ? { on: ext.on, note: ext.note, facility: ext.facility || '', nextVisitOn: ext.nextVisitOn || null, byName: userName(db, ext.userId) }
      : null,
    canUpdate,
    canRecordExternal: canUpdate && !!round?.contacted,
    ...(full
      ? {
          latestMeasurement: newest ? brief(newest) : null,
          timeline: (f.history || []).map((e) => {
            const m = e.measurementId ? db.healthMeasurements.find((x) => x.id === e.measurementId) : null;
            return {
              ...e,
              userName: userName(db, e.userId),
              ...(m ? { measurement: brief(m) } : {}),
              ...(e.action === 'MEASUREMENT_ADDED' ? { newRound: roundStarts.includes(e.at) } : {}),
            };
          }),
          measurements: screened.map(({ m, sc }) => ({
            id: m.id,
            date: m.date,
            campaignName: campaignName(m),
            heightCm: m.heightCm,
            weightKg: m.weightKg,
            headCircumferenceCm: m.headCircumferenceCm ?? null,
            grossMotor: m.grossMotor ?? null,
            fineMotor: m.fineMotor ?? null,
            note: m.note || '',
            conclusion: conclusionBrief(m),
            ...sc,
          })),
        }
      : {}),
  };
};

const findFollowUp = (db, id, user) => {
  const f = (db.healthFollowUps || []).find((x) => x.id === id);
  if (!f || !canSeeFollowUp(db, user, f)) throw new ApiError(404, FOLLOW_UP_NOT_FOUND);
  return f;
};

const assertUpdate = (db, f, user) => {
  const { child, cls } = followUpContext(db, f);
  if (!canUpdateFollowUp(child, user, cls)) forbid();
  if (f.closedAt) throw new ApiError(409, 'Phiếu theo dõi đã đóng.');
};

const updateFollowUp = (id, user, mutate) =>
  writeDb((d) => {
    const target = d.healthFollowUps.find((x) => x.id === id);
    const at = nowIso();
    mutate(target, at, d);
    target.status = followUpState(target).status;
    target.updatedAt = at;
    return toFollowUpView(d, target, user, { full: true });
  });

const isOverdueFilter = (v) => v === true || v === 'true';

export const healthCheckMockRepository = {
  async listHealthChecks(filters = {}, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    if (!canViewHealthChecks(user)) forbid();
    return db.healthCheckCampaigns
      .filter((c) => canSeeCampaign(db, user, c))
      .filter((c) => !filters.campusId || c.campusId === filters.campusId)
      .map((c) => toCampaignView(db, c, user))
      .filter((c) => !filters.status || c.status === filters.status)
      .sort((a, b) => {
        const rank = (s) => (s === CAMPAIGN_STATUS.IN_PROGRESS ? 0 : s === CAMPAIGN_STATUS.UPCOMING ? 1 : 2);
        return rank(a.status) - rank(b.status) || b.startDate.localeCompare(a.startDate);
      });
  },

  async getHealthCheck(id, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    const c = findCampaign(db, id, user);
    const open = isOpenForEntry(c);
    const classes = scopedClasses(db, user, c.campusId).map((cls) => {
      const rows = rosterOf(db, c, cls);
      return {
        classId: cls.id,
        className: cls.name,
        ageGroupId: cls.ageGroupId,
        ...summarize(rows),
        canRecord: open && teachesClass(cls, user),
      };
    });
    const watchList = scopedClasses(db, user, c.campusId)
      .flatMap((cls) => rosterOf(db, c, cls))
      .filter((r) => r.followUpLevel === FOLLOW_UP_LEVEL.WATCH || r.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH)
      .sort((a, b) =>
        a.followUpLevel === b.followUpLevel
          ? a.fullName.localeCompare(b.fullName, 'vi')
          : a.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH
            ? -1
            : 1,
      );
    return { campaign: toCampaignView(db, c, user), classes, watchList };
  },

  async getHealthCheckClass(id, classId, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    const c = findCampaign(db, id, user);
    const cls = scopedClasses(db, user, c.campusId).find((x) => x.id === classId);
    if (!cls) throw new ApiError(404, 'Không tìm thấy lớp trong đợt khám này.');
    return {
      campaign: toCampaignView(db, c, user),
      cls: { id: cls.id, name: cls.name },
      children: rosterOf(db, c, cls),
      canRecord: isOpenForEntry(c) && teachesClass(cls, user),
    };
  },

  async createHealthCheck(payload, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const errors = validateHealthCheck(payload);
    if (hasErrors(errors)) invalid(errors);
    if (!db.campuses.some((c) => c.id === payload.campusId)) invalid({ campusId: 'Chọn điểm trường' });
    const unclosed = unclosedCampaignOf(db, payload.campusId);
    if (unclosed)
      invalid(
        { campusId: `Điểm trường đang có đợt "${unclosed.name}" chưa đóng. Đóng hoặc hủy đợt đó trước khi tạo đợt mới.` },
        'Mỗi điểm trường chỉ có một đợt khám chưa đóng.',
      );
    return writeDb((d) => {
      const created = {
        id: uid('hc'),
        ...cleanPayload(payload),
        campusId: payload.campusId,
        createdBy: user.id,
        createdAt: nowIso(),
        closedAt: null,
        closedBy: null,
        cancelledAt: null,
        absentChildIds: [],
        history: [{ at: nowIso(), userId: user.id, action: 'CREATED' }],
      };
      d.healthCheckCampaigns.push(created);
      notifyCampus(
        d,
        created,
        'Đợt khám sức khỏe mới',
        `${created.name}: khám từ ${formatDate(created.startDate)} đến ${formatDate(created.endDate)}. Giáo viên nhập kết quả cho lớp mình.`,
      );
      return toCampaignView(d, created, user);
    });
  },

  async updateHealthCheck(id, payload, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (c.closedAt || c.cancelledAt) throw new ApiError(409, 'Đợt khám đã đóng hoặc đã hủy, không sửa được thông tin.');
    const errors = validateHealthCheck({ ...payload, campusId: c.campusId });
    if (hasErrors(errors)) invalid(errors);
    const outside = db.healthMeasurements.find((m) => m.campaignId === id && (m.date < payload.startDate || m.date > payload.endDate));
    if (outside) invalid({ startDate: `Đã có kết quả ngày ${formatDate(outside.date)} nằm ngoài khoảng ngày mới.` });
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      Object.assign(target, cleanPayload(payload));
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'UPDATED' }];
      return toCampaignView(d, target, user);
    });
  },

  async cancelHealthCheck(id, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (c.closedAt || c.cancelledAt) throw new ApiError(409, 'Đợt khám đã đóng hoặc đã hủy.');
    if (db.healthMeasurements.some((m) => m.campaignId === id))
      throw new ApiError(409, 'Đợt khám đã có kết quả, không hủy được. Đóng đợt thay vì hủy.');
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      target.cancelledAt = nowIso();
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'CANCELLED' }];
      return toCampaignView(d, target, user);
    });
  },

  async closeHealthCheck(id, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (campaignStatusOf(c) !== CAMPAIGN_STATUS.IN_PROGRESS) throw new ApiError(409, 'Chỉ đóng được đợt khám đang diễn ra.');
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      const rows = d.classes.filter((cls) => cls.campusId === target.campusId).flatMap((cls) => rosterOf(d, target, cls));
      const view = summarize(rows);
      const waitingFollowUpCount = rows.filter((r) => r.followUp?.status === FOLLOW_UP_STATUS.WAITING_PARENT_CONTACT).length;
      // Trẻ chưa có kết quả khi đóng đợt ⇒ "Vắng khám"; kết quả của đợt bị khóa tới khi mở lại.
      target.absentChildIds = rows.filter((r) => r.result === CHILD_RESULT_STATUS.NOT_RECORDED).map((r) => r.childId);
      target.closedAt = nowIso();
      target.closedBy = user.id;
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'CLOSED' }];
      // Phiếu còn nháp giữ nguyên, hiện "Chưa kết luận", không tính vắng khám (user chốt 2026-10-17).
      return {
        absentCount: view.notRecorded,
        notConcludedCount: view.inProgress,
        waitingFollowUpCount,
        campaign: toCampaignView(d, target, user),
      };
    });
  },

  async reopenHealthCheck(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    if (campaignStatusOf(c) !== CAMPAIGN_STATUS.CLOSED) throw new ApiError(409, 'Chỉ mở lại được đợt khám đã đóng.');
    const reason = (body?.reason || '').trim();
    if (!reason) invalid({ reason: 'Nhập lý do mở lại đợt khám' });
    if (reason.length > HEALTH_CHECK_FIELD_LIMITS.reason) invalid({ reason: 'Lý do tối đa 300 ký tự' });
    const unclosed = unclosedCampaignOf(db, c.campusId, id);
    if (unclosed)
      throw new ApiError(409, `Điểm trường đang có đợt "${unclosed.name}" chưa đóng. Đóng hoặc hủy đợt đó trước khi mở lại đợt này.`);
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      target.closedAt = null;
      target.closedBy = null;
      target.absentChildIds = [];
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'REOPENED', reason }];
      notifyCampus(d, target, 'Đợt khám được mở lại', `${target.name} được mở lại để nhập hoặc sửa kết quả. Lý do: ${reason}`);
      return toCampaignView(d, target, user);
    });
  },

  async listHealthFollowUps(filters = {}, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    if (!canViewHealthChecks(user)) forbid();
    const inScope = db.healthFollowUps
      .filter((f) => canSeeFollowUp(db, user, f))
      .map((f) => toFollowUpView(db, f, user))
      .filter((f) => !filters.campusId || f.child.campusId === filters.campusId);
    // Số đếm theo trạng thái tính trên phạm vi + điểm trường, trước khi lọc trạng thái.
    const overdue = (f) => (f.currentRound?.overdueDays || 0) > 0;
    const counts = Object.fromEntries(FOLLOW_UP_ORDER.map((st) => [st, inScope.filter((f) => f.status === st).length]));
    counts.OVERDUE = inScope.filter(overdue).length;
    const items = inScope
      .filter((f) => !filters.status || f.status === filters.status)
      .filter((f) => !isOverdueFilter(filters.overdue) || overdue(f))
      .sort(
        (a, b) =>
          FOLLOW_UP_ORDER.indexOf(a.status) - FOLLOW_UP_ORDER.indexOf(b.status) ||
          (b.currentRound?.overdueDays || 0) - (a.currentRound?.overdueDays || 0) ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
    return { items, counts };
  },

  async getHealthFollowUp(id, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    return toFollowUpView(db, findFollowUp(db, id, user), user, { full: true });
  },

  // Phiếu dài hạn: ghi trao đổi nhiều lần, ở mọi trạng thái chưa đóng (user chốt 2026-10-16).
  async recordFollowUpContact(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    const f = findFollowUp(db, id, user);
    assertUpdate(db, f, user);
    const errors = validateFollowUpAction('contact', body, { contactFrom: followUpState(f).round.contactFrom });
    if (hasErrors(errors)) invalid(errors);
    const note = body.note.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.note);
    return updateFollowUp(id, user, (t, at) => {
      t.history.push({ at, userId: user.id, action: 'PARENT_CONTACTED', on: body.contactedOn, note });
    });
  },

  // Kết quả khám bên ngoài ghi nhiều lần được, sau khi vòng hiện tại đã trao đổi với phụ huynh.
  async recordFollowUpExternalResult(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    const f = findFollowUp(db, id, user);
    assertUpdate(db, f, user);
    if (!followUpState(f).round.contacted)
      throw new ApiError(409, 'Ghi trao đổi với phụ huynh về kết quả khám mới nhất trước khi ghi kết quả khám bên ngoài.');
    const errors = validateFollowUpAction('external', body);
    if (hasErrors(errors)) invalid(errors);
    const note = body.note.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.note);
    const facility = body.facility.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.facility);
    const images = (body.images || []).filter((x) => typeof x === 'string').slice(0, FOLLOW_UP_FIELD_LIMITS.images);
    return updateFollowUp(id, user, (t, at) => {
      t.history.push({
        at,
        userId: user.id,
        action: 'EXTERNAL_RESULT',
        on: body.resultOn,
        note,
        facility,
        images,
        nextVisitOn: body.nextVisitOn || null,
      });
    });
  },

  /** body: { outcome, conditionText?, reason }. Kết quả theo lời bác sĩ (user chốt 2026-10-21). */
  async closeFollowUp(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    const f = findFollowUp(db, id, user);
    assertUpdate(db, f, user);
    const { child } = followUpContext(db, f);
    const O = FOLLOW_UP_CLOSE_OUTCOME;
    const errors = validateFollowUpAction('close', body);
    if (!errors.outcome && !closeOutcomeOptionsOf(db, f, child).includes(body.outcome))
      errors.outcome =
        body.outcome === O.KNOWN_CONDITION
          ? 'Ghi kết quả khám chuyên khoa vào phiếu trước khi chọn kết quả này'
          : 'Ghi kết quả khám chuyên khoa, hoặc chờ lần khám sau ngày mở phiếu, trước khi chọn kết quả này';
    const conditionText = body.outcome === O.KNOWN_CONDITION ? (body.conditionText || '').trim() : null;
    if (conditionText && !errors.conditionText && selfHistoryWith(db, child.id, conditionText).length > KNOWN_CONDITION_HISTORY_MAX)
      errors.conditionText = `Tiền sử bản thân của trẻ đã dài; rút gọn tên vấn đề (cả tiền sử tối đa ${KNOWN_CONDITION_HISTORY_MAX} ký tự)`;
    if (hasErrors(errors)) invalid(errors);
    const reason = body.reason.trim().slice(0, FOLLOW_UP_FIELD_LIMITS.reason);
    return updateFollowUp(id, user, (t, at, d) => {
      Object.assign(t, {
        closeReason: reason,
        closedAt: at,
        closedBy: user.id,
        closeOutcome: body.outcome,
        closeConditionText: conditionText,
      });
      t.history.push({
        at,
        userId: user.id,
        action: 'CLOSED',
        note: reason,
        outcome: body.outcome,
        ...(conditionText ? { conditionText } : {}),
      });
      if (conditionText)
        recordKnownCondition(d, t.childId, conditionText, user, `Kết quả đóng phiếu theo dõi ngày ${formatDate(localDateOf(at))}`);
    });
  },
};
