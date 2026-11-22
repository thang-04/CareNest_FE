import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { examReferenceFor } from '@/services/children/mock/healthScreeningRule';
import { WHO_HEAD_CIRCUMFERENCE_FOR_AGE } from '@/services/children/mock/whoHeadCircumferenceForAge';

// Vòng đầu theo tuổi WHO 2006 (user chốt 2026-11-22, thay khoảng tạm): −2SD..+2SD theo giới tính, tháng tuổi; BE giả
// khớp BE:WhoHeadCircumferenceForAge. Số mong đợi là cột SD2neg/SD2 của bảng WHO.
const DOB = '2022-09-01';

test('khoảng vòng đầu theo giới tính và tháng tuổi khớp bảng WHO', () => {
  assert.deepEqual(examReferenceFor(DOB, '2024-09-01', 'MALE').head, { low: 45.5, high: 51 });
  assert.deepEqual(examReferenceFor(DOB, '2024-09-01', 'FEMALE').head, { low: 44.4, high: 50 });
  assert.deepEqual(examReferenceFor(DOB, '2023-09-01', 'MALE').head, { low: 43.5, high: 48.6 });
  assert.deepEqual(examReferenceFor(DOB, '2027-09-01', 'FEMALE').head, { low: 47.1, high: 52.8 });
});

test('quá 60 tháng không đo vòng đầu; thiếu giới tính vẫn đo nhưng không có khoảng', () => {
  const at61 = examReferenceFor(DOB, '2027-10-01', 'MALE');
  assert.equal(at61.headApplies, false);
  assert.equal(at61.head, null);
  const noGender = examReferenceFor(DOB, '2024-09-01');
  assert.equal(noGender.headApplies, true);
  assert.equal(noGender.head, null);
});

test('bảng có đủ 0–60 tháng cho hai giới tính', () => {
  assert.equal(WHO_HEAD_CIRCUMFERENCE_FOR_AGE.MALE.length, 61);
  assert.equal(WHO_HEAD_CIRCUMFERENCE_FOR_AGE.FEMALE.length, 61);
});

test('phiếu khám ghi khoảng theo chuẩn WHO, không còn "khoảng tham khảo tạm"; thiếu khoảng thì không lỗi', () => {
  const step = readFileSync('src/components/children/exam/ExamMeasureStep.jsx', 'utf8');
  assert.doesNotMatch(step, /Khoảng tham khảo tạm của tuổi này/);
  assert.match(step, /chuẩn WHO/);
  assert.match(step, /reference\.head\s*\?/);
});
