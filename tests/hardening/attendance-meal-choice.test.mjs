import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mealChoiceOf, mealChoiceOptions, mealsOfChoice } from '../../src/utils/attendance/mealChoice.js';

// ATT-02a (Cần chốt 27/11/2026): cô chọn trẻ ăn bữa nào trong các bữa của nhóm tuổi
const TWO = ['LUNCH', 'AFTERNOON'];
const THREE = ['MORNING', 'LUNCH', 'AFTERNOON'];

test('lớp 2 bữa: ăn đủ, chỉ một bữa, không ăn', () => {
  assert.deepEqual(
    mealChoiceOptions(TWO).map((o) => o.label),
    ['Ăn đủ', 'Chỉ ăn Trưa', 'Chỉ ăn Xế', 'Không ăn'],
  );
});

test('lớp 3 bữa: đủ mọi tổ hợp, ăn đủ đứng đầu, không ăn đứng cuối', () => {
  const labels = mealChoiceOptions(THREE).map((o) => o.label);
  assert.equal(labels.length, 8);
  assert.equal(labels[0], 'Ăn đủ');
  assert.equal(labels.at(-1), 'Không ăn');
  assert.ok(labels.includes('Phụ sáng, Trưa'));
  assert.ok(labels.includes('Chỉ ăn Phụ sáng'));
});

test('chỉ còn một bữa (nghỉ sáng): Ăn Xế hoặc Không ăn', () => {
  assert.deepEqual(
    mealChoiceOptions(['AFTERNOON']).map((o) => o.label),
    ['Ăn Xế', 'Không ăn'],
  );
});

test('giá trị đang chọn theo bản nháp, bỏ qua bữa ngoài danh sách', () => {
  const value = (meals, sessions) => mealChoiceOptions(sessions).find((o) => o.value === mealChoiceOf(meals, sessions)).label;
  assert.equal(value({ LUNCH: true, AFTERNOON: true }, TWO), 'Ăn đủ');
  assert.equal(value({ LUNCH: true, AFTERNOON: false }, TWO), 'Chỉ ăn Trưa');
  assert.equal(value({ MORNING: true, LUNCH: false, AFTERNOON: false }, TWO), 'Không ăn');
  assert.equal(value(undefined, TWO), 'Không ăn');
});

test('chọn xong ghi rõ true/false cho mọi bữa của lớp', () => {
  assert.deepEqual(mealsOfChoice(mealChoiceOf({ LUNCH: true }, TWO), THREE), {
    MORNING: false,
    LUNCH: true,
    AFTERNOON: false,
  });
  assert.deepEqual(mealsOfChoice(mealChoiceOf({}, TWO), TWO), { LUNCH: false, AFTERNOON: false });
});

test('màn điểm danh dùng ô chọn bữa, không còn công tắc ăn cả ngày', () => {
  const page = readFileSync('src/pages/attendance/AttendancePage.jsx', 'utf8');
  assert.match(page, /<MealChoiceSelect/);
  assert.doesNotMatch(page, /<Switch/);
});

test('sửa nhầm sau giờ chốt gửi đúng các bữa đã chọn', () => {
  const api = readFileSync('src/services/attendance/api/attendanceApi.js', 'utf8');
  assert.match(api, /meal-participation`, \{\s*date,\s*participates,\s*meals,?\s*\}/);
});
