import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateChildInfo } from '@/utils/children/childrenValidation';
import { emptyChildInfo } from '@/utils/children/childrenHelpers';

// G94-433 / G94-180/CHD-13 (nghiệp vụ chốt 2026-11-22): chỉ tiếp nhận trẻ đủ 3 tháng tuổi tại ngày tiếp nhận; Sửa hồ sơ không kiểm.
const MESSAGE = 'Trẻ phải đủ 3 tháng tuổi tại ngày tiếp nhận';
const bornOn = (dateOfBirth) => ({ ...emptyChildInfo(), dateOfBirth });

test('tiếp nhận: chưa đủ 3 tháng ⇒ lỗi ngày sinh; vừa đủ 3 tháng ⇒ không lỗi', () => {
  assert.equal(validateChildInfo(bornOn('2026-08-23'), { intakeDate: '2026-11-22' }).dateOfBirth, MESSAGE);
  assert.equal(validateChildInfo(bornOn('2026-08-22'), { intakeDate: '2026-11-22' }).dateOfBirth, undefined);
  // Cuối tháng: 31/08 + 3 tháng = 30/11 (như LocalDate.plusMonths của BE)
  assert.equal(validateChildInfo(bornOn('2026-08-31'), { intakeDate: '2026-11-30' }).dateOfBirth, undefined);
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
