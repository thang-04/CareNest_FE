import { WHO_HEIGHT_FOR_AGE } from './whoHeightForAge';
import { WHO_WEIGHT_FOR_AGE } from './whoWeightForAge';
import { bmiZScoreOf, classifyBmiForAge, roundHalfUp } from './bmiForAgeRule';

/*
 * Backend giả của báo cáo tổng hợp cân đo mẫu 5.1 (contract coordinator 2026-11-04): cân nặng theo tuổi (W/A), chiều cao theo
 * tuổi (H/A) chuẩn WHO (HLT-03) và BMI theo tuổi (HLT-18, bmiForAgeRule). BE sở hữu rule thật; lệch thì BE thắng.
 * Tuổi tháng tròn 0–84 tại ngày đo; z-score làm tròn 2 chữ số HALF_UP rồi mới so ngưỡng −2SD.
 */
export const GROWTH_MAX_MONTHS = 84;
export const GROWTH_Z_CUTOFF = -2;

const lmsOf = (table, gender, ageMonths) =>
  Number.isInteger(ageMonths) && ageMonths >= 0 && ageMonths <= GROWTH_MAX_MONTHS ? table[gender]?.[ageMonths] || null : null;

/** L, M, S cân nặng theo tuổi tại tháng tuổi tròn; null khi ngoài bảng. */
export const weightLmsOf = (gender, ageMonths) => lmsOf(WHO_WEIGHT_FOR_AGE, gender, ageMonths);
/** L, M, S chiều dài/chiều cao theo tuổi (L = 1) tại tháng tuổi tròn; null khi ngoài bảng. */
export const heightLmsOf = (gender, ageMonths) => lmsOf(WHO_HEIGHT_FOR_AGE, gender, ageMonths);

/** Z-score chưa làm tròn của cân nặng: công thức LMS, ngoài ±3SD giới hạn đuôi như BMI theo tuổi (WHO). */
export const weightZScoreOf = (weightKg, lms) => bmiZScoreOf(weightKg, lms);

/** Z-score chưa làm tròn của chiều cao: L = 1 nên z = (x/M − 1)/S, không giới hạn đuôi. */
export const heightZScoreOf = (heightCm, [l, m, s]) => ((heightCm / m) ** l - 1) / (l * s);

// Nhóm của mẫu 5.1 theo mức BMI theo tuổi: nguy cơ thừa cân (đến 60 tháng) tính vào bình thường (coordinator chốt 2026-11-04).
const BMI_GROUP = {
  SEVERE_THINNESS: 'WASTED',
  THINNESS: 'WASTED',
  NORMAL: 'NORMAL',
  OVERWEIGHT_RISK: 'NORMAL',
  OVERWEIGHT: 'OVERWEIGHT',
  OBESE: 'OBESE',
};

const positive = (v) => v !== '' && v != null && Number(v) > 0;

/**
 * Phân loại một lần đo cho mẫu 5.1: { weightZ, heightZ, weight: NORMAL | UNDERWEIGHT, height: NORMAL | STUNTED, bmiStatus,
 * bmi: NORMAL | WASTED | OVERWEIGHT | OBESE }; null (chưa xếp được) khi thiếu giới tính, chiều cao, cân nặng hoặc tuổi ngoài
 * 0–84 tháng — khi đó mọi chỉ số đều không có (ba bảng WHO cùng khoảng tuổi).
 */
export const classifyGrowth = ({ gender, ageMonths, heightCm, weightKg }) => {
  const weightLms = weightLmsOf(gender, ageMonths);
  const heightLms = heightLmsOf(gender, ageMonths);
  const bmi = classifyBmiForAge({ gender, ageMonths, heightCm, weightKg });
  if (!weightLms || !heightLms || !bmi || !positive(heightCm) || !positive(weightKg)) return null;
  const weightZ = roundHalfUp(weightZScoreOf(Number(weightKg), weightLms), 2);
  const heightZ = roundHalfUp(heightZScoreOf(Number(heightCm), heightLms), 2);
  return {
    weightZ,
    heightZ,
    bmiZ: bmi.zScore,
    bmiStatus: bmi.status,
    weight: weightZ < GROWTH_Z_CUTOFF ? 'UNDERWEIGHT' : 'NORMAL',
    height: heightZ < GROWTH_Z_CUTOFF ? 'STUNTED' : 'NORMAL',
    bmi: BMI_GROUP[bmi.status],
  };
};
