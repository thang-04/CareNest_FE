import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterOverdue, overdueRows } from '../../src/models/education-plan/overdue.mjs';
import { deadlineLabel } from '../../src/models/education-plan/deadline.mjs';
import { publishedBranchCalendar } from '../../src/models/education-plan/branchCalendar.mjs';

test('EDU-73: lịch chỉ xem lấy lịch và mốc tuần từ gói ban hành, bỏ lịch đang chờ', () => {
  const plan = { themes: [{ id: 'one', name: 'Một', start: '2026-09-07', end: '2026-09-11' }], breaks: [] };
  const snapshot = {
    status: 'APPROVED', themeIds: ['one'], branchNames: { '2026-09-07': 'Tên khi ban hành' },
    effectiveCalendar: {
      themeSchedules: [{ themeId: 'one', startDate: '2026-09-07', endDate: '2026-09-11' }],
      branches: [{ themeId: 'one', key: 'released', name: 'Tên khi ban hành', startDate: '2026-09-07', endDate: '2026-09-11' }],
    },
  };
  const review = { status: 'REVIEW', themeIds: ['two'], branchNames: { '2026-10-05': 'Tên nháp' } };
  const projected = publishedBranchCalendar(plan, [snapshot, review]);
  assert.deepEqual([...projected.themeIds], ['one']);
  assert.deepEqual(projected.names, { '2026-09-07': 'Tên khi ban hành' });
  assert.equal(projected.branches[0].endDate, '2026-09-11');
});

// Spec 005 FR-021a: màn Kế hoạch quá hạn chỉ dựa vào cờ BE trả (canExtend, timeLock.canUnlock)
const classes = [
  { id: 'c1', name: 'Mầm 1', ageGroupId: 'A3' },
  { id: 'c2', name: 'Chồi 1', ageGroupId: 'A4' },
];
const rows = overdueRows({
  today: '2026-11-20',
  classes,
  themeNameOf: (d) => `Chủ đề ${d.themeId}`,
  semesterPackages: [
    { id: 'sp1', classId: 'c1', semesterNo: 1, status: 'DRAFT', canExtend: true, deadline: '2026-09-07', daysLeft: -74, themeIds: ['t1'] },
    { id: 'sp2', classId: 'c2', semesterNo: 1, status: 'APPROVED', canExtend: false, deadline: '2026-09-07' },
  ],
  themeDossiers: [
    { id: 'ds1', classId: 'c1', themeId: 't1', status: 'REJECTED', canExtend: true, deadline: '2026-11-16', daysLeft: -4 },
    {
      id: 'ds2',
      classId: 'c2',
      themeId: 't2',
      status: 'DRAFT',
      canExtend: false,
      deadline: '2026-11-02',
      history: [{ action: 'extend', deadline: '2026-11-30', by: 'Hiệu trưởng A', note: 'Ốm', at: '2026-11-18T08:00:00Z' }],
    },
  ],
  yearPlans: [
    {
      id: 'y1',
      planLevel: 'TEAM',
      ageGroupId: 'A4',
      title: 'Kế hoạch tổ Chồi',
      status: 'DRAFT',
      timeLock: { deadline: '2026-09-01', canUnlock: true },
    },
    {
      id: 'y2',
      planLevel: 'SCHOOL_YEAR',
      ageGroupId: 'A3',
      title: 'Năm học',
      status: 'APPROVED',
      timeLock: { deadline: '2026-09-01', timeLocked: true, canUnlock: false },
    },
  ],
});

test('Đang quá hạn: chỉ bản chưa ban hành mà BE cho mở; bản đã ban hành bị khóa cứng không có', () => {
  assert.deepEqual(
    filterOverdue(rows, { tab: 'overdue' })
      .map((r) => r.key)
      .sort(),
    ['dossier-ds1', 'plan-y1', 'semester-sp1'],
  );
  assert.ok(!filterOverdue(rows, { tab: 'overdue' }).some((r) => r.status === 'APPROVED'));
});

test('Đã mở hạn: lấy sự kiện mở hạn cuối (hạn mới, người mở, lý do)', () => {
  const [r] = filterOverdue(rows, { tab: 'extended' });
  assert.equal(r.key, 'dossier-ds2');
  assert.deepEqual(r.extension, { deadline: '2026-11-30', by: 'Hiệu trưởng A', note: 'Ốm', at: '2026-11-18T08:00:00Z' });
});

test('FR-022: lọc nhóm tuổi rồi lớp, loại, học kỳ', () => {
  assert.deepEqual(
    filterOverdue(rows, { ageGroupId: 'A4' }).map((r) => r.key),
    ['plan-y1'],
  );
  assert.deepEqual(
    filterOverdue(rows, { ageGroupId: 'A3', classId: 'c1', kind: 'dossier' }).map((r) => r.key),
    ['dossier-ds1'],
  );
  assert.deepEqual(
    filterOverdue(rows, { semesterNo: 1 })
      .map((r) => r.key)
      .sort(),
    ['dossier-ds1', 'semester-sp1'],
  );
  assert.equal(rows.find((r) => r.key === 'dossier-ds1').daysOverdue, 4);
  assert.equal(rows.find((r) => r.key === 'plan-y1').className, '—');
});

test('FR-020: nhãn hạn luôn có tiền tố "Hạn:" để tách khỏi trạng thái duyệt', () => {
  for (const s of ['NEAR', 'OVERDUE', 'ON_TIME', 'NORMAL'])
    assert.match(deadlineLabel({ deadline: '2026-11-16', daysLeft: 1, deadlineState: s }).label, /^Hạn: /);
});

test('EDU-109 (9): một hạn hiệu lực, loại gửi/duyệt suy từ trạng thái, một thao tác mở hạn', () => {
  const eligible = overdueRows({
    today: '2026-11-20',
    themeDossiers: [
      { id: 'send', status: 'DRAFT', canExtend: true, deadline: '2026-11-10' },
      { id: 'review', status: 'REVIEW', canExtend: true, deadline: '2026-11-01', extendedTo: '2026-11-18' },
      { id: 'denied', status: 'REVIEW', canExtend: false },
      {
        id: 'reopened',
        status: 'REVIEW',
        extendedTo: '2026-11-25',
        history: [{ action: 'reopen_review_deadline', deadline: '2026-11-25', note: 'Bổ sung thời gian' }],
      },
    ],
    yearPlans: [{ id: 'y1', status: 'REVIEW', title: 'Năm', timeLock: { canUnlock: true, deadline: '2026-09-01' } }],
  });
  assert.deepEqual(filterOverdue(eligible).map((r) => r.key), ['plan-y1', 'dossier-send', 'dossier-review']);
  assert.deepEqual(filterOverdue(eligible, { deadlineKind: 'send' }).map((r) => r.docKey), ['send']);
  assert.deepEqual(filterOverdue(eligible, { deadlineKind: 'review' }).map((r) => r.key), ['plan-y1', 'dossier-review']);
  assert.equal(eligible.find((r) => r.docKey === 'review').deadline, '2026-11-18', 'hạn hiệu lực = extendedTo ?? deadline');
  assert.deepEqual(
    filterOverdue(eligible, { tab: 'extended', deadlineKind: 'review' }).map((r) => r.extension.deadline),
    ['2026-11-18', '2026-11-25'],
  );
});

test('EDU-109 (9): màn quá hạn chỉ gọi extend / unlock, không còn mở hạn duyệt riêng', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../src/pages/education-plan/OverduePlansPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /reopen_review_deadline|reopenGoalReviewDeadline|Mở lại hạn duyệt/);
  assert.match(src, /action: 'extend'/);
});
