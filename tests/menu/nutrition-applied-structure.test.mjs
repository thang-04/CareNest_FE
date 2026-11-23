import assert from 'node:assert/strict';
import { test } from 'node:test';
import { quyDoiGam, toSetupForm, toSetupPayload } from '@/utils/menu-planning/nutritionSetup';
import { appliedStructureError, validateNutritionSetup } from '@/utils/menu-planning/menuPlanningValidation';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.005, `${actual} ≠ ${expected}`);
const applied = (protein, lipid, glucid) => ({ protein, lipid, glucid });
const NORMS = { protein: ['13', '20'], lipid: ['25', '35'], glucid: ['55', '65'] };

test('quy đổi 14–26–60 tại 615 và 726 kcal khớp bộ nghiệm thu BA', () => {
  const at615 = quyDoiGam(615, applied('14', '26', '60'));
  near(at615.animalProteinG, 12.6);
  near(at615.plantProteinG, 8.4);
  near(at615.animalLipidG, 10.32);
  near(at615.plantLipidG, 6.88);
  near(at615.glucidG, 90);
  const at726 = quyDoiGam(726, applied('14', '26', '60'));
  near(at726.animalProteinG, 14.87);
  near(at726.plantProteinG, 9.92);
  near(at726.animalLipidG, 12.18);
  near(at726.plantLipidG, 8.12);
  near(at726.glucidG, 106.24);
});

test('đổi cơ cấu 14–26–60 sang 15–25–60 giữ kcal: đạm ĐV 13,50, béo ĐV 9,92, bột đường 90,00', () => {
  const at615 = quyDoiGam(615, applied('15', '25', '60'));
  near(at615.animalProteinG, 13.5);
  near(at615.animalLipidG, 9.92);
  near(at615.glucidG, 90);
});

test('không tính khi thiếu kcal, thiếu chất, tổng sai hoặc ngoài 0–100', () => {
  assert.equal(quyDoiGam('', applied('14', '26', '60')), null);
  assert.equal(quyDoiGam(0, applied('14', '26', '60')), null);
  assert.equal(quyDoiGam(615, applied('14', '', '60')), null);
  assert.equal(quyDoiGam(615, applied('14', '26', '61')), null);
  assert.equal(quyDoiGam(615, applied('-5', '45', '60')), null);
});

test('hệ số 4–9–4 truyền vào cùng hàm cho kết quả khác', () => {
  const factors = { proteinKcalPerG: 4, lipidKcalPerG: 9, glucidKcalPerG: 4, animalProteinShare: 0.6, animalLipidShare: 0.6 };
  near(quyDoiGam(600, applied('15', '25', '60'), factors).glucidG, 90);
  near(quyDoiGam(600, applied('15', '25', '60'), factors).animalLipidG, 10);
});

test('cơ cấu áp dụng: để trống cả ba là chưa chọn, hợp lệ trong khoảng thì không lỗi', () => {
  assert.equal(appliedStructureError(applied('', '', ''), NORMS), null);
  assert.equal(appliedStructureError(applied('14', '26', '60'), NORMS), null);
});

test('cơ cấu áp dụng báo lỗi: thiếu số, tổng khác 100, ngoài khoảng, ngoài 0–100', () => {
  assert.match(appliedStructureError(applied('14', '', '60'), NORMS), /Nhập đủ/);
  assert.match(appliedStructureError(applied('14', '26', '61'), NORMS), /Tổng là 101%/);
  assert.match(appliedStructureError(applied('25', '25', '50'), NORMS), /Đạm phải từ 13 đến 20%/);
  assert.match(appliedStructureError(applied('14', '-6', '92'), NORMS), /0 đến 100/);
});

test('form lưu: lỗi cơ cấu nằm ở khóa `${nhóm}.applied`, payload chỉ gửi kcal và khoảng P:L:G', () => {
  const setup = {
    ageGroupId: 'ag-3',
    enabled: true,
    price: 34000,
    meals: [],
    norms: { kcal: [615, 726], ...NORMS, animalProteinG: [1, 2], calcium: [100, 200], lunchKcalPct: [30, 35] },
    dailyKcalNeed: 1290,
    applied: { protein: 14, lipid: 26, glucid: 61 },
  };
  const form = toSetupForm([setup], '2026-11-23');
  const errors = validateNutritionSetup({ ...form, effectiveFrom: '2026-11-24' }, '2026-11-23', { mealsReadOnly: true });
  assert.match(errors['ag-3.applied'], /Tổng là 101%/);
  const payload = toSetupPayload(form);
  assert.deepEqual(Object.keys(payload.groups[0].norms).sort(), ['glucid', 'kcal', 'lipid', 'protein']);
  assert.deepEqual(payload.groups[0].applied, { protein: '14', lipid: '26', glucid: '61' });
});
