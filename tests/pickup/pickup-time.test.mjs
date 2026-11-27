import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const { validatePickupResult } = await import('@/utils/pickup/pickupValidation');

test('handover requires no client-entered time', () => {
  assert.deepEqual(validatePickupResult({verification:'PHONE_CONFIRMED',note:'Mẹ đồng ý'}), {});
  assert.deepEqual(validatePickupResult({verification:'PHOTO_MATCH',pickupPersonName:'Mẹ',pickupPersonRelation:'MOTHER'}), {});
});
test('photo and call flows send no editable handover time', () => {
  const source = readFileSync('src/components/pickup/PickupVerifyFlow.jsx', 'utf8');
  assert.doesNotMatch(source, /handoverTime|type="time"|Giờ trả trẻ/);
  const api = readFileSync('src/services/pickup/api/pickupApi.js', 'utf8');
  const recordResult = api.slice(api.indexOf('recordPickupResult:'), api.indexOf('correctHandoverTime:'));
  assert.doesNotMatch(recordResult, /handoverTime/);
});

test('both handover flows warn about the afternoon attendance cutoff from configuration', () => {
  const source = readFileSync('src/components/pickup/PickupVerifyFlow.jsx', 'utf8');
  assert.equal(source.match(/Trả trước \{fullDayPickupFrom\}: trẻ được tính vắng buổi chiều \(nửa ngày\)\./g)?.length, 2);
  const page = readFileSync('src/pages/pickup/PickupListPage.jsx', 'utf8');
  assert.match(page, /useCutoffSetting\(schoolYear\)/);
  assert.match(page, /setting\?\.fullDayPickupFrom \|\| '15:00'/);
  assert.equal(page.match(/fullDayPickupFrom=\{fullDayPickupFrom\}/g)?.length, 2);
});
