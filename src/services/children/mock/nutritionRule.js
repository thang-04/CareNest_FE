import { NUTRITION_STATUS } from '@/models/children/childrenConstants';

/*
 * Fake-backend copy of the fixed nutrition rule (GBR-HLT-02, GBR-AI-04): deterministic, never AI.
 * The reference standard (e.g. WHO Child Growth Standards by age and sex) is still to be confirmed,
 * so these BMI bands are placeholders; the real backend owns the rule and the UI only shows its result.
 */
const MIN_AGE_MONTHS = 24;
const MAX_AGE_MONTHS = 84;
const BMI_LOW = 13.2;
const BMI_HIGH = 18;

export const ageMonthsOn = (dateOfBirth, on) => {
  const [y1, m1, d1] = dateOfBirth.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

export const classifyMeasurement = ({ heightCm, weightKg, date }, dateOfBirth) => {
  const ageMonths = ageMonthsOn(dateOfBirth, date);
  const h = Number(heightCm) / 100;
  const bmi = h > 0 ? Math.round((Number(weightKg) / (h * h)) * 10) / 10 : null;
  let nutritionStatus = NUTRITION_STATUS.UNAVAILABLE;
  if (bmi != null && ageMonths >= MIN_AGE_MONTHS && ageMonths <= MAX_AGE_MONTHS) {
    if (bmi < BMI_LOW) nutritionStatus = NUTRITION_STATUS.MALNOURISHED;
    else if (bmi > BMI_HIGH) nutritionStatus = NUTRITION_STATUS.OBESE;
    else nutritionStatus = NUTRITION_STATUS.NORMAL;
  }
  return { ageMonths, bmi, nutritionStatus };
};
