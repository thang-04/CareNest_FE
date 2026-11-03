import { FOLLOW_UP_LEVEL, HEAD_CIRCUMFERENCE_STATUS } from '@/models/children/childrenConstants';
import {
  CLINICAL_ITEMS,
  CONCLUSION_ACTION,
  CONCLUSION_CATEGORY,
  DEVELOPMENT_ITEMS,
  EXAM_STATUS,
  FOLLOW_UP_FINDING,
  HISTORY_ITEMS,
  IMMUNIZATION_ITEMS,
  ISSUE_KIND,
  NUTRITION_STATUS_OPTIONS,
  VITAL_ITEMS,
} from '@/models/children/healthExamForm';
import { formatDecimal, vitalStatusFor } from '@/utils/children/healthExamHints';
import { classifyBmiForAge } from './bmiForAgeRule';

/*
 * Bản sao rule của backend giả (BE sở hữu rule thật).
 * - Phiếu Phụ lục II (user chốt 2026-10-17): mức theo dõi theo kết luận bác sĩ (HLT-10); hệ thống chỉ lập "Điểm cần bác sĩ xem lại".
 * - Số đo của kỳ cân đo: mức BMI theo tuổi chuẩn WHO (HLT-18, bmiForAgeRule.js); không có kết luận bác sĩ nên không có mức theo dõi.
 * - Kết quả mẫu cũ (chỉ ở dữ liệu demo, trước phiếu Phụ lục II): như số đo của kỳ cân đo; ngưỡng tạm cũ không còn là cảnh báo.
 * Khoảng vòng đầu là TẠM: chỉ gợi ý ở phiếu khám và hiện lại ở kết quả mẫu cũ.
 */

// Mạch, nhịp thở theo AHA PALS 2020 (lúc thức); nhiệt độ đo ở nách. User chọn 2026-10-17, bác sĩ xác nhận trước khi dùng thật.
export const VITAL_REFERENCE = {
  code: 'PALS_2020_PENDING',
  label: 'ngưỡng tham khảo tạm (mạch, nhịp thở theo AHA PALS 2020; nhiệt độ đo ở nách) — chờ bác sĩ xác nhận',
};

const VITAL_BANDS = [
  { maxMonths: 11, label: 'trẻ dưới 12 tháng', pulse: { min: 100, max: 180 }, respiratoryRate: { min: 30, max: 53 } },
  { maxMonths: 35, label: 'trẻ 12–35 tháng', pulse: { min: 98, max: 140 }, respiratoryRate: { min: 22, max: 37 } },
  { maxMonths: 71, label: 'trẻ 3–5 tuổi', pulse: { min: 80, max: 120 }, respiratoryRate: { min: 20, max: 28 } },
  { maxMonths: Infinity, label: 'trẻ từ 6 tuổi', pulse: { min: 75, max: 118 }, respiratoryRate: { min: 18, max: 25 } },
];
const TEMPERATURE = { feverFrom: 37.5, hypothermiaBelow: 36 };

// Chuẩn vòng đầu WHO chỉ tới 60 tháng ⇒ trẻ lớn hơn không đo vòng đầu.
const HEAD_MAX_AGE_MONTHS = 60;
const headBand = (ageMonths) => ({ low: 45.5 + (ageMonths - 24) * 0.06, high: 51 + (ageMonths - 24) * 0.06 });

export const ageMonthsOn = (dateOfBirth, on) => {
  const [y1, m1, d1] = dateOfBirth.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

/** Ngày cuối cùng trẻ còn đo vòng đầu (tròn 60 tháng tuổi), BE trả cho form. */
export const headCircumferenceUntil = (dateOfBirth) => {
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  const firstOver = Date.UTC(y, m - 1 + HEAD_MAX_AGE_MONTHS + 1, d);
  return new Date(firstOver - 86400000).toISOString().slice(0, 10);
};

/** Khoảng tham khảo theo tuổi tại ngày khám, BE trả cho form phiếu khám. */
export const examReferenceFor = (dateOfBirth, on) => {
  const ageMonths = ageMonthsOn(dateOfBirth, on);
  const band = VITAL_BANDS.find((b) => ageMonths <= b.maxMonths);
  const headApplies = ageMonths <= HEAD_MAX_AGE_MONTHS;
  const autism = DEVELOPMENT_ITEMS.find((i) => i.key === 'autismRisk').ageMonths;
  return {
    ageMonths,
    vitals: { label: band.label, pulse: band.pulse, respiratoryRate: band.respiratoryRate, temperature: TEMPERATURE },
    head: headApplies ? headBand(ageMonths) : null,
    headApplies,
    autismQuestion: ageMonths >= autism[0] && ageMonths <= autism[1],
    label: VITAL_REFERENCE.label,
  };
};

const bmiOf = (m) => {
  const h = Number(m.heightCm) / 100;
  return h > 0 && m.weightKg != null && m.weightKg !== '' ? Math.round((Number(m.weightKg) / (h * h)) * 10) / 10 : null;
};

const VITAL_WORDS = { FEVER: 'sốt', HYPOTHERMIA: 'hạ thân nhiệt', FAST: 'nhanh', SLOW: 'chậm' };

const vitalPoints = (vitals, ref) =>
  VITAL_ITEMS.flatMap((item) => {
    const value = vitals?.[item.key];
    const hint = vitalStatusFor(item.key, value, ref.vitals);
    const chosen = vitals?.[item.statusKey];
    const name = item.label.replace(/ \(.*\)$/, '');
    if (hint && item.key === 'temperatureC' && hint.status !== 'NORMAL') {
      const limit =
        hint.status === 'FEVER'
          ? `từ ${formatDecimal(TEMPERATURE.feverFrom)} °C`
          : `dưới ${formatDecimal(TEMPERATURE.hypothermiaBelow)} °C`;
      return [{ key: item.key, text: `Nhiệt độ ${formatDecimal(value)} °C: ${VITAL_WORDS[hint.status]} (${limit})` }];
    }
    if (hint && item.key !== 'temperatureC' && (hint.status !== 'NORMAL' || hint.below)) {
      const range = item.key === 'pulse' ? ref.vitals.pulse : ref.vitals.respiratoryRate;
      const side = hint.below ? 'dưới' : hint.status === 'SLOW' ? 'dưới' : 'trên';
      return [
        {
          key: item.key,
          text: `${name} ${formatDecimal(value, 0)} ${item.unit}, ${side} khoảng tham khảo ${range.min}–${range.max} của ${ref.vitals.label}`,
        },
      ];
    }
    // Số đo trong khoảng nhưng bác sĩ chọn trạng thái bất thường: vẫn liệt kê theo lựa chọn của bác sĩ.
    const picked = item.options.find((o) => o.value === chosen);
    return picked?.abnormal ? [{ key: item.key, text: `${name}: ${picked.label.toLowerCase()} (theo bác sĩ)` }] : [];
  });

// Gợi ý kết hợp vòng đầu + 2 câu phần IV (user chốt 2026-10-17): 1 dấu hiệu ⇒ theo dõi; từ 2 ⇒ cân nhắc chuyển khám.
const combinedHint = (exam, headApplies) => {
  const signs = [];
  if (headApplies && exam.nutrition?.headStatus === 'LARGE') signs.push('Vòng đầu to');
  if (headApplies && exam.nutrition?.headStatus === 'SMALL') signs.push('Vòng đầu nhỏ');
  if (exam.development?.mental === 'NO') signs.push('Phát triển tinh thần chưa bình thường theo độ tuổi');
  if (exam.development?.motor === 'NO') signs.push('Phát triển vận động chưa bình thường theo độ tuổi');
  const level = signs.length >= 2 ? 'REFERRAL' : signs.length === 1 ? 'WATCH' : 'NONE';
  const text = {
    NONE: '',
    WATCH: 'Gợi ý: cần theo dõi',
    REFERRAL: 'Gợi ý: cân nhắc chuyển khám chuyên khoa',
  }[level];
  return { signs, total: headApplies ? 3 : 2, level, text };
};

const otherPoints = (exam, ref) => {
  const out = [];
  HISTORY_ITEMS.forEach((item) => {
    if (exam.history?.[item.key] !== 'YES') return;
    const detail = item.textKey && exam.history[item.textKey]?.trim();
    out.push(`${item.label}: Có${detail ? ` (${detail})` : ''}`);
  });
  (exam.nutrition?.statuses || [])
    .map((v) => NUTRITION_STATUS_OPTIONS.find((o) => o.value === v))
    .filter((o) => o?.abnormal)
    .forEach((o) => out.push(`Tình trạng dinh dưỡng: ${o.label}`));
  DEVELOPMENT_ITEMS.filter((i) => i.key === 'autismRisk' && ref.autismQuestion && exam.development?.autismRisk === 'YES').forEach((i) =>
    out.push(`${i.label}: Có`),
  );
  IMMUNIZATION_ITEMS.filter((i) => exam.immunization?.[i.key] === 'NO').forEach((i) => out.push(`Tiêm chủng — ${i.label}: Không`));
  CLINICAL_ITEMS.forEach((item) => {
    const o = item.options.find((x) => x.value === exam.clinical?.[item.key]);
    if (o?.abnormal) out.push(`${item.label}: ${o.label}`);
  });
  if (exam.clinical?.behaviorNote?.trim()) out.push(`Ghi rõ (tâm lý, hành vi): ${exam.clinical.behaviorNote.trim()}`);
  return out.map((text) => ({ text }));
};

// Gợi ý gộp phần II (user chốt 2026-10-17): 1/3 chỉ số ngoài khoảng ⇒ cần theo dõi; từ 2/3 ⇒ bác sĩ xem lại trước khi kết luận.
const vitalsHint = (points) => {
  const count = points.length;
  const level = count >= 2 ? 'ALERT' : count === 1 ? 'WATCH' : 'NONE';
  const text = {
    NONE: '',
    WATCH: 'Gợi ý: cần theo dõi',
    ALERT: 'Gợi ý: nhiều dấu hiệu sinh tồn bất thường, bác sĩ xem lại trước khi kết luận',
  }[level];
  return { count, total: VITAL_ITEMS.length, level, text };
};

/** "Điểm cần bác sĩ xem lại" của phiếu: sinh tồn theo tuổi (từng chỉ số và gợi ý gộp), gợi ý kết hợp, các mục khác. */
export const examReviewPoints = (m, dateOfBirth) => {
  const ref = examReferenceFor(dateOfBirth, m.date);
  const exam = m.exam || {};
  const vitals = vitalPoints(exam.vitals, ref);
  return {
    vitals,
    vitalsHint: vitalsHint(vitals),
    combined: combinedHint(exam, ref.headApplies),
    others: otherPoints(exam, ref),
    reference: VITAL_REFERENCE.label,
  };
};

/** Mức theo dõi và nhóm kết luận theo kết luận bác sĩ (D9); phiếu nháp chưa có mức. */
export const conclusionOutcome = (exam, examStatus) => {
  if (examStatus !== EXAM_STATUS.CONCLUDED) return { followUpLevel: FOLLOW_UP_LEVEL.UNAVAILABLE, category: null };
  const c = exam?.conclusion || {};
  if (c.tbRisk) return { followUpLevel: FOLLOW_UP_LEVEL.CLOSE_WATCH, category: CONCLUSION_CATEGORY.TB_RISK };
  // Phiếu cũ mẫu FOLLOW_UP (kết luận khi trẻ còn phiếu theo dõi, trước 2026-11-04) giữ mức "Cần theo dõi sát" đã lưu.
  if (c.followUpFinding) {
    const category =
      c.followUpFinding === FOLLOW_UP_FINDING.NEW_FINDING
        ? CONCLUSION_CATEGORY.FOLLOWING_NEW
        : c.followUpFinding === FOLLOW_UP_FINDING.ADVICE
          ? CONCLUSION_CATEGORY.ISSUE
          : CONCLUSION_CATEGORY.FOLLOWING_NO_NEW;
    return { followUpLevel: FOLLOW_UP_LEVEL.CLOSE_WATCH, category };
  }
  if (c.action === CONCLUSION_ACTION.REFERRAL)
    return { followUpLevel: FOLLOW_UP_LEVEL.CLOSE_WATCH, category: CONCLUSION_CATEGORY.REFERRAL };
  // Vấn đề đã biết, không thay đổi không gắn "Cần theo dõi" (user chốt 2026-10-21); phiếu cũ không có issueKind giữ "Cần theo dõi".
  if (c.healthIssue)
    return {
      followUpLevel: c.issueKind === ISSUE_KIND.KNOWN ? FOLLOW_UP_LEVEL.KNOWN_STABLE : FOLLOW_UP_LEVEL.WATCH,
      category: CONCLUSION_CATEGORY.ISSUE,
    };
  return { followUpLevel: FOLLOW_UP_LEVEL.NONE, category: CONCLUSION_CATEGORY.NORMAL };
};

// Mẫu cũ (trước 2026-10-17): vòng đầu theo khoảng tạm, chỉ để xem lại, không phải cảnh báo.
const legacyHeadStatus = (m, ageMonths) => {
  if (ageMonths > HEAD_MAX_AGE_MONTHS) return HEAD_CIRCUMFERENCE_STATUS.NOT_MEASURED;
  const v = m.headCircumferenceCm;
  if (v == null) return null;
  const band = headBand(ageMonths);
  if (v < band.low) return HEAD_CIRCUMFERENCE_STATUS.SMALL;
  return v > band.high ? HEAD_CIRCUMFERENCE_STATUS.LARGE : HEAD_CIRCUMFERENCE_STATUS.NORMAL;
};

/**
 * Giá trị dẫn xuất của 1 kết quả, tính lại mỗi lần đọc. child: { dateOfBirth, gender }. source:
 * EXAM = phiếu Phụ lục II · MEASUREMENT_ONLY = số đo của kỳ cân đo (hoặc cân đo cũ ngoài đợt) · LEGACY = mẫu cũ có vận động thô/tinh.
 * bmiStatus, bmiZScore chỉ có khi không phải phiếu khám: đợt khám theo kết luận bác sĩ (HLT-18).
 */
export const screenMeasurement = (m, child) => {
  const ageMonths = ageMonthsOn(child.dateOfBirth, m.date);
  const bmi = bmiOf(m);
  if (m.exam) {
    const headApplies = ageMonths <= HEAD_MAX_AGE_MONTHS;
    const { followUpLevel, category } = conclusionOutcome(m.exam, m.examStatus);
    const head = m.exam.nutrition?.headStatus;
    return {
      ageMonths,
      bmi,
      bmiStatus: null,
      bmiZScore: null,
      source: 'EXAM',
      headCircumferenceStatus: !headApplies
        ? HEAD_CIRCUMFERENCE_STATUS.NOT_MEASURED
        : head === 'LARGE'
          ? HEAD_CIRCUMFERENCE_STATUS.LARGE
          : head === 'SMALL'
            ? HEAD_CIRCUMFERENCE_STATUS.SMALL
            : head === 'NORMAL'
              ? HEAD_CIRCUMFERENCE_STATUS.NORMAL
              : null,
      followUpLevel,
      conclusionCategory: category,
    };
  }
  const legacy = m.grossMotor != null || m.fineMotor != null;
  const result = classifyBmiForAge({ gender: child.gender, ageMonths, heightCm: m.heightCm, weightKg: m.weightKg });
  return {
    ageMonths,
    bmi,
    bmiStatus: result?.status ?? null,
    bmiZScore: result?.zScore ?? null,
    source: legacy ? 'LEGACY' : 'MEASUREMENT_ONLY',
    headCircumferenceStatus: legacy
      ? legacyHeadStatus(m, ageMonths)
      : ageMonths <= HEAD_MAX_AGE_MONTHS
        ? null
        : HEAD_CIRCUMFERENCE_STATUS.NOT_MEASURED,
    followUpLevel: FOLLOW_UP_LEVEL.UNAVAILABLE,
    conclusionCategory: null,
  };
};

/** Kết luận bác sĩ rút gọn của phiếu Phụ lục II đã kết luận (danh sách lớp, lần khám trước, cảnh báo ở Sổ sức khỏe). */
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
