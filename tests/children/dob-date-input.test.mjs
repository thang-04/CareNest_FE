import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { tbContactDateError, validateChildInfo } from '@/utils/children/childrenValidation';
import { emptyChildInfo } from '@/utils/children/childrenHelpers';

// 1A (user chốt 2026-11-22): ngày sinh và ngày tiếp xúc lao nhập dd/mm/yyyy (DateInput) ở Tiếp nhận và Sửa hồ sơ.
const bornOn = (dateOfBirth) => ({ ...emptyChildInfo(), dateOfBirth });

test('ngày sinh: trống ⇒ chọn ngày; gõ chưa đủ hoặc ngày không có thật ⇒ báo dạng dd/mm/yyyy; ngày đúng ⇒ không lỗi', () => {
  assert.equal(validateChildInfo(bornOn('')).dateOfBirth, 'Chọn ngày sinh của trẻ');
  assert.equal(validateChildInfo(bornOn('10/03/20')).dateOfBirth, 'Nhập ngày sinh theo dạng dd/mm/yyyy');
  assert.equal(validateChildInfo(bornOn('31/02/2023')).dateOfBirth, 'Nhập ngày sinh theo dạng dd/mm/yyyy');
  assert.equal(validateChildInfo(bornOn('2023-03-10')).dateOfBirth, undefined);
});

test('ngày tiếp xúc lao: trống ⇒ chọn ngày; gõ sai dạng ⇒ báo dạng dd/mm/yyyy', () => {
  assert.equal(tbContactDateError(''), 'Chọn ngày tiếp xúc gần nhất');
  assert.equal(tbContactDateError('01/13/2026'), 'Nhập ngày tiếp xúc theo dạng dd/mm/yyyy');
});

test('ô ngày sinh và ô ngày tiếp xúc lao dùng DateInput, không dùng ô ngày của trình duyệt', () => {
  const info = readFileSync('src/components/children/ChildInfoFields.jsx', 'utf8');
  assert.match(info, /<DateInput[\s\S]{0,120}value=\{value\.dateOfBirth\}/);
  assert.doesNotMatch(info, /type="date"/);
  const declaration = readFileSync('src/components/children/HealthDeclarationFields.jsx', 'utf8');
  assert.match(declaration, /<DateInput/);
  assert.doesNotMatch(declaration, /type="date"/);
});
