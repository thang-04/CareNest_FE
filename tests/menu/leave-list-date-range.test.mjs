import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const { leaveDefaultRange } = await import('@/utils/attendance/leaveRange');

const year = { startDate: '2026-09-05', endDate: '2027-05-31' };

test('current year shows leaves from this month to the end of the school year', () => {
  assert.deepEqual(leaveDefaultRange('2026-11-28', year), { from: '2026-11-01', to: '2027-05-31' });
});

test('past year shows its last month, planned year shows the whole year', () => {
  assert.deepEqual(leaveDefaultRange('2027-08-10', year), { from: '2027-05-01', to: '2027-05-31' });
  assert.deepEqual(leaveDefaultRange('2026-08-10', year), { from: '2026-09-05', to: '2027-05-31' });
});

test('unknown school year falls back to the current month', () => {
  assert.deepEqual(leaveDefaultRange('2026-11-28', undefined), { from: '2026-11-01', to: '2026-11-30' });
});

const page = readFileSync(new URL('../../src/pages/attendance/LeaveRequestsPage.jsx', import.meta.url), 'utf8');

test('leave list shows the start and end date in separate columns', () => {
  assert.match(page, /<th className="center">Từ ngày<\/th>\s*<th className="center">Đến ngày<\/th>/);
});

test('one date field does not block choosing a range outside the current one', () => {
  assert.doesNotMatch(page, /<DateInput[^>]*?\b(min|max)=/s);
});
