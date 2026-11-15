import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const { WHO_WEIGHT_FOR_AGE } = await import('@/services/children/mock/whoWeightForAge');
const { WHO_HEIGHT_FOR_AGE } = await import('@/services/children/mock/whoHeightForAge');
const { classifyGrowth, heightLmsOf, weightLmsOf } = await import('@/services/children/mock/growthForAgeRule');
const { bmiLmsOf } = await import('@/services/children/mock/bmiForAgeRule');

/*
 * Báo cáo tổng hợp cân đo mẫu 5.1 (BE giả, plan docs/plans/active/2026-11-04-health-growth-report.md): cân nặng/tuổi, chiều cao/tuổi
 * chuẩn WHO (HLT-03). Số đo kiểm thử dựng độc lập từ định nghĩa LMS: x = M(1 + LSz)^(1/L); cân nặng ngoài ±3SD theo cách giới hạn
 * đuôi như BMI. Z-score làm tròn 2 chữ số rồi mới so ngưỡng −2SD, như BE. Dữ liệu giả.
 */
const atZ = (z, [l, m, s]) => m * (1 + l * s * z) ** (1 / l);
const weightAt = (z, lms) => {
  if (z < -3) return atZ(-3, lms) + (z + 3) * (atZ(-2, lms) - atZ(-3, lms));
  if (z > 3) return atZ(3, lms) + (z - 3) * (atZ(3, lms) - atZ(2, lms));
  return atZ(z, lms);
};
// Số đo cho ra đúng z cân nặng zw và z chiều cao zh của trẻ (giới, tháng tuổi).
const measuredAt = (gender, ageMonths, zw, zh) => ({
  gender,
  ageMonths,
  weightKg: weightAt(zw, weightLmsOf(gender, ageMonths)),
  heightCm: atZ(zh, heightLmsOf(gender, ageMonths)),
});
const BE_DIR = '../CareNest_BE/src/main/resources/health';

test('Bảng WHO cân nặng/tuổi, chiều cao/tuổi đủ 0–84 tháng hai giới, khớp các dòng đối chiếu của BE', () => {
  for (const table of [WHO_WEIGHT_FOR_AGE, WHO_HEIGHT_FOR_AGE])
    for (const gender of ['MALE', 'FEMALE']) {
      assert.equal(table[gender].length, 85);
      assert.ok(table[gender].every((row) => row.length === 3 && row.every(Number.isFinite)));
    }
  assert.deepEqual(weightLmsOf('MALE', 0), [0.3487, 3.3464, 0.14602]);
  assert.deepEqual(weightLmsOf('FEMALE', 60), [-0.3518, 18.2193, 0.14821]);
  assert.deepEqual(weightLmsOf('MALE', 61), [-0.2026, 18.5057, 0.12988], 'từ 61 tháng theo WHO 2007');
  assert.deepEqual(heightLmsOf('MALE', 23), [1, 86.941, 0.03445], 'đến 23 tháng là chiều dài (đo nằm)');
  assert.deepEqual(heightLmsOf('MALE', 24), [1, 87.1161, 0.03507], 'tháng 24 lấy bảng chiều cao (đo đứng)');
  assert.deepEqual(heightLmsOf('FEMALE', 61), [1, 109.6016, 0.04355]);
  assert.ok(
    ['MALE', 'FEMALE'].every((g) => WHO_HEIGHT_FOR_AGE[g].every(([l]) => l === 1)),
    'chiều cao/tuổi L = 1',
  );
  assert.equal(weightLmsOf('MALE', 85), null);
  assert.equal(heightLmsOf('FEMALE', -1), null);
});

test('Module JS sinh đúng từ CSV của BE (khi có repo BE cạnh bên)', () => {
  for (const [file, table] of [
    ['who-weight-for-age.csv', WHO_WEIGHT_FOR_AGE],
    ['who-height-for-age.csv', WHO_HEIGHT_FOR_AGE],
  ]) {
    const path = `${BE_DIR}/${file}`;
    // CI chỉ có repo FE: bỏ qua so khớp, các dòng đối chiếu ở test trên vẫn chạy.
    if (!existsSync(path)) continue;
    const rows = readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#'))
      .slice(1)
      .map((line) => line.split(','));
    assert.equal(rows.length, 170, file);
    rows.forEach(([sex, month, l, m, s]) =>
      assert.deepEqual(table[sex][Number(month)], [Number(l), Number(m), Number(s)], `${file} ${sex} ${month}`),
    );
  }
});

test('Trung vị ⇒ z = 0, trẻ phát triển bình thường ở cả ba chỉ số (hai giới, các tháng đổi bảng)', () => {
  for (const gender of ['MALE', 'FEMALE'])
    for (const ageMonths of [0, 23, 24, 36, 60, 61, 84]) {
      const growth = classifyGrowth(measuredAt(gender, ageMonths, 0, 0));
      assert.equal(growth.weightZ, 0, `${gender} ${ageMonths} tháng: z cân nặng`);
      assert.equal(growth.heightZ, 0, `${gender} ${ageMonths} tháng: z chiều cao`);
      assert.deepEqual([growth.weight, growth.height], ['NORMAL', 'NORMAL']);
    }
});

test('Mốc −2SD như BE: z làm tròn 2 chữ số rồi so; đúng −2 vẫn bình thường, −2,01 là suy dinh dưỡng', () => {
  for (const [gender, ageMonths] of [
    ['MALE', 18],
    ['FEMALE', 48],
    ['MALE', 72],
  ]) {
    const at = (zw, zh) => classifyGrowth(measuredAt(gender, ageMonths, zw, zh));
    assert.deepEqual([at(-2, -2).weight, at(-2, -2).height], ['NORMAL', 'NORMAL'], `${gender} ${ageMonths}: z = −2`);
    assert.deepEqual([at(-2.01, -2.01).weight, at(-2.01, -2.01).height], ['UNDERWEIGHT', 'STUNTED'], `${gender} ${ageMonths}: z = −2,01`);
    // −2,004 làm tròn thành −2,00 (bình thường); −2,006 thành −2,01 (suy dinh dưỡng)
    assert.deepEqual([at(-2.004, -2.004).weight, at(-2.004, -2.004).height], ['NORMAL', 'NORMAL']);
    assert.deepEqual([at(-2.006, -2.006).weightZ, at(-2.006, -2.006).heightZ], [-2.01, -2.01]);
  }
});

test('Cân nặng ngoài −3SD tính theo đuôi giới hạn (gồm suy dinh dưỡng nặng); chiều cao L = 1 không giới hạn đuôi', () => {
  const growth = classifyGrowth(measuredAt('FEMALE', 30, -3.5, -3.5));
  assert.deepEqual([growth.weightZ, growth.heightZ], [-3.5, -3.5]);
  assert.deepEqual([growth.weight, growth.height], ['UNDERWEIGHT', 'STUNTED']);
  const tall = classifyGrowth(measuredAt('MALE', 50, 3.4, 3.4));
  assert.deepEqual([tall.weightZ, tall.heightZ, tall.weight, tall.height], [3.4, 3.4, 'NORMAL', 'NORMAL']);
});

test('Nhóm BMI của mẫu 5.1: nguy cơ thừa cân vào bình thường; gầy còm gồm nặng; thừa cân, béo phì riêng', () => {
  // Chiều cao 100 cm ⇒ BMI = cân nặng; dựng BMI theo z của bảng BMI theo tuổi.
  const bmiCase = (gender, ageMonths, z) => {
    const lms = bmiLmsOf(gender, ageMonths);
    const bmi =
      z < -3
        ? atZ(-3, lms) + (z + 3) * (atZ(-2, lms) - atZ(-3, lms))
        : z > 3
          ? atZ(3, lms) + (z - 3) * (atZ(3, lms) - atZ(2, lms))
          : atZ(z, lms);
    return classifyGrowth({ gender, ageMonths, heightCm: 100, weightKg: bmi });
  };
  assert.deepEqual(
    [-3.5, -2.5, 0, 1.5, 2.5, 3.5].map((z) => {
      const g = bmiCase('MALE', 40, z);
      return [g.bmiStatus, g.bmi];
    }),
    [
      ['SEVERE_THINNESS', 'WASTED'],
      ['THINNESS', 'WASTED'],
      ['NORMAL', 'NORMAL'],
      ['OVERWEIGHT_RISK', 'NORMAL'],
      ['OVERWEIGHT', 'OVERWEIGHT'],
      ['OBESE', 'OBESE'],
    ],
  );
  assert.deepEqual([bmiCase('FEMALE', 70, 1.5).bmi, bmiCase('FEMALE', 70, 2.5).bmi], ['OVERWEIGHT', 'OBESE'], 'từ 61 tháng theo WHO 2007');
});

test('Chưa xếp được: thiếu giới tính, chưa có tuổi, ngoài 0–84 tháng, thiếu chiều cao/cân nặng', () => {
  const ok = measuredAt('MALE', 40, 0, 0);
  assert.ok(classifyGrowth(ok));
  assert.equal(classifyGrowth({ ...ok, gender: null }), null);
  assert.equal(classifyGrowth({ ...ok, ageMonths: null }), null);
  assert.equal(classifyGrowth({ ...ok, ageMonths: 85 }), null);
  assert.equal(classifyGrowth({ ...ok, heightCm: '' }), null);
  assert.equal(classifyGrowth({ ...ok, weightKg: 0 }), null);
});
