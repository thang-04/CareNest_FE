import { writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { SCHOOL_NAME } from '@/config/app';
import { CHILD_STATUS } from '@/models/School';
import {
  CLINICAL_ITEMS,
  CONCLUSION_ACTION_LABELS,
  CONCLUSION_FLAGS,
  DEVELOPMENT_ITEMS,
  EXAM_FIELD_LIMITS,
  EXAM_STATUS,
  GUARDIAN_TO_COMPANION_RELATION,
  HEAD_STATUS_OPTIONS,
  HISTORY_ITEMS,
  IMMUNIZATION_ITEMS,
  NUTRITION_STATUS_OPTIONS,
  VITAL_ITEMS,
  YES_NO,
  buildEmptyExam,
  labelOf,
} from '@/models/children/healthExamForm';
import { todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import { hasErrors } from '@/utils/children/childrenValidation';
import { validateHealthExam } from '@/utils/children/healthExamValidation';
import { canRecordMeasurement, canViewHealth } from '@/utils/children/childrenPermissions';
import { ensureChildRecordsSeeded, isExamDraft, toMeasurementView } from './childrenMockRepository';
import { conclusionBrief } from './healthCheckMockRepository';
import { campaignStatusOf, isOpenForEntry, trackFollowUp } from './healthCheckRule';
import { examReferenceFor, examReviewPoints, screenMeasurement } from './healthScreeningRule';

/*
 * Backend giả của phiếu kiểm tra sức khỏe Phụ lục II trong đợt khám (user chốt 2026-10-17, PROPOSED — chờ BE).
 * Phiếu là measurement có exam + examStatus (DRAFT/CONCLUDED); mỗi trẻ 1 phiếu mỗi đợt. Giáo viên phụ trách lớp nhập;
 * bác sĩ, nhân viên y tế không có tài khoản. Lưu kết luận ⇒ khóa phiếu, mức theo dõi theo kết luận, mở phiếu theo dõi.
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

const latestConcludedExam = (db, childId, excludeId) =>
  db.healthMeasurements
    .filter((x) => x.childId === childId && x.id !== excludeId && x.exam && x.examStatus === EXAM_STATUS.CONCLUDED)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

/** Phiếu mới: hành chính, tiền sử lấy từ phiếu gần nhất; người đi cùng mặc định là phụ huynh đầu tiên trong hồ sơ (D3). */
const prefillExam = (db, child) => {
  const exam = buildEmptyExam();
  const last = latestConcludedExam(db, child.id);
  const guardian = child.guardians?.[0];
  if (last) {
    const { hasCompanion: _h, companion: _c, ...admin } = last.exam.admin;
    Object.assign(exam.admin, clone(admin));
    Object.assign(exam.history, clone(last.exam.history));
  }
  if (guardian) {
    const prev = last?.exam.admin.companion;
    const same = prev && prev.fullName === guardian.fullName;
    exam.admin.hasCompanion = YES_NO.YES;
    exam.admin.companion = {
      guardianIndex: 0,
      fullName: guardian.fullName,
      relation: GUARDIAN_TO_COMPANION_RELATION[guardian.relation] || 'Khác',
      phone: guardian.phone,
      idNumber: same ? prev.idNumber || '' : '',
    };
  }
  return exam;
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

const cleanExam = (raw, ref, { concluded }) => {
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
  const c = r.conclusion || {};
  return {
    step: Math.max(0, Math.min(4, Number(r.step) || 0)),
    admin,
    history: pick(t.history, r.history),
    vitals,
    nutrition,
    development,
    immunization: pick(t.immunization, r.immunization),
    clinical: pick(t.clinical, r.clinical),
    conclusion: {
      normal: !!c.normal,
      tbRisk: !!c.tbRisk,
      healthIssue: !!c.healthIssue,
      issueText: str(c.issueText, EXAM_FIELD_LIMITS.note),
      action: str(c.action),
      adviceText: str(c.adviceText, EXAM_FIELD_LIMITS.note),
      specialty: str(c.specialty, 150),
      doctorName: str(c.doctorName, EXAM_FIELD_LIMITS.short),
    },
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
    ['exam.conclusion.issueText', 'Vấn đề sức khỏe', e.conclusion.issueText],
    ['exam.conclusion.action', 'Hướng xử lý', CONCLUSION_ACTION_LABELS[e.conclusion.action] || ''],
    ['exam.conclusion.adviceText', 'Lời tư vấn', e.conclusion.adviceText],
    ['exam.conclusion.specialty', 'Chuyên khoa', e.conclusion.specialty],
    ['exam.conclusion.doctorName', 'Bác sĩ kết luận', e.conclusion.doctorName],
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
  const prev = db.healthMeasurements
    .filter((x) => x.childId === child.id && x.id !== m?.id && !isExamDraft(x) && x.date < date)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const prevCampaign = prev?.campaignId ? db.healthCheckCampaigns.find((c) => c.id === prev.campaignId) : null;
  const view = m && !legacy ? toMeasurementView(db, m) : null;
  return {
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
      guardians: (child.guardians || []).map((g) => ({ fullName: g.fullName, relation: g.relation, phone: g.phone })),
    },
    measurement: view
      ? { ...view, reviewPoints: examReviewPoints(m, child.dateOfBirth), measuredByName: userName(db, m.measuredBy) }
      : null,
    legacyMeasurementId: legacy ? m.id : null,
    // Phiếu mới: điền sẵn từ hồ sơ trẻ và phiếu gần nhất; số đo để trống.
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

  /**
   * payload: { date, heightCm, weightKg, headCircumferenceCm, exam, conclude, reason }.
   * conclude=false: lưu nháp (không bắt buộc ô nào). conclude=true: kiểm đủ, khóa phiếu; sửa phiếu đã kết luận cần lý do (D12).
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
    const exam = cleanExam(payload.exam, reference, { concluded: !!payload.conclude });

    if (payload.conclude) {
      const errors = validateHealthExam(
        { ...payload, date, exam },
        {
          dateOfBirth: child.dateOfBirth,
          campaign: { startDate: campaign.startDate, endDate: campaign.endDate },
          reference,
          requireReason: concluded,
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
        // GBR-HLT-03: lưu ai sửa, lúc nào, giá trị cũ và mới; phiếu đã công bố cần công bố lại.
        target.edits = [...(target.edits || []), { at: nowIso(), userId: user.id, reason: str(payload.reason), changes }];
        Object.assign(target, values, { published: false, publishedAt: null });
      } else Object.assign(target, values);
      if (payload.conclude) {
        if (!concluded) target.concludedAt = nowIso();
        trackFollowUp(d, freshChild, target, toMeasurementView(d, target).followUpLevel, user);
      }
      return toExamView(d, { campaign, child: freshChild, cls, m: target }, user);
    });
  },
};
