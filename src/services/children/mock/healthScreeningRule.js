import { BMI_STATUS, FOLLOW_UP_LEVEL, HEAD_CIRCUMFERENCE_STATUS, MOTOR_RESULT } from '@/models/children/childrenConstants';

/*
 * Bản sao rule sàng lọc của backend giả (user chốt 2026-10-15, PROPOSED; BE sở hữu rule thật).
 * Chuẩn tham chiếu user chọn là WHO (P-13) nhưng bảng z-score không chép vào FE: các ngưỡng dưới đây là TẠM,
 * chỉ để demo đủ các mức; UI luôn ghi "ngưỡng tham chiếu tạm".
 */
export const SCREENING_REFERENCE = { code: 'PLACEHOLDER', label: 'ngưỡng tham chiếu tạm (chờ BE chốt chuẩn WHO)' };

// Chuẩn vòng đầu WHO chỉ tới 60 tháng ⇒ trẻ lớn hơn không đo vòng đầu, chỉ xét 2 tiêu chí vận động.
const HEAD_MAX_AGE_MONTHS = 60;
const BMI_MIN_AGE_MONTHS = 24;
const BMI_MAX_AGE_MONTHS = 84;
const BMI_LOW = 13.2;
const BMI_HIGH = 18;
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

const flaggedMotor = (value) => (value == null ? null : value === MOTOR_RESULT.ABNORMAL);

export const screenMeasurement = (m, dateOfBirth) => {
  const ageMonths = ageMonthsOn(dateOfBirth, m.date);
  const h = Number(m.heightCm) / 100;
  const bmi = h > 0 && m.weightKg != null ? Math.round((Number(m.weightKg) / (h * h)) * 10) / 10 : null;
  let bmiStatus = BMI_STATUS.UNAVAILABLE;
  if (bmi != null && ageMonths >= BMI_MIN_AGE_MONTHS && ageMonths <= BMI_MAX_AGE_MONTHS)
    bmiStatus = bmi < BMI_LOW ? BMI_STATUS.LOW : bmi > BMI_HIGH ? BMI_STATUS.HIGH : BMI_STATUS.NORMAL;

  const headApplies = ageMonths <= HEAD_MAX_AGE_MONTHS;
  let headCircumferenceStatus = HEAD_CIRCUMFERENCE_STATUS.NOT_MEASURED;
  if (headApplies) {
    const band = headBand(ageMonths);
    const v = m.headCircumferenceCm;
    headCircumferenceStatus =
      v == null
        ? null
        : v < band.low
          ? HEAD_CIRCUMFERENCE_STATUS.SMALL
          : v > band.high
            ? HEAD_CIRCUMFERENCE_STATUS.LARGE
            : HEAD_CIRCUMFERENCE_STATUS.NORMAL;
  }

  const checks = [
    ...(headApplies
      ? [
          {
            key: 'HEAD_CIRCUMFERENCE',
            flagged: headCircumferenceStatus == null ? null : headCircumferenceStatus !== HEAD_CIRCUMFERENCE_STATUS.NORMAL,
          },
        ]
      : []),
    { key: 'GROSS_MOTOR', flagged: flaggedMotor(m.grossMotor) },
    { key: 'FINE_MOTOR', flagged: flaggedMotor(m.fineMotor) },
  ];
  // Lần đo trước khi có tiêu chí mới thiếu dữ liệu ⇒ không xếp mức.
  const missing = checks.some((c) => c.flagged == null);
  const count = checks.filter((c) => c.flagged).length;
  const followUpLevel = missing
    ? FOLLOW_UP_LEVEL.UNAVAILABLE
    : count >= 2
      ? FOLLOW_UP_LEVEL.CLOSE_WATCH
      : count === 1
        ? FOLLOW_UP_LEVEL.WATCH
        : FOLLOW_UP_LEVEL.NONE;

  return {
    ageMonths,
    bmi,
    bmiStatus,
    headCircumferenceStatus,
    criteria: missing ? [] : checks.map((c) => ({ key: c.key, flagged: c.flagged })),
    followUpLevel,
    reference: SCREENING_REFERENCE,
  };
};
