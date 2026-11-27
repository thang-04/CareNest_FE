import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateChildInfo } from '@/utils/children/childrenValidation';
import { emptyChildInfo } from '@/utils/children/childrenHelpers';

// G94-433 / G94-180/CHD-13 (nghiệp vụ chốt 2026-11-22): chỉ tiếp nhận trẻ đủ 3 tháng tuổi tại ngày tiếp nhận; Sửa hồ sơ không kiểm.
const MESSAGE = 'Chỉ tiếp nhận trẻ từ đủ 3 tháng đến 6 tuổi (không quá 72 tháng tròn) tại ngày tiếp nhận';
const bornOn = (dateOfBirth) => ({ ...emptyChildInfo(), dateOfBirth });

test('tiếp nhận: chưa đủ 3 tháng ⇒ lỗi ngày sinh; vừa đủ 3 tháng ⇒ không lỗi', () => {
  assert.equal(validateChildInfo(bornOn('2026-08-23'), { intakeDate: '2026-11-22' }).dateOfBirth, MESSAGE);
  assert.equal(validateChildInfo(bornOn('2026-08-22'), { intakeDate: '2026-11-22' }).dateOfBirth, undefined);
  // Ngày sinh chưa tới trong tháng hiện tại thì chưa đủ số tháng tròn.
  assert.equal(validateChildInfo(bornOn('2026-08-31'), { intakeDate: '2026-11-30' }).dateOfBirth, MESSAGE);
});

test('Sửa hồ sơ (không truyền ngày tiếp nhận) ⇒ không kiểm tuổi tối thiểu', () => {
  assert.notEqual(validateChildInfo(bornOn('2026-08-23'), { requireRecipient: false }).dateOfBirth, MESSAGE);
});

test('màn tiếp nhận và BE giả kiểm tuổi tối thiểu theo hôm nay', () => {
  assert.match(
    readFileSync('src/pages/children/EnrollChildPage.jsx', 'utf8'),
    /validateChildInfo\(value, \{ intakeDate: todayInput\(\), requirePhotos: true \}\)/,
  );
  assert.match(
    readFileSync('src/services/children/mock/childrenMockRepository.js', 'utf8'),
    /validateChildInfo\(child, \{ intakeDate: todayInput\(\) \}\)/,
  );
});

test('intake accepts 72 completed months and rejects 73; editing has no age limit', () => {
  for (const birth of ['2020-11-22', '2020-10-23']) assert.equal(validateChildInfo(bornOn(birth), {intakeDate:'2026-11-22'}).dateOfBirth, undefined);
  assert.equal(validateChildInfo(bornOn('2020-10-22'), {intakeDate:'2026-11-22'}).dateOfBirth, MESSAGE);
  assert.equal(validateChildInfo(bornOn('2017-12-31'), {requireRecipient:false}).dateOfBirth, undefined);
});

test('month-end intake counts completed months', () => {
  assert.equal(validateChildInfo(bornOn('2020-01-31'), {intakeDate:'2026-02-28'}).dateOfBirth, undefined);
  assert.equal(validateChildInfo(bornOn('2025-11-30'), {intakeDate:'2026-02-28'}).dateOfBirth, MESSAGE);
});
