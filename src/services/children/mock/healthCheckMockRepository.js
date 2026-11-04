import { writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { schoolYearIdOfDate } from '@/mocks/schoolYearScope';
import { CHILD_STATUS } from '@/models/School';
import { BMI_PROGRESS_KEYS, BMI_STATUS, FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import {
  CAMPAIGN_KIND,
  CAMPAIGN_KIND_LABELS,
  CAMPAIGN_STATUS,
  CHILD_RESULT_STATUS,
  HEALTH_CHECK_FIELD_LIMITS,
} from '@/models/children/healthCheckConstants';
import { formatDate, isIsoDate, todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import { hasErrors, validateHealthCheck } from '@/utils/children/childrenValidation';
import {
  canManageHealthCheck,
  canViewHealthChecks,
  isPrincipal,
  isVicePrincipal,
  teachesClass,
} from '@/utils/children/childrenPermissions';
import { ensureChildRecordsSeeded, isExamDraft } from './childrenMockRepository';
import {
  campaignKindOf,
  campaignStatusOf,
  closeCampaign,
  isExamCampaign,
  isOpenForEntry,
  scheduleWarningsOf,
  unclosedCampaignOf,
} from './healthCheckRule';
import { conclusionBrief, screenMeasurement } from './healthScreeningRule';

/*
 * Backend giả của đợt khám sức khỏe và kỳ cân đo (user chốt 2026-10-15, 2026-10-31; PROPOSED — đề xuất HLT-01, HLT-08 cho BE).
 * Owns db.healthCheckCampaigns; đọc db.healthMeasurements (nối qua campaignId). Cảnh báo theo HLT-19: đợt khám theo kết luận
 * bác sĩ (mức theo dõi), kỳ cân đo theo mức BMI (HLT-18); không có phiếu theo dõi (HLT-16 bỏ 2026-11-04).
 * Phạm vi: Hiệu trưởng mọi điểm trường; Phó hiệu trưởng điểm trường của mình (xem và quản lý); giáo viên/tổ trưởng điểm
 * trường của lớp được phân công và chỉ thấy lớp mình.
 */

const FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const NOT_FOUND = 'Không tìm thấy đợt khám hoặc kỳ cân đo.';
const kindLabelOf = (c) => CAMPAIGN_KIND_LABELS[campaignKindOf(c)];
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

/**
 * Lần khám trước: chỉ lần khám trong đợt khám (có bác sĩ); bỏ phiếu nháp, cân đo ngoài đợt (user chốt 2026-10-22) và lần đo
 * của kỳ cân đo (M7, 2026-10-31).
 */
export const previousExamOf = (db, childId, date, excludeId) => {
  const inExam = (m) => !!m.campaignId && isExamCampaign((db.healthCheckCampaigns || []).find((c) => c.id === m.campaignId));
  return (
    db.healthMeasurements
      .filter((m) => m.childId === childId && m.id !== excludeId && m.date < date && !isExamDraft(m) && inExam(m))
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null
  );
};

const resultStatusOf = (m, campaignStatus) => {
  if (!m) return campaignStatus === CAMPAIGN_STATUS.CLOSED ? CHILD_RESULT_STATUS.ABSENT : CHILD_RESULT_STATUS.NOT_RECORDED;
  if (isExamDraft(m))
    return campaignStatus === CAMPAIGN_STATUS.CLOSED ? CHILD_RESULT_STATUS.NOT_CONCLUDED : CHILD_RESULT_STATUS.IN_PROGRESS;
  return CHILD_RESULT_STATUS.RECORDED;
};

/** Trẻ có cảnh báo BMI (HLT-18): số đo của kỳ cân đo có mức khác Bình thường. */
const hasBmiWarning = (row) => !!row.bmiStatus && row.bmiStatus !== BMI_STATUS.NORMAL;
const isWatch = (row) => row.followUpLevel === FOLLOW_UP_LEVEL.WATCH || row.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH;

// Thứ tự "trẻ cần chú ý" của kỳ cân đo: gầy còm nặng/béo phì, rồi gầy còm/thừa cân, rồi nguy cơ thừa cân (coordinator chốt 2026-11-04).
const BMI_ATTENTION_RANK = {
  [BMI_STATUS.SEVERE_THINNESS]: 0,
  [BMI_STATUS.OBESE]: 0,
  [BMI_STATUS.THINNESS]: 1,
  [BMI_STATUS.OVERWEIGHT]: 1,
  [BMI_STATUS.OVERWEIGHT_RISK]: 2,
};
const byName = (a, b) => a.fullName.localeCompare(b.fullName, 'vi');

/** Danh sách trẻ của lớp trong đợt + kết quả (BE trả, UI không tự tính). */
const rosterOf = (db, campaign, cls) => {
  const status = campaignStatusOf(campaign);
  const round = campaignKindOf(campaign) === CAMPAIGN_KIND.MEASUREMENT;
  const resultByChild = Object.fromEntries(db.healthMeasurements.filter((m) => m.campaignId === campaign.id).map((m) => [m.childId, m]));
  const absent = new Set(campaign.absentChildIds || []);
  const kids = db.children.filter(
    (ch) =>
      ch.classId === cls.id &&
      (resultByChild[ch.id] || (status === CAMPAIGN_STATUS.CLOSED ? absent.has(ch.id) : ch.status === CHILD_STATUS.ACTIVE)),
  );
  return kids.sort(byName).map((ch) => {
    const m = resultByChild[ch.id];
    const draft = !!m && isExamDraft(m);
    const screen = m && !draft ? screenMeasurement(m, ch) : null;
    const prev = previousExamOf(db, ch.id, m?.date || campaign.startDate, m?.id);
    const prevCampaign = prev?.campaignId ? db.healthCheckCampaigns.find((c) => c.id === prev.campaignId) : null;
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
      // Số đo hiện ở danh sách lớp của kỳ cân đo để giáo viên soát nhanh.
      heightCm: m?.heightCm ?? null,
      weightKg: m?.weightKg ?? null,
      // BMI và mức BMI theo tuổi chỉ có với số đo của kỳ cân đo (HLT-18).
      bmi: round ? (screen?.bmi ?? null) : null,
      bmiStatus: round ? (screen?.bmiStatus ?? null) : null,
      examStatus: m?.examStatus || null,
      // Kết quả nhập theo mẫu cũ trong đợt (trước phiếu Phụ lục II): xem ở Sổ sức khỏe, không mở trang phiếu.
      source: screen?.source || (draft ? 'EXAM' : null),
      followUpLevel: screen?.followUpLevel || null,
      conclusionCategory: screen?.conclusionCategory || null,
      conclusion: conclusionBrief(m),
      published: !!m?.published,
      previous: prev
        ? {
            date: prev.date,
            campaignName: prevCampaign?.name || null,
            followUpLevel: screenMeasurement(prev, ch).followUpLevel,
            conclusion: conclusionBrief(prev),
          }
        : null,
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
  // Số trẻ theo mức BMI của kỳ cân đo; dòng của đợt khám không có bmiStatus nên luôn 0 (HLT-18).
  bmi: Object.fromEntries(
    Object.entries(BMI_PROGRESS_KEYS).map(([status, key]) => [key, rows.filter((r) => r.bmiStatus === status).length]),
  ),
});

/**
 * "Trẻ cần chú ý" của chi tiết đợt/kỳ: đợt khám là trẻ Cần theo dõi / Cần theo dõi sát (theo dõi sát trước); kỳ cân đo là trẻ có
 * cảnh báo BMI (nặng trước). Cùng thứ tự thì theo tên.
 */
const watchListOf = (campaign, rows) =>
  isExamCampaign(campaign)
    ? rows
        .filter(isWatch)
        .sort((a, b) => (a.followUpLevel === b.followUpLevel ? byName(a, b) : a.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH ? -1 : 1))
    : rows.filter(hasBmiWarning).sort((a, b) => BMI_ATTENTION_RANK[a.bmiStatus] - BMI_ATTENTION_RANK[b.bmiStatus] || byName(a, b));

const toCampaignView = (db, c, user) => {
  const rows = scopedClasses(db, user, c.campusId).flatMap((cls) => rosterOf(db, c, cls));
  const { absentChildIds: _absent, ...rest } = clone(c);
  return {
    ...rest,
    kind: campaignKindOf(c),
    campusName: campusName(db, c.campusId),
    status: campaignStatusOf(c),
    createdByName: userName(db, c.createdBy),
    closedByName: c.closedAt && c.closedBy == null ? 'Hệ thống' : userName(db, c.closedBy),
    hasResults: db.healthMeasurements.some((m) => m.campaignId === c.id),
    progress: summarize(rows),
    history: (c.history || []).map((h) => ({
      ...h,
      userName: h.action === 'CLOSED' && h.userId == null ? 'Hệ thống' : userName(db, h.userId),
    })),
  };
};

// Kỳ cân đo không có đơn vị khám (giáo viên tự cân đo).
const cleanPayload = (p, kind) => ({
  name: (p.name || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.name),
  startDate: p.startDate,
  endDate: p.endDate,
  examiner: kind === CAMPAIGN_KIND.MEASUREMENT ? '' : (p.examiner || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.examiner),
  note: (p.note || '').trim().slice(0, HEALTH_CHECK_FIELD_LIMITS.note),
});

const notifyCampus = (db, campaign, title, message) => {
  const teacherIds = new Set(db.classes.filter((c) => c.campusId === campaign.campusId).flatMap((c) => c.teacherIds || []));
  const vpIds = (db.users || []).filter((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === campaign.campusId).map((u) => u.id);
  [...teacherIds, ...vpIds].forEach((userId) =>
    pushNotification(db, { userId, type: 'HEALTH_CHECK', title, message, link: `/children/health-checks/${campaign.id}` }),
  );
};

const assertManage = (user, campusId) => {
  if (!canManageHealthCheck(user, campusId)) forbid();
};

export const healthCheckMockRepository = {
  async listHealthChecks(filters = {}, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    if (!canViewHealthChecks(user)) forbid();
    // Đợt khám thuộc năm học của ngày bắt đầu khám (user chốt 2026-10-28, Y-4).
    const inYear = (c) => !filters.schoolYear || schoolYearIdOfDate(db, c.startDate) === filters.schoolYear;
    return db.healthCheckCampaigns
      .filter((c) => canSeeCampaign(db, user, c) && inYear(c))
      .filter((c) => !filters.campusId || c.campusId === filters.campusId)
      .filter((c) => !filters.kind || campaignKindOf(c) === filters.kind)
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
    const rosters = scopedClasses(db, user, c.campusId).map((cls) => ({ cls, rows: rosterOf(db, c, cls) }));
    const classes = rosters.map(({ cls, rows }) => {
      const { bmi: _bmi, ...progress } = summarize(rows);
      return {
        classId: cls.id,
        className: cls.name,
        ageGroupId: cls.ageGroupId,
        ...progress,
        // Số trẻ của lớp có cảnh báo BMI ở kỳ cân đo; đợt khám luôn 0.
        bmiWarning: rows.filter(hasBmiWarning).length,
        canRecord: open && teachesClass(cls, user),
      };
    });
    const watchList = watchListOf(
      c,
      rosters.flatMap(({ rows }) => rows),
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

  /** Cảnh báo trước khi lưu (M5): không chặn; FE hỏi người tạo xác nhận rồi mới gọi create/update. */
  async scheduleWarnings(params, user) {
    await delay(100);
    const db = ensureChildRecordsSeeded();
    assertManage(user, params.campusId);
    return { warnings: scheduleWarningsOf(db, params) };
  },

  async createHealthCheck(payload, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const kind = payload.kind ?? CAMPAIGN_KIND.EXAM;
    const errors = validateHealthCheck(payload, { creating: true });
    if (!Object.values(CAMPAIGN_KIND).includes(kind)) errors.kind = 'Chọn đợt khám sức khỏe hoặc kỳ cân đo';
    if (hasErrors(errors)) invalid(errors);
    if (!db.campuses.some((c) => c.id === payload.campusId)) invalid({ campusId: 'Chọn điểm trường' });
    if (!canManageHealthCheck(user, payload.campusId)) invalid({ campusId: 'Chỉ tạo được cho điểm trường của bạn' });
    const unclosed = unclosedCampaignOf(db, payload.campusId);
    if (unclosed)
      invalid(
        {
          campusId: `Điểm trường đang có ${kindLabelOf(unclosed).toLowerCase()} "${unclosed.name}" chưa đóng. Đóng hoặc hủy trước khi tạo mới.`,
        },
        'Mỗi điểm trường chỉ có một đợt khám hoặc kỳ cân đo chưa đóng.',
      );
    return writeDb((d) => {
      const created = {
        id: uid('hc'),
        kind,
        ...cleanPayload(payload, kind),
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
      const range = `từ ${formatDate(created.startDate)} đến ${formatDate(created.endDate)}`;
      notifyCampus(
        d,
        created,
        kind === CAMPAIGN_KIND.MEASUREMENT ? 'Kỳ cân đo mới' : 'Đợt khám sức khỏe mới',
        kind === CAMPAIGN_KIND.MEASUREMENT
          ? `${created.name}: cân đo ${range}. Giáo viên nhập số đo cho lớp mình.`
          : `${created.name}: khám ${range}. Giáo viên nhập kết quả cho lớp mình.`,
      );
      return toCampaignView(d, created, user);
    });
  },

  async updateHealthCheck(id, payload, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    assertManage(user, c.campusId);
    if (c.closedAt || c.cancelledAt) throw new ApiError(409, `${kindLabelOf(c)} đã đóng hoặc đã hủy, không sửa được thông tin.`);
    const errors = validateHealthCheck({ ...payload, campusId: c.campusId });
    if (hasErrors(errors)) invalid(errors);
    const outside = db.healthMeasurements.find((m) => m.campaignId === id && (m.date < payload.startDate || m.date > payload.endDate));
    if (outside) invalid({ startDate: `Đã có kết quả ngày ${formatDate(outside.date)} nằm ngoài khoảng ngày mới.` });
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      // Loại không đổi sau khi tạo: kết quả đã nhập theo loại đó.
      Object.assign(target, cleanPayload(payload, campaignKindOf(target)));
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'UPDATED' }];
      return toCampaignView(d, target, user);
    });
  },

  async cancelHealthCheck(id, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    assertManage(user, c.campusId);
    if (c.closedAt || c.cancelledAt) throw new ApiError(409, `${kindLabelOf(c)} đã đóng hoặc đã hủy.`);
    if (db.healthMeasurements.some((m) => m.campaignId === id))
      throw new ApiError(409, `${kindLabelOf(c)} đã có kết quả, không hủy được. Đóng thay vì hủy.`);
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
    assertManage(user, c.campusId);
    if (campaignStatusOf(c) !== CAMPAIGN_STATUS.IN_PROGRESS)
      throw new ApiError(409, `Chỉ đóng được ${kindLabelOf(c).toLowerCase()} đang diễn ra.`);
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      const rows = d.classes.filter((cls) => cls.campusId === target.campusId).flatMap((cls) => rosterOf(d, target, cls));
      const view = summarize(rows);
      closeCampaign(d, target, user.id);
      // Phiếu còn nháp giữ nguyên, hiện "Chưa kết luận", không tính vắng khám (user chốt 2026-10-17).
      return {
        absentCount: view.notRecorded,
        notConcludedCount: view.inProgress,
        campaign: toCampaignView(d, target, user),
      };
    });
  },

  async reopenHealthCheck(id, body, user) {
    await delay();
    const db = ensureChildRecordsSeeded();
    assertManage(user);
    const c = findCampaign(db, id, user);
    assertManage(user, c.campusId);
    const label = kindLabelOf(c);
    if (campaignStatusOf(c) !== CAMPAIGN_STATUS.CLOSED) throw new ApiError(409, `Chỉ mở lại được ${label.toLowerCase()} đã đóng.`);
    const reason = (body?.reason || '').trim();
    if (!reason) invalid({ reason: `Nhập lý do mở lại ${label.toLowerCase()}` });
    if (reason.length > HEALTH_CHECK_FIELD_LIMITS.reason) invalid({ reason: 'Lý do tối đa 300 ký tự' });
    // HLT-17: đợt khám, kỳ cân đo đã qua ngày kết thúc mở lại phải có ngày kết thúc mới từ hôm nay, rồi lại tự đóng sau ngày đó.
    const extend = c.endDate < todayInput() || !!body?.endDate;
    if (extend) {
      if (!isIsoDate(body?.endDate)) invalid({ endDate: 'Chọn ngày kết thúc mới hợp lệ theo dd/mm/yyyy' });
      if (body.endDate < todayInput()) invalid({ endDate: 'Chọn ngày kết thúc mới từ hôm nay' });
      if (body.endDate < c.startDate) invalid({ endDate: 'Ngày kết thúc không được trước ngày bắt đầu' });
    }
    const unclosed = unclosedCampaignOf(db, c.campusId, id);
    if (unclosed)
      throw new ApiError(
        409,
        `Điểm trường đang có ${kindLabelOf(unclosed).toLowerCase()} "${unclosed.name}" chưa đóng. Đóng hoặc hủy trước khi mở lại.`,
      );
    return writeDb((d) => {
      const target = d.healthCheckCampaigns.find((x) => x.id === id);
      target.closedAt = null;
      target.closedBy = null;
      if (extend) target.endDate = body.endDate;
      target.absentChildIds = [];
      target.history = [...(target.history || []), { at: nowIso(), userId: user.id, action: 'REOPENED', reason }];
      notifyCampus(d, target, `${label} được mở lại`, `${target.name} được mở lại để nhập hoặc sửa kết quả. Lý do: ${reason}`);
      return toCampaignView(d, target, user);
    });
  },
};
