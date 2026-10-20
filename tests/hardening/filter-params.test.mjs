import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeFilterKeys, readFilters, writeFilters } from '../../src/utils/filterParams.js';

const DEFAULTS = { status: 'ALL', keyword: '', campusId: '' };

test('URL thiếu key ⇒ dùng mặc định; có key ⇒ dùng giá trị trên URL', () => {
  assert.deepEqual(readFilters(new URLSearchParams(''), DEFAULTS), DEFAULTS);
  assert.deepEqual(readFilters(new URLSearchParams('status=SUBMITTED&keyword=bàn'), DEFAULTS), {
    status: 'SUBMITTED',
    keyword: 'bàn',
    campusId: '',
  });
});

test('chỉ ghi giá trị khác mặc định, giữ nguyên key khác (tab, id)', () => {
  const next = writeFilters(new URLSearchParams('tab=mine&status=SUBMITTED'), { status: 'ALL', keyword: 'ghế', campusId: '' }, DEFAULTS);
  assert.equal(next.get('tab'), 'mine');
  assert.equal(next.get('status'), null);
  assert.equal(next.get('keyword'), 'ghế');
  assert.equal(next.has('campusId'), false);
});

test('mặc định theo vai trò không bị khoá vào URL: về mặc định thì xoá key', () => {
  const principalDefaults = { ...DEFAULTS, status: 'SUBMITTED' };
  const cleared = writeFilters(new URLSearchParams('status=APPROVED'), { ...principalDefaults }, principalDefaults);
  assert.equal(cleared.toString(), '');
  // Hiệu trưởng chọn "Tất cả" (khác mặc định của vai trò) ⇒ phải ghi lên URL
  const all = writeFilters(new URLSearchParams(''), { ...principalDefaults, status: 'ALL' }, principalDefaults);
  assert.equal(all.get('status'), 'ALL');
});

test('đếm bộ lọc đang bật, có thể giới hạn nhóm key (vd. bộ lọc trong "Lọc thêm")', () => {
  const filters = { status: 'SUBMITTED', keyword: '', campusId: 'c1' };
  assert.deepEqual(activeFilterKeys(filters, DEFAULTS), ['status', 'campusId']);
  assert.deepEqual(activeFilterKeys(filters, DEFAULTS, ['campusId']), ['campusId']);
});
