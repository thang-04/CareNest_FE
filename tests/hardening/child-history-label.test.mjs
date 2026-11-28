import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { childHistoryLabel } from '../../src/utils/childHistory.js';
import { getGeneralSaveEntries } from '../../src/utils/assessment/dailyGeneralDraft.js';

test('history labels distinguish transfer and leaving without guessing missing state', () => {
  assert.equal(childHistoryLabel('TRANSFERRED'), 'Đã chuyển lớp');
  assert.equal(childHistoryLabel('LEFT_SCHOOL'), 'Đã nghỉ học');
  assert.equal(childHistoryLabel(null), '');
});
test('general assessment saves current children only in a mixed historical roster', () => {
  const rows = [
    { childId: 1, generalRecorded: false },
    { childId: 2, historyStatus: 'TRANSFERRED' },
    { childId: 3, historyStatus: 'LEFT_SCHOOL' },
  ];
  const saved = getGeneralSaveEntries(rows, [], { 1: { comment: '' } }, new Set([2, 3]));
  assert.deepEqual(
    saved.map((r) => r.childId),
    [1],
  );
});

test('development and leave-history screens render the specific history label', () => {
  const developmentList = readFileSync(new URL('../../src/pages/assessment/ChildDevelopmentListPage.jsx', import.meta.url), 'utf8');
  const leaveRequests = readFileSync(new URL('../../src/pages/attendance/LeaveRequestsPage.jsx', import.meta.url), 'utf8');

  assert.match(developmentList, /childHistoryLabel\(ch\.historyStatus\)/);
  assert.doesNotMatch(developmentList, /<div className="muted">Đã chuyển lớp \/ nghỉ<\/div>/);
  assert.match(leaveRequests, /childNameWithHistory\(r\.childName, r\.historyStatus\)/);
});
