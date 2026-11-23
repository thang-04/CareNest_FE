import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { unshownErrors } from '../../src/utils/children/examDraftErrors.js';

/*
 * G94-180 (mục 14): lưu nháp phiếu khám lỗi ⇒ lỗi ô hiện tại chỗ, lỗi không gắn ô của bước hiện khung đỏ đầu phiếu,
 * chuyển bước không lưu lặp khi lỗi cũ còn và dữ liệu chưa đổi.
 */
const src = readFileSync('src/pages/children/HealthExamFormPage.jsx', 'utf8');
const bodyOf = (start) => {
  const from = src.indexOf(start);
  assert.ok(from >= 0, `thiếu ${start}`);
  const next = src.indexOf('\n  const ', from + start.length);
  return src.slice(from, next < 0 ? undefined : next);
};

test('unshownErrors: giữ date, _form và ô của bước khác, bỏ ô của bước hiện tại', () => {
  const errors = { date: 'Ngày khám trùng', _form: 'Phiếu lỗi', heightCm: 'Sai chiều cao', 'exam.clinical.x': 'Sai khám' };
  assert.deepEqual(unshownErrors(errors, 1), ['Ngày khám trùng', 'Phiếu lỗi', 'Sai khám']);
  assert.deepEqual(unshownErrors({}, 0), []);
});

test('saveDraft lỗi gộp err.details vào errors, đặt _form khi không có ô, giữ toast câu BE', () => {
  const body = bodyOf('const saveDraft = async');
  assert.match(body, /catch \(err\) \{[\s\S]*setErrors\(/);
  assert.match(body, /err\.details/);
  assert.match(body, /_form/);
  assert.match(body, /toast\.error\(err, 'Chưa lưu được nháp'\)/);
  assert.match(body, /setSaveFailed\(true\)/);
});

test('khung alert--danger đầu phiếu liệt kê lỗi không thuộc ô của bước', () => {
  assert.match(src, /unshownErrors\(errors, step\)/);
  assert.match(src, /alert alert--danger/);
});

test('goTo không lưu lại khi lần lưu trước lỗi và dữ liệu chưa đổi; update() cho lưu lại', () => {
  assert.match(bodyOf('const goTo = async'), /if \(!saveFailed\) await saveDraft\(i\)/);
  assert.match(bodyOf('const update = (changes)'), /setSaveFailed\(false\)/);
});
