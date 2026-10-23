import { writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { SCHOOL_NAME } from '@/config/app';
import { CHILD_STATUS } from '@/models/School';
import {
  CLINICAL_ITEMS,
  CONCLUSION_ACTION,
  CONCLUSION_ACTION_LABELS,
  CONCLUSION_FLAGS,
  CONCLUSION_MODE,
  DEVELOPMENT_ITEMS,
  EXAM_FIELD_LIMITS,
  EXAM_STATUS,
  FOLLOW_UP_FINDING,
  FOLLOW_UP_FINDING_LABELS,
  GUARDIAN_TO_COMPANION_RELATION,
  HEAD_STATUS_OPTIONS,
  HISTORY_ITEMS,
  IMMUNIZATION_ITEMS,
  ISSUE_KIND_LABELS,
  NUTRITION_STATUS_OPTIONS,
  VITAL_ITEMS,
  YES_NO,
  buildEmptyExam,
  labelOf,
} from '@/models/children/healthExamForm';
import { examToHistory, historyToExam, profileToExamAdmin } from '@/models/children/childProfile';
import { formatDate, todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import { hasErrors } from '@/utils/children/childrenValidation';
import { needsParentOpinion, validateHealthExam } from '@/utils/children/healthExamValidation';
import { canRecordMeasurement, canViewHealth } from '@/utils/children/childrenPermissions';
import {
  ensureChildRecordsSeeded,
  ensureDeclarationOf,
  knownConditionOf,
  notifyTbContactDateChanged,
  toMeasurementView,
} from './childrenMockRepository';
import { conclusionBrief, openFollowUpBriefOf, previousExamOf } from './healthCheckMockRepository';
import { campaignStatusOf, isOpenForEntry, trackFollowUp } from './healthCheckRule';
import { examReferenceFor, examReviewPoints, screenMeasurement } from './healthScreeningRule';

/*
 * Backend giả của phiếu kiểm tra sức khỏe Phụ lục II trong đợt khám (user chốt 2026-10-17, PROPOSED — chờ BE).
 * Phiếu là measurement có exam + examStatus (DRAFT/CONCLUDED); mỗi trẻ 1 phiếu mỗi đợt. Giáo viên phụ trách lớp nhập;
 * bác sĩ, nhân viên y tế không có tài khoản. Lưu kết luận ⇒ khóa phiếu, mức theo dõi theo kết luận, mở phiếu theo dõi.
 * Hành chính lấy từ hồ sơ trẻ, giáo viên không sửa; tiền sử giáo viên sửa được, lưu kết luận cập nhật vào khai báo sức khỏe
 * (user chốt 2026-10-22). Trẻ đang có phiếu theo dõi dùng mẫu kết luận FOLLOW_UP; lưu kết luận không đóng phiếu (2026-10-21).
 * Phạm vi xem như Sổ sức khỏe. CCCD chỉ trả trong phiếu, không vào danh sách, thông báo, AI.
 */

const NOT_FOUND = 'Không tìm thấy phiếu khám của trẻ trong đợt này.';
const nowIso = () => new Date().toISOString();

const forbid = () => {
  throw new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.');
};

const invalid = (errors, message = 'Phiếu chưa đủ thông tin. Kiểm tra các ô được đánh dấu.') => {
  throw new ApiError(422, message, errors);
};

const userName = (db, id) => db.users?.find((u) => u.id === id)?.fullName || '';
const classOf = (db, child) => (child?.classId ? db.classes.find((c) => c.id === child.classId) || null : null);

const contextOf = (db, campaignId, childId, user) => {
  const campaign = (db.healthCheckCampaigns || []).find((c) => c.id === campaignId);
  const child = db.children.find((c) => c.id === childId);
  const cls = classOf(db, child);
  // Ngoài phạm vi trả 404 như không tồn tại.
  if (!campaign || !child || campaign.campusId !== child.campusId || !canViewHealth(child, user, cls)) throw new ApiError(404, NOT_FOUND);
  const m = db.healthMeasurements.find((x) => x.childId === childId && x.campaignId === campaignId) || null;
  return { campaign, child, cls, m };
};

const clampDate = (campaign, today = todayInput()) =>
  today < campaign.startDate ? campaign.startDate : today > campaign.endDate ? campaign.endDate : today;

const openFollowUpOfChild = (db, childId) => (db.healthFollowUps || []).find((f) => f.childId === childId && !f.closedAt) || null;

/**
 * Mẫu kết luận (user chốt 2026-10-21): phiếu đã kết luận giữ mẫu đã lưu; phiếu mới hoặc nháp dùng mẫu FOLLOW_UP khi trẻ có
 * phiếu theo dõi đang mở mà phiếu khám này không thuộc phiếu đó (phiếu khám đã mở ra phiếu theo dõi dùng mẫu thường).
 */
const conclusionModeOf = (m, openCase) => {
  if (m?.examStatus === EXAM_STATUS.CONCLUDED)
    return m.exam?.conclusion?.followUpFinding ? CONCLUSION_MODE.FOLLOW_UP : CONCLUSION_MODE.STANDARD;
  return openCase && !openCase.measurementIds.includes(m?.id) ? CONCLUSION_MODE.FOLLOW_UP : CONCLUSION_MODE.STANDARD;
};

const PROFILE_ADMIN_KEYS = Object.keys(profileToExamAdmin());
const HISTORY_KEYS = [
  ['self', 'selfText'],
  ['family', 'familyText'],
  ['tbContact', 'tbContactDate'],
];

const declaredHistoryOf = (db, child) =>
  historyToExam(db.healthDeclarations.find((x) => x.childId === child.id)?.medicalHistory || undefined);

/** Người đi cùng là phụ huynh trong hồ sơ (user chốt 2026-10-22): chép họ tên, quan hệ, SĐT, CCCD theo guardianIndex. */
const companionOf = (child, admin) => {
  const index = admin.companion?.guardianIndex;
  const g = admin.hasCompanion === YES_NO.YES && Number.isInteger(index) ? child.guardians?.[index] : null;
  if (!g) return { ...buildEmptyExam().admin.companion };
  return {
    guardianIndex: index,
    fullName: g.fullName,
    relation: GUARDIAN_TO_COMPANION_RELATION[g.relation] || 'Khác',
    phone: g.phone,
    idNumber: g.idNumber || '',
  };
};

/**
 * Hành chính của phiếu do BE điền, không nhận giá trị client gửi (user chốt 2026-10-22): lấy từ hồ sơ trẻ; phiếu đã kết luận giữ
 * bản chụp lúc lưu (snapshot = phiếu đã lưu). Người đi cùng chép từ phụ huynh của hồ sơ. Tiền sử giữ theo phiếu (giáo viên sửa được).
 */
const withProfile = (child, exam, snapshot = null) => {
  const src = snapshot ? snapshot.admin : profileToExamAdmin(child.profile || undefined);
  const admin = { ...exam.admin, ...Object.fromEntries(PROFILE_ADMIN_KEYS.map((k) => [k, clone(src[k])])) };
  admin.companion = companionOf(child, exam.admin);
  return { ...exam, admin };
};

/** Mục tiền sử phiếu còn trống (phiếu mới, nháp chưa tới phần này) điền sẵn từ khai báo sức khỏe. */
const withDeclaredHistory = (db, child, history) => {
  const declared = declaredHistoryOf(db, child);
  const out = { ...history };
  HISTORY_KEYS.forEach(([k, extra]) => {
    if (out[k]) return;
    out[k] = declared[k];
    out[extra] = declared[extra];
  });
  return out;
};

/** Phiếu mới: hành chính theo hồ sơ, tiền sử theo khai báo; người đi cùng mặc định là phụ huynh đầu tiên. */
const prefillExam = (db, child) => {
  const exam = buildEmptyExam();
  if (child.guardians?.length)
    exam.admin = { ...exam.admin, hasCompanion: YES_NO.YES, companion: { ...exam.admin.companion, guardianIndex: 0 } };
  return { ...withProfile(child, exam), history: withDeclaredHistory(db, child, exam.history) };
};

/**
 * Lưu kết luận ⇒ tiền sử của phiếu cập nhật vào khai báo sức khỏe, có lịch sử (user chốt 2026-10-22). Không báo khai lần đầu tiếp
 * xúc lao (3b); ngày tiếp xúc đã có mà đổi thì báo Hiệu trưởng, Phó hiệu trưởng điểm trường (2026-10-21).
 */
const writeBackHistory = (db, child, m, user) => {
  const nextHistory = examToHistory(m.exam.history);
  const before = db.healthDeclarations.find((x) => x.childId === child.id)?.medicalHistory || null;
  if (JSON.stringify(before ? historyToExam(before) : historyToExam()) === JSON.stringify(historyToExam(nextHistory))) return;
  const decl = ensureDeclarationOf(db, child.id);
  decl.medicalHistory = nextHistory;
  const source = `phiếu khám ngày ${formatDate(m.date)}`;
  notifyTbContactDateChanged(
    db,
    child,
    { from: before ? historyToExam(before).tbContactDate : '', to: historyToExam(nextHistory).tbContactDate, source },
    user.id,
  );
  decl.history = [
    ...(decl.history || []),
    {
      action: 'UPDATED_FROM_EXAM',
      userId: user.id,
      at: nowIso(),
      note: `Cập nhật từ phiếu khám ngày ${formatDate(m.date)}`,
      historyChange: { from: before ? clone(before) : null, to: clone(nextHistory) },
    },
  ];
};

/* ---------- Làm sạch phiếu: chỉ giữ ô có trong mẫu ---------- */
const str = (v, max = EXAM_FIELD_LIMITS.text) =>
  String(v ?? '')
    .trim()
    .slice(0, max);
const isBlank = (v) => v === '' || v == null;
const roundTo = (v, digits) => {
  if (isBlank(v) || Number.isNaN(Number(v))) return isBlank(v) ? null : v;
  const f = 10 ** digits;
  return Math.round(Number(v) * f) / f;
};

const pick = (template, raw, max) =>
  Object.fromEntries(Object.keys(template).map((k) => [k, typeof template[k] === 'string' ? str(raw?.[k], max) : template[k]]));

/** Kết luận chỉ giữ ô của mẫu đang dùng (thường hoặc FOLLOW_UP). */
const cleanConclusion = (c, mode, knownCondition) => {
  const base = {
    tbRisk: !!c.tbRisk,
    issueText: str(c.issueText, EXAM_FIELD_LIMITS.note),
    adviceText: str(c.adviceText, EXAM_FIELD_LIMITS.note),
    specialty: str(c.specialty, 150),
    doctorName: str(c.doctorName, EXAM_FIELD_LIMITS.short),
    parentOpinion: str(c.parentOpinion, EXAM_FIELD_LIMITS.note),
  };
  if (mode === CONCLUSION_MODE.FOLLOW_UP) {
    const finding = Object.values(FOLLOW_UP_FINDING).includes(c.followUpFinding) ? c.followUpFinding : '';
    const keepsIssue = finding === FOLLOW_UP_FINDING.ADVICE || finding === FOLLOW_UP_FINDING.NEW_FINDING;
    return {
      ...base,
      normal: false,
      healthIssue: false,
      issueKind: '',
      followUpFinding: finding,
      action: '',
      issueText: keepsIssue ? base.issueText : '',
      specialty: finding === FOLLOW_UP_FINDING.NEW_FINDING ? base.specialty : '',
    };
  }
  const action = str(c.action);
  // Câu "mới hay đã biết" chỉ hỏi trẻ có vấn đề đã biết, có vấn đề mà không chuyển khám, không nguy cơ lao (user chốt 2026-10-21).
  const asksKind = !!knownCondition && !!c.healthIssue && !c.tbRisk && action !== CONCLUSION_ACTION.REFERRAL;
  return {
    ...base,
    normal: !!c.normal,
    healthIssue: !!c.healthIssue,
    issueKind: asksKind ? str(c.issueKind) : '',
    followUpFinding: '',
    action,
  };
};

const cleanExam = (raw, ref, { concluded, mode = CONCLUSION_MODE.STANDARD, knownCondition = null }) => {
  const t = buildEmptyExam();
  const r = raw || {};
  const num = (v, digits) => (concluded ? roundTo(v, digits) : isBlank(v) ? '' : String(v).slice(0, 10));
  const admin = {
    ...pick(t.admin, r.admin, EXAM_FIELD_LIMITS.short),
    childIdNumber: str(r.admin?.childIdNumber, EXAM_FIELD_LIMITS.idNumber).replace(/\s/g, ''),
    gestationWeeks: num(r.admin?.gestationWeeks, 0),
    address: {
      province: str(r.admin?.address?.province, EXAM_FIELD_LIMITS.short),
      ward: str(r.admin?.address?.ward, EXAM_FIELD_LIMITS.short),
      street: str(r.admin?.address?.street),
    },
    companion:
      r.admin?.hasCompanion === YES_NO.NO
        ? { ...t.admin.companion }
        : {
            guardianIndex: Number.isInteger(r.admin?.companion?.guardianIndex) ? r.admin.companion.guardianIndex : null,
            fullName: str(r.admin?.companion?.fullName, EXAM_FIELD_LIMITS.short),
            relation: str(r.admin?.companion?.relation, EXAM_FIELD_LIMITS.short),
            phone: str(r.admin?.companion?.phone, EXAM_FIELD_LIMITS.short),
            idNumber: str(r.admin?.companion?.idNumber, EXAM_FIELD_LIMITS.idNumber).replace(/\s/g, ''),
          },
  };
  const vitals = pick(t.vitals, r.vitals);
  VITAL_ITEMS.forEach((i) => (vitals[i.key] = num(r.vitals?.[i.key], i.key === 'temperatureC' ? 1 : 0)));
  const nutrition = {
    ...pick(t.nutrition, r.nutrition),
    lengthForAgeSd: num(r.nutrition?.lengthForAgeSd, 1),
    weightForAgeSd: num(r.nutrition?.weightForAgeSd, 1),
    armCircumferenceMm: num(r.nutrition?.armCircumferenceMm, 0),
    headStatus: ref.headApplies ? str(r.nutrition?.headStatus) : '',
    statuses: (r.nutrition?.statuses || []).filter((s) => NUTRITION_STATUS_OPTIONS.some((o) => o.value === s)),
  };
  const development = pick(t.development, r.development);
  if (!ref.autismQuestion) development.autismRisk = '';
  const conclusion = cleanConclusion(r.conclusion || {}, mode, knownCondition);
  // Ý kiến phụ huynh chỉ giữ khi có người đi cùng và kết luận mức Cần theo dõi sát (user chốt 2026-10-23).
  if (!needsParentOpinion({ admin, conclusion }, mode)) conclusion.parentOpinion = '';
  return {
    step: Math.max(0, Math.min(4, Number(r.step) || 0)),
    admin,
    history: pick(t.history, r.history),
    vitals,
    nutrition,
    development,
    immunization: pick(t.immunization, r.immunization),
    clinical: pick(t.clinical, r.clinical),
    conclusion,
  };
};

/* ---------- Lịch sử sửa: nhãn và giá trị hiển thị theo mẫu ---------- */
const maskId = (v) => (v ? `••••${String(v).slice(-3)}` : '');
const yn = (v) => (v === YES_NO.YES ? 'Có' : v === YES_NO.NO ? 'Không' : '');

const examEntries = (m) => {
  const e = m.exam;
  const out = [
    ['date', 'Ngày khám', m.date],
    ['heightCm', 'Chiều cao/chiều dài (cm)', m.heightCm],
    ['weightKg', 'Cân nặng (kg)', m.weightKg],
    ['headCircumferenceCm', 'Vòng đầu (cm)', m.headCircumferenceCm],
    // CCCD không hiện nguyên số trong lịch sử sửa.
    ['exam.admin.childIdNumber', 'Số định danh của trẻ', maskId(e.admin.childIdNumber)],
    ['exam.admin.premature', 'Sinh non', yn(e.admin.premature)],
    ['exam.admin.gestationWeeks', 'Tuần thai khi sinh', e.admin.gestationWeeks],
    ['exam.admin.ethnicity', 'Dân tộc', e.admin.ethnicity],
    ['exam.admin.beneficiary', 'Đối tượng', e.admin.beneficiary],
    ['exam.admin.paymentSource', 'Nguồn chi trả', e.admin.paymentSource],
    ['exam.admin.bloodType', 'Nhóm máu', e.admin.bloodType],
    [
      'exam.admin.address',
      'Nơi ở hiện tại',
      [e.admin.address.street, e.admin.address.ward, e.admin.address.province].filter(Boolean).join(', '),
    ],
    ['exam.admin.hasCompanion', 'Có người đi cùng', yn(e.admin.hasCompanion)],
    ['exam.admin.companion.fullName', 'Người đi cùng', e.admin.companion.fullName],
    ['exam.admin.companion.relation', 'Quan hệ với trẻ', e.admin.companion.relation],
    ['exam.admin.companion.phone', 'Số điện thoại liên hệ', e.admin.companion.phone],
    ['exam.admin.companion.idNumber', 'Số định danh người đi cùng', maskId(e.admin.companion.idNumber)],
    ...HISTORY_ITEMS.flatMap((i) => [
      [`exam.history.${i.key}`, i.label, yn(e.history[i.key])],
      ...(i.textKey ? [[`exam.history.${i.textKey}`, i.textLabel, e.history[i.textKey]]] : []),
      ...(i.dateKey ? [[`exam.history.${i.dateKey}`, i.dateLabel, e.history[i.dateKey] ? formatDate(e.history[i.dateKey]) : '']] : []),
    ]),
    ...VITAL_ITEMS.flatMap((i) => [
      [`exam.vitals.${i.key}`, i.label, e.vitals[i.key]],
      [`exam.vitals.${i.statusKey}`, `${i.label.replace(/ \(.*\)$/, '')}: trạng thái`, labelOf(i.options, e.vitals[i.statusKey])],
    ]),
    ['exam.nutrition.lengthForAgeSd', 'Chiều dài/Tuổi (SD)', e.nutrition.lengthForAgeSd],
    ['exam.nutrition.weightForAgeSd', 'Cân nặng/Tuổi (SD)', e.nutrition.weightForAgeSd],
    ['exam.nutrition.headStatus', 'Vòng đầu: trạng thái', labelOf(HEAD_STATUS_OPTIONS, e.nutrition.headStatus)],
    ['exam.nutrition.armCircumferenceMm', 'Chu vi vòng cánh tay (mm)', e.nutrition.armCircumferenceMm],
    ['exam.nutrition.statuses', 'Tình trạng dinh dưỡng', e.nutrition.statuses.map((s) => labelOf(NUTRITION_STATUS_OPTIONS, s)).join(', ')],
    ...DEVELOPMENT_ITEMS.map((i) => [`exam.development.${i.key}`, i.label, labelOf(i.options, e.development[i.key])]),
    ...IMMUNIZATION_ITEMS.map((i) => [`exam.immunization.${i.key}`, `Tiêm chủng — ${i.label}`, labelOf(i.options, e.immunization[i.key])]),
    ...CLINICAL_ITEMS.map((i) => [`exam.clinical.${i.key}`, i.label, labelOf(i.options, e.clinical[i.key])]),
    ['exam.clinical.behaviorNote', 'Ghi rõ (tâm lý, hành vi)', e.clinical.behaviorNote],
    [
      'exam.conclusion.flags',
      'Kết luận',
      CONCLUSION_FLAGS.filter((f) => e.conclusion[f.key])
        .map((f) => f.label)
        .join(', '),
    ],
    [
      'exam.conclusion.followUpFinding',
      'Kết luận so với vấn đề đang theo dõi',
      FOLLOW_UP_FINDING_LABELS[e.conclusion.followUpFinding] || '',
    ],
    ['exam.conclusion.issueText', 'Vấn đề sức khỏe', e.conclusion.issueText],
    ['exam.conclusion.issueKind', 'Vấn đề mới hay đã biết', ISSUE_KIND_LABELS[e.conclusion.issueKind] || ''],
    ['exam.conclusion.action', 'Hướng xử lý', CONCLUSION_ACTION_LABELS[e.conclusion.action] || ''],
    ['exam.conclusion.adviceText', 'Lời tư vấn', e.conclusion.adviceText],
    ['exam.conclusion.specialty', 'Chuyên khoa', e.conclusion.specialty],
    ['exam.conclusion.doctorName', 'Bác sĩ kết luận', e.conclusion.doctorName],
    ['exam.conclusion.parentOpinion', 'Ý kiến phụ huynh', e.conclusion.parentOpinion],
  ];
  return out.map(([field, label, value]) => ({ field, label, value: value == null ? '' : value }));
};

const diffExam = (before, after) => {
  const prev = Object.fromEntries(examEntries(before).map((x) => [x.field, x]));
  return examEntries(after)
    .filter((x) => String(prev[x.field]?.value ?? '') !== String(x.value))
    .map((x) => ({ field: x.field, label: x.label, from: prev[x.field]?.value ?? null, to: x.value }));
};

/* ---------- View ---------- */
const toExamView = (db, { campaign, child, cls, m }, user) => {
  const open = isOpenForEntry(campaign);
  const legacy = !!m && !m.exam;
  const date = m?.date || clampDate(campaign);
  const reference = examReferenceFor(child.dateOfBirth, date);
  const followUps = (db.healthFollowUps || []).filter((f) => f.childId === child.id);
  const latestExternal = followUps
    .flatMap((f) => f.history.filter((e) => e.action === 'EXTERNAL_RESULT').map((e) => ({ ...e, followUpId: f.id })))
    .sort((a, b) => b.on.localeCompare(a.on) || b.at.localeCompare(a.at))[0];
  const prev = previousExamOf(db, child.id, date, m?.id);
  const prevCampaign = prev?.campaignId ? db.healthCheckCampaigns.find((c) => c.id === prev.campaignId) : null;
  const view = m && !legacy ? toMeasurementView(db, m) : null;
  // Phiếu nháp: hành chính theo hồ sơ hiện tại (có thể đã sửa sau lần lưu nháp); tiền sử giữ theo phiếu, mục trống lấy từ khai báo.
  if (view && m.examStatus === EXAM_STATUS.DRAFT)
    view.exam = { ...withProfile(child, view.exam), history: withDeclaredHistory(db, child, view.exam.history) };
  const openCase = openFollowUpOfChild(db, child.id);
  return {
    // Mẫu kết luận do BE chọn; UI chỉ vẽ theo (user chốt 2026-10-21).
    conclusionMode: conclusionModeOf(m, openCase),
    // Vấn đề đã biết của trẻ: có thì mẫu thường hỏi "Vấn đề này" mới hay đã biết (user chốt 2026-10-21).
    knownCondition: knownConditionOf(db, child),
    // Phiếu theo dõi đang mở (không phải phiếu do chính phiếu khám này mở), để bác sĩ thấy trước khi kết luận.
    openFollowUp: openCase && !openCase.measurementIds.includes(m?.id) ? openFollowUpBriefOf(db, openCase) : null,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      examiner: campaign.examiner,
      status: campaignStatusOf(campaign),
    },
    child: {
      id: child.id,
      code: child.code,
      fullName: child.fullName,
      gender: child.gender,
      dateOfBirth: child.dateOfBirth,
      classId: child.classId,
      className: cls?.name || '',
      schoolName: SCHOOL_NAME,
      guardians: (child.guardians || []).map((g) => ({
        fullName: g.fullName,
        relation: g.relation,
        phone: g.phone,
        idNumber: g.idNumber || '',
      })),
    },
    measurement: view
      ? { ...view, reviewPoints: examReviewPoints(m, child.dateOfBirth), measuredByName: userName(db, m.measuredBy) }
      : null,
    legacyMeasurementId: legacy ? m.id : null,
    // Phiếu mới: Phần I theo hồ sơ trẻ; số đo để trống.
    draft: m ? null : { date, heightCm: '', weightKg: '', headCircumferenceCm: '', exam: prefillExam(db, child) },
    reference,
    previous: prev
      ? {
          date: prev.date,
          campaignName: prevCampaign?.name || null,
          followUpLevel: screenMeasurement(prev, child.dateOfBirth).followUpLevel,
          conclusion: conclusionBrief(prev),
        }
      : null,
    latestExternalResult: latestExternal
      ? {
          followUpId: latestExternal.followUpId,
          on: latestExternal.on,
          note: latestExternal.note,
          facility: latestExternal.facility || '',
          nextVisitOn: latestExternal.nextVisitOn || null,
        }
      : null,
    // Gợi ý ô "Bác sĩ kết luận": các tên đã nhập trong đợt.
    doctorNames: [
      ...new Set(
        db.healthMeasurements
          .filter((x) => x.campaignId === campaign.id && x.exam?.conclusion?.doctorName)
          .map((x) => x.exam.conclusion.doctorName),
      ),
    ].sort((a, b) => a.localeCompare(b, 'vi')),
    canEdit: open && !legacy && canRecordMeasurement(child, user, cls),
    locked: !open,
  };
};

export const healthExamMockRepository = {
  async getHealthExam(campaignId, childId, user) {
    await delay(150);
    const db = ensureChildRecordsSeeded();
    return toExamView(db, contextOf(db, campaignId, childId, user), user);
  },

  /** "Điểm cần bác sĩ xem lại" theo dữ liệu đang nhập, không lưu (dùng khi sửa phiếu đã kết luận). payload như saveHealthExam. */
  async previewHealthExamReview(campaignId, childId, payload, user) {
    await delay(80);
    const db = ensureChildRecordsSeeded();
    const { campaign, child, m } = contextOf(db, campaignId, childId, user);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(payload?.date || '') ? payload.date : clampDate(campaign);
    const mode = conclusionModeOf(m, openFollowUpOfChild(db, childId));
    const cleaned = cleanExam(payload?.exam, examReferenceFor(child.dateOfBirth, date), { concluded: false, mode });
    const exam = withProfile(child, cleaned, m?.examStatus === EXAM_STATUS.CONCLUDED ? m.exam : null);
    return { reviewPoints: examReviewPoints({ date, exam }, child.dateOfBirth) };
  },

  /**
   * payload: { date, heightCm, weightKg, headCircumferenceCm, exam, conclude, reason, conclusionMode }.
   * conclude=false: lưu nháp (không bắt buộc ô nào). conclude=true: kiểm đủ, khóa phiếu; sửa phiếu đã kết luận cần lý do (D12).
   * conclusionMode: mẫu UI đang vẽ; khác mẫu BE chọn (phiếu theo dõi vừa mở hoặc đóng) ⇒ 409 để tải lại phiếu.
   */
  async saveHealthExam(campaignId, childId, payload, user) {
    await delay(payload?.conclude ? 350 : 120);
    const db = ensureChildRecordsSeeded();
    const ctx = contextOf(db, campaignId, childId, user);
    const { campaign, child, cls, m } = ctx;
    if (!canRecordMeasurement(child, user, cls) || child.status !== CHILD_STATUS.ACTIVE) forbid();
    if (!isOpenForEntry(campaign))
      throw new ApiError(409, 'Đợt khám đã đóng hoặc chưa bắt đầu. Hiệu trưởng mở lại đợt nếu cần nhập hoặc sửa phiếu.');
    if (m && !m.exam) throw new ApiError(409, 'Trẻ đã có kết quả nhập theo mẫu cũ trong đợt này. Xem ở Sổ sức khỏe.');
    const concluded = m?.examStatus === EXAM_STATUS.CONCLUDED;
    if (!payload.conclude && concluded) throw new ApiError(409, 'Phiếu đã có kết luận. Lưu lại kết luận kèm lý do sửa thay vì lưu nháp.');
    const date = payload.date || m?.date || clampDate(campaign);
    const reference = examReferenceFor(child.dateOfBirth, /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : clampDate(campaign));
    const mode = conclusionModeOf(m, openFollowUpOfChild(db, childId));
    if (payload.conclude && payload.conclusionMode && payload.conclusionMode !== mode)
      throw new ApiError(409, 'Phiếu theo dõi của trẻ vừa thay đổi nên mẫu kết luận đã đổi. Tải lại phiếu khám rồi lưu lại.');
    const knownCondition = knownConditionOf(db, child);
    const cleaned = cleanExam(payload.exam, reference, { concluded: !!payload.conclude, mode, knownCondition });
    const exam = withProfile(child, cleaned, concluded ? m.exam : null);

    if (payload.conclude) {
      const errors = validateHealthExam(
        { ...payload, date, exam: cleaned },
        {
          dateOfBirth: child.dateOfBirth,
          campaign: { startDate: campaign.startDate, endDate: campaign.endDate },
          reference,
          requireReason: concluded,
          conclusionMode: mode,
          knownCondition,
          guardianCount: (child.guardians || []).length,
        },
      );
      if (db.healthMeasurements.some((x) => x.childId === childId && x.date === date && x.id !== m?.id))
        errors.date ||= 'Ngày này trẻ đã có kết quả đo khác. Chọn ngày khám khác trong đợt.';
      if (hasErrors(errors)) invalid(errors);
    }

    return writeDb((d) => {
      const num = (v) =>
        isBlank(v) || Number.isNaN(Number(v)) ? (payload.conclude ? null : isBlank(v) ? '' : v) : Math.round(Number(v) * 10) / 10;
      const values = {
        date,
        heightCm: num(payload.heightCm),
        weightKg: num(payload.weightKg),
        headCircumferenceCm: reference.headApplies ? num(payload.headCircumferenceCm) : null,
        exam: { ...exam, step: payload.conclude ? 4 : Math.max(exam.step, m?.exam?.step || 0) },
        examStatus: payload.conclude ? EXAM_STATUS.CONCLUDED : EXAM_STATUS.DRAFT,
      };
      const freshChild = d.children.find((c) => c.id === childId);
      let target = m ? d.healthMeasurements.find((x) => x.id === m.id) : null;
      if (!target) {
        target = {
          id: uid('hm'),
          childId,
          campaignId,
          note: '',
          grossMotor: null,
          fineMotor: null,
          measuredBy: user.id,
          published: false,
          publishedAt: null,
          createdAt: nowIso(),
          edits: [],
          ...values,
        };
        d.healthMeasurements.push(target);
      } else if (concluded) {
        const changes = diffExam(target, { ...target, ...values });
        if (changes.length === 0) return toExamView(d, { campaign, child: freshChild, cls, m: target }, user);
        // GBR-HLT-03: lưu ai sửa, lúc nào, giá trị cũ và mới.
        target.edits = [...(target.edits || []), { at: nowIso(), userId: user.id, reason: str(payload.reason), changes }];
        Object.assign(target, values);
      } else Object.assign(target, values);
      if (payload.conclude) {
        if (!concluded) target.concludedAt = nowIso();
        trackFollowUp(d, freshChild, target, toMeasurementView(d, target).followUpLevel, user);
        // Lưu lại phiếu đã kết luận mà không sửa tiền sử thì không ghi đè khai báo (khai báo có thể đã sửa sau đó).
        if (!concluded || JSON.stringify(m.exam.history) !== JSON.stringify(exam.history)) writeBackHistory(d, freshChild, target, user);
        // Lưu kết luận là công bố cho phụ huynh, kể cả lưu lại sau sửa (BE gửi thông báo cập nhật); nháp không công bố (2026-10-23).
        Object.assign(target, { published: true, publishedAt: nowIso(), publishedBy: user.id });
      }
      return toExamView(d, { campaign, child: freshChild, cls, m: target }, user);
    });
  },
};
