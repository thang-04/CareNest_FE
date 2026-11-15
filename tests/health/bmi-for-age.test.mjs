import assert from 'node:assert/strict';
import { test } from 'node:test';

const { WHO_BMI_FOR_AGE } = await import('@/services/children/mock/whoBmiForAge');
const { bmiForZScore, bmiLmsOf, bmiZScoreOf, classifyBmiForAge, roundHalfUp } = await import('@/services/children/mock/bmiForAgeRule');

/*
 * HLT-18 (BE giả): mức BMI theo tuổi chuẩn WHO (HLT-03). BMI kiểm thử dựng độc lập từ định nghĩa LMS của WHO:
 * |z| ≤ 3: BMI = M(1 + LSz)^(1/L); ngoài ±3SD theo cách giới hạn đuôi (SD3 ± (|z| − 3)·khoảng SD2–SD3). Dữ liệu giả.
 */
const lmsAt = (z, [l, m, s]) => m * (1 + l * s * z) ** (1 / l);
const bmiAt = (z, lms) => {
  if (z > 3) return lmsAt(3, lms) + (z - 3) * (lmsAt(3, lms) - lmsAt(2, lms));
  if (z < -3) return lmsAt(-3, lms) + (z + 3) * (lmsAt(-2, lms) - lmsAt(-3, lms));
  return lmsAt(z, lms);
};
// Chiều cao 100 cm ⇒ BMI = cân nặng, để dựng số đo đúng BMI mong muốn.
const classifyAt = (gender, ageMonths, bmi) => classifyBmiForAge({ gender, ageMonths, heightCm: 100, weightKg: bmi });

const Z = [-3.5, -2.5, 0, 1.5, 2.5, 3.5];
const UNTIL_60 = ['SEVERE_THINNESS', 'THINNESS', 'NORMAL', 'OVERWEIGHT_RISK', 'OVERWEIGHT', 'OBESE'];
const FROM_61 = ['SEVERE_THINNESS', 'THINNESS', 'NORMAL', 'OVERWEIGHT', 'OBESE', 'OBESE'];

test('HLT-18: bảng WHO đủ 0–84 tháng cho cả hai giới tính, đúng số của WHO ở đầu và cuối bảng', () => {
  for (const gender of ['MALE', 'FEMALE']) {
    assert.equal(WHO_BMI_FOR_AGE[gender].length, 85);
    assert.ok(WHO_BMI_FOR_AGE[gender].every((row) => row.length === 3 && row.every(Number.isFinite) && row[0] !== 0));
  }
  assert.deepEqual(bmiLmsOf('MALE', 0), [-0.3053, 13.4069, 0.0956]);
  assert.deepEqual(bmiLmsOf('MALE', 24), [-0.6187, 16.0189, 0.07785]);
  assert.deepEqual(bmiLmsOf('MALE', 61), [-0.7387, 15.2641, 0.0839]);
  assert.deepEqual(bmiLmsOf('FEMALE', 84), [-1.2565, 15.4036, 0.10746]);
  assert.equal(bmiLmsOf('MALE', 85), null);
});

test('HLT-18: trẻ trai và gái đến 60 tháng — sáu mức theo z-score, z làm tròn 2 chữ số', () => {
  for (const [gender, age] of [
    ['MALE', 36],
    ['FEMALE', 18],
    ['FEMALE', 60],
  ]) {
    const lms = bmiLmsOf(gender, age);
    Z.forEach((z, i) => {
      const result = classifyAt(gender, age, bmiAt(z, lms));
      assert.equal(result.status, UNTIL_60[i], `${gender} ${age} tháng, z=${z}`);
      assert.equal(result.zScore, z, `${gender} ${age} tháng: z-score ${z}`);
    });
  }
});

test('HLT-18: trẻ từ 61 tháng theo WHO 2007 — không có mức nguy cơ thừa cân; > +1SD thừa cân, > +2SD béo phì', () => {
  for (const [gender, age] of [
    ['MALE', 72],
    ['FEMALE', 61],
    ['FEMALE', 84],
  ]) {
    const lms = bmiLmsOf(gender, age);
    Z.forEach((z, i) => {
      const result = classifyAt(gender, age, bmiAt(z, lms));
      assert.equal(result.status, FROM_61[i], `${gender} ${age} tháng, z=${z}`);
      assert.equal(result.zScore, z);
    });
  }
});

test('HLT-18: tháng 24 và tháng 61 đổi bảng tham chiếu', () => {
  const bmi24 = bmiLmsOf('MALE', 24)[1];
  assert.equal(classifyAt('MALE', 24, bmi24).zScore, 0, 'tháng 24 dùng bảng đo đứng WHO 2006');
  assert.notEqual(classifyAt('MALE', 23, bmi24).zScore, 0, 'tháng 23 dùng bảng đo nằm');
  const bmi61 = bmiLmsOf('FEMALE', 61)[1];
  assert.equal(classifyAt('FEMALE', 61, bmi61).zScore, 0, 'tháng 61 dùng WHO 2007');
  assert.notEqual(classifyAt('FEMALE', 60, bmi61).zScore, 0);
  // Cùng z = +1,5: đến 60 tháng là nguy cơ thừa cân, từ 61 tháng là thừa cân.
  assert.equal(classifyAt('MALE', 60, bmiAt(1.5, bmiLmsOf('MALE', 60))).status, 'OVERWEIGHT_RISK');
  assert.equal(classifyAt('MALE', 61, bmiAt(1.5, bmiLmsOf('MALE', 61))).status, 'OVERWEIGHT');
});

test('HLT-18: so ngưỡng bằng z-score đã làm tròn 2 chữ số (BE chốt 2026-11-04), mức khớp z-score hiển thị', () => {
  const lms = bmiLmsOf('FEMALE', 40);
  const at = (z) => Object.values(classifyAt('FEMALE', 40, bmiAt(z, lms)));
  assert.deepEqual(at(1.004), ['NORMAL', 1], 'z 1,004 → 1,00: chưa trên +1SD');
  assert.deepEqual(at(1.006), ['OVERWEIGHT_RISK', 1.01], 'z 1,006 → 1,01');
  assert.deepEqual(at(-2.004), ['NORMAL', -2], 'z −2,004 → −2,00: chưa dưới −2SD');
  assert.deepEqual(at(-2.006), ['THINNESS', -2.01], 'z −2,006 → −2,01');
  assert.deepEqual(at(3.004), ['OVERWEIGHT', 3], 'đến 60 tháng: z 3,00 vẫn thừa cân, chưa béo phì');
});

test('HLT-18: không xếp mức khi thiếu số đo, giới tính hoặc tuổi ngoài 0–84 tháng; BMI tính từ số chưa làm tròn', () => {
  assert.equal(classifyBmiForAge({ gender: 'MALE', ageMonths: 85, heightCm: 110, weightKg: 19 }), null);
  assert.equal(classifyBmiForAge({ gender: 'MALE', ageMonths: -1, heightCm: 50, weightKg: 3 }), null);
  assert.equal(classifyBmiForAge({ gender: 'MALE', ageMonths: 40, heightCm: null, weightKg: 15 }), null);
  assert.equal(classifyBmiForAge({ gender: 'MALE', ageMonths: 40, heightCm: 100, weightKg: '' }), null);
  assert.equal(classifyBmiForAge({ gender: undefined, ageMonths: 40, heightCm: 100, weightKg: 15 }), null);
  const lms = bmiLmsOf('MALE', 48);
  const z = bmiZScoreOf(18.2 / (1.034 * 1.034), lms);
  assert.equal(classifyBmiForAge({ gender: 'MALE', ageMonths: 48, heightCm: 103.4, weightKg: 18.2 }).zScore, roundHalfUp(z, 2));
});

test('HLT-18: z-score làm tròn HALF_UP 2 chữ số như BE; nghịch đảo dùng cho số đo demo khớp lại đúng z', () => {
  assert.equal(roundHalfUp(2.345), 2.35);
  assert.equal(roundHalfUp(-2.345), -2.35);
  assert.equal(roundHalfUp(2.3449999999999998), 2.34);
  assert.ok(Object.is(roundHalfUp(-0.001), 0), 'không ra −0');
  const lms = bmiLmsOf('FEMALE', 70);
  for (const z of [-3.4, -2.5, 0.1, 1.6, 3.4]) assert.equal(roundHalfUp(bmiZScoreOf(bmiForZScore(z, lms), lms)), z);
});
