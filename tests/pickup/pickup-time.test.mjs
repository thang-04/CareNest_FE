import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
const { pickupTimeError } = await import('@/utils/pickup/pickupValidation');

test('pickup rejects times after now and accepts the current minute', () => {
  assert.equal(pickupTimeError('16:31', '16:30'), 'Giờ trả trẻ không được sau giờ hiện tại.');
  assert.equal(pickupTimeError('16:30', '16:30'), null);
  assert.equal(pickupTimeError('08:15', '16:30'), null);
  assert.equal(pickupTimeError('', '16:30'), 'Nhập giờ trả trẻ (HH:mm).');
});
test('both photo and call pickup check the chosen time before sending', () => {
  const source = readFileSync('src/components/pickup/PickupVerifyFlow.jsx', 'utf8');
  assert.match(source, /pickupTimeError\(payload.handoverTime, nowTime\(\)\)/);
  assert.match(source, /pickupTimeError\(handoverTime, nowTime\(\)\)/);
  assert.match(source, /const \[handoverTime, setHandoverTime\] = useState\(nowTime\)/);
  assert.match(source, /<TextField[\s\S]*?type="time"[\s\S]*?value=\{handoverTime\}/);
});
test('both handover flows warn about the afternoon attendance cutoff from configuration', () => {
  const source = readFileSync('src/components/pickup/PickupVerifyFlow.jsx', 'utf8');
  assert.equal(source.match(/Trả trước \{fullDayPickupFrom\}: trẻ được tính vắng buổi chiều \(nửa ngày\)\./g)?.length, 2);
  const page = readFileSync('src/pages/pickup/PickupListPage.jsx', 'utf8');
  assert.match(page, /useCutoffSetting\(schoolYear\)/);
  assert.match(page, /setting\?\.fullDayPickupFrom \|\| '15:00'/);
  assert.equal(page.match(/fullDayPickupFrom=\{fullDayPickupFrom\}/g)?.length, 2);
});
