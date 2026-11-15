import { WHO_BMI_FOR_AGE } from './whoBmiForAge';

/*
 * Backend giả của HLT-18: mức BMI theo tuổi chuẩn WHO (HLT-03) cho số đo của kỳ cân đo. BE sở hữu rule thật
 * (BE:src/main/java/com/carenest/service/health/impl/WhoBmiForAge.java); lệch thì BE thắng.
 * Z-score theo phương pháp LMS; ngoài ±3SD tính theo cách giới hạn đuôi của WHO. Chỉ đánh dấu sàng lọc, không chẩn đoán (HLT-12).
 */
export const BMI_MAX_MONTHS = 84;
// Từ 61 tháng theo WHO 2007: thừa cân > +1SD, béo phì > +2SD; đến 60 tháng: nguy cơ thừa cân, thừa cân > +2SD, béo phì > +3SD.
export const BMI_REFERENCE_2007_FROM_MONTHS = 61;

/** L, M, S của giới tính tại tháng tuổi tròn; null khi ngoài bảng. */
export const bmiLmsOf = (gender, ageMonths) => WHO_BMI_FOR_AGE[gender]?.[ageMonths] || null;

/** BMI tại z-score z theo công thức LMS (không giới hạn đuôi). */
export const bmiAtZ = (z, [l, m, s]) => m * (1 + l * s * z) ** (1 / l);

/** Z-score chưa làm tròn của một BMI. */
export const bmiZScoreOf = (bmi, lms) => {
  const [l, m, s] = lms;
  const z = ((bmi / m) ** l - 1) / (l * s);
  if (z > 3) {
    const sd3 = bmiAtZ(3, lms);
    return 3 + (bmi - sd3) / (sd3 - bmiAtZ(2, lms));
  }
  if (z < -3) {
    const sd3 = bmiAtZ(-3, lms);
    return -3 + (bmi - sd3) / (bmiAtZ(-2, lms) - sd3);
  }
  return z;
};

/** BMI cho ra đúng z-score z (nghịch đảo của bmiZScoreOf, kể cả đuôi ngoài ±3SD); dùng dựng số đo demo và kiểm thử. */
export const bmiForZScore = (z, lms) => {
  if (z > 3) {
    const sd3 = bmiAtZ(3, lms);
    return sd3 + (z - 3) * (sd3 - bmiAtZ(2, lms));
  }
  if (z < -3) {
    const sd3 = bmiAtZ(-3, lms);
    return sd3 + (z + 3) * (bmiAtZ(-2, lms) - sd3);
  }
  return bmiAtZ(z, lms);
};

/** Mức theo z-score (đã làm tròn 2 chữ số, như BE) và tháng tuổi. */
export const bmiStatusOf = (z, ageMonths) => {
  if (z < -3) return 'SEVERE_THINNESS';
  if (z < -2) return 'THINNESS';
  if (z <= 1) return 'NORMAL';
  if (ageMonths >= BMI_REFERENCE_2007_FROM_MONTHS) return z <= 2 ? 'OVERWEIGHT' : 'OBESE';
  if (z <= 2) return 'OVERWEIGHT_RISK';
  return z <= 3 ? 'OVERWEIGHT' : 'OBESE';
};

// Làm tròn HALF_UP trên chữ số thập phân ngắn nhất của số, như BigDecimal.valueOf(z).setScale(2, HALF_UP) của BE.
export const roundHalfUp = (x, digits = 2) => {
  const text = Math.abs(x).toString();
  if (text.includes('e')) return 0;
  const [int, frac = ''] = text.split('.');
  const kept = Number(`${int}${frac.slice(0, digits).padEnd(digits, '0')}`) + (Number(frac[digits] || 0) >= 5 ? 1 : 0);
  const value = kept / 10 ** digits;
  return x < 0 && value !== 0 ? -value : value;
};

const positive = (v) => v !== '' && v != null && Number(v) > 0;

/**
 * Mức BMI theo tuổi của một lần đo: { status, zScore }; null khi thiếu giới tính, chiều cao, cân nặng hoặc tuổi ngoài 0–84 tháng.
 * BMI để tính là cân nặng / (chiều cao m)², không làm tròn; z-score làm tròn 2 chữ số rồi mới so ngưỡng (BE chốt 2026-11-04), nên
 * mức luôn khớp z-score hiển thị.
 */
export const classifyBmiForAge = ({ gender, ageMonths, heightCm, weightKg }) => {
  const lms = Number.isInteger(ageMonths) && ageMonths >= 0 && ageMonths <= BMI_MAX_MONTHS ? bmiLmsOf(gender, ageMonths) : null;
  if (!lms || !positive(heightCm) || !positive(weightKg)) return null;
  const heightM = Number(heightCm) / 100;
  const zScore = roundHalfUp(bmiZScoreOf(Number(weightKg) / (heightM * heightM), lms), 2);
  return { status: bmiStatusOf(zScore, ageMonths), zScore };
};
