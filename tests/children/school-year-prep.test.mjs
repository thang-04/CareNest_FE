import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultIntakeYearId,
  intakeYearOptions,
  lockedYearMessage,
  lockedYearOf,
  preparingYearOf,
} from '@/utils/schoolYearPrep';

/* Ngày mở chuẩn bị của năm học sắp diễn ra (BE G94-180, CFG-YR-05, CHD-11, CHD-12): hàm thuần xét năm khóa, năm tiếp nhận. */
const active = { id: '2026-2027', label: '2026 - 2027', status: 'ACTIVE', preparing: false, prepDate: '2026-07-15' };
const locked = { id: '2027-2028', label: '2027 - 2028', status: 'PLANNED', preparing: false, prepDate: '2027-08-01' };
const preparing = { ...locked, preparing: true };
const noPrepDate = { id: '2028-2029', label: '2028 - 2029', status: 'PLANNED', preparing: false, prepDate: null };

test('CHD-12: năm sau chưa tới ngày mở chuẩn bị là năm bị khóa', () => {
  const years = [active, locked];
  assert.equal(lockedYearOf(years, '2027-2028'), locked);
  assert.equal(preparingYearOf(years, '2027-2028'), null);
  assert.equal(lockedYearOf(years, '2026-2027'), null);
});

test('CHD-11: năm sau đang chuẩn bị mở tiếp nhận', () => {
  assert.deepEqual(intakeYearOptions([active, preparing]), [active, preparing]);
  assert.deepEqual(intakeYearOptions([active, locked]), [active]);
  assert.equal(preparingYearOf([active, preparing], '2027-2028'), preparing);
  assert.equal(lockedYearOf([active, preparing], '2027-2028'), null);
});

test('CHD-11: năm tiếp nhận mặc định theo header', () => {
  assert.equal(defaultIntakeYearId([active, preparing], '2027-2028'), '2027-2028');
  assert.equal(defaultIntakeYearId([active, preparing], '2026-2027'), '2026-2027');
  assert.equal(defaultIntakeYearId([active, locked], '2027-2028'), '2026-2027');
});

test('năm không có prepDate coi như chưa mở', () => {
  const years = [active, noPrepDate];
  assert.equal(lockedYearOf(years, '2028-2029'), noPrepDate);
  assert.deepEqual(intakeYearOptions(years), [active]);
  assert.equal(lockedYearMessage(noPrepDate), 'Năm học 2028 - 2029 chưa tới ngày mở chuẩn bị – chỉ xem.');
});

test('lockedYearMessage ghi ngày mở chuẩn bị dd/mm/yyyy', () => {
  assert.equal(lockedYearMessage(locked), 'Năm học 2027 - 2028 mở chuẩn bị từ 01/08/2027 – chỉ xem.');
});
