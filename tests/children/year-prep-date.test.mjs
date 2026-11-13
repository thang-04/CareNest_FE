import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSchoolYear } from '@/utils/school-config/schoolConfigValidation';
import { defaultPrepDate } from '@/utils/school-config/yearSetup';

// BE CFG-YR-05: ô Ngày mở chuẩn bị ở form năm học báo lỗi ngay dưới ô
const previous = { id: 'y1', name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' };
const form = (prepDate) => ({ name: '2027-2028', startDate: '2027-09-05', endDate: '2028-05-31', prepDate });
const check = (prepDate, options = {}) => validateSchoolYear(form(prepDate), [previous], { today: '2027-07-01', ...options }).prepDate;

test('ngày mở chuẩn bị mặc định 1 tháng trước ngày bắt đầu, kẹp sau năm trước và không trước hôm nay', () => {
  assert.equal(defaultPrepDate('2027-09-05', [previous], '2027-07-01'), '2027-08-05');
  assert.equal(defaultPrepDate('2027-06-15', [previous], '2027-05-01'), '2027-06-01');
  assert.equal(defaultPrepDate('2027-09-05', [previous], '2027-08-20'), '2027-08-20');
});

test('ngày mở chuẩn bị: bắt buộc, đúng định dạng, trước ngày bắt đầu, sau năm trước, không trước hôm nay', () => {
  assert.equal(check(''), 'Chọn ngày mở chuẩn bị');
  assert.match(check('2027-13-40'), /dd\/mm\/yyyy/);
  assert.match(check('2027-09-05'), /trước ngày bắt đầu/);
  assert.match(check('2027-05-31'), /sau ngày kết thúc năm học 2026-2027/);
  assert.equal(check('2027-06-15'), 'Ngày mở chuẩn bị không được trước hôm nay');
  assert.equal(check('2027-08-05'), undefined);
});

test('ngày mở chuẩn bị đã lưu (đã qua) giữ nguyên được; năm đã bắt đầu không kiểm', () => {
  assert.equal(check('2027-06-15', { initialPrepDate: '2027-06-15' }), undefined);
  assert.equal(check('', { prepLocked: true }), undefined);
});
