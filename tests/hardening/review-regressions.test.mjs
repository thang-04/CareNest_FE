import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = new EventTarget();
const { resetDb, readDb, writeDb } = await import('@/mocks/mockDatabase');
const { assessmentMockRepository: mock } = await import('@/services/assessment/mock/assessmentMockRepository');
const service = await import('@/services/assessment/assessmentService');
const { getMenuForRole } = await import('@/layouts/menuConfig');
const { ROLES } = await import('@/models/User');
const { csvCell } = await import('@/utils/exportCsv');
const { defaultUnlockUntil, parseUnlockUntil } = await import('@/utils/assessment/unlockTime');
const { REWARD_TITLES } = await import('@/models/assessment/assessmentConstants');
let cls, teacher, vp, principal, child, year;
test('fresh demo seed has unique child identities and preserves clinical sample', async () => {
  const { buildSeedDatabase } = await import('@/mocks/seed');
  const db = buildSeedDatabase();
  assert.equal(db.children.length, new Set(db.children.map((c) => c.id)).size);
  assert.equal(db.children.filter((c) => c.id === 'ch_037').length, 1);
});

test('existing duplicate demo rows are repaired without deleting unrelated records or losing conflict data', async () => {
  const { ensureSchoolSeeded } = await import('@/mocks/schoolMockRepository');
  const before = readDb().children.find((c) => c.id === 'ch_037');
  writeDb((db) => {
    db.children.push({ ...before, fullName: 'Conflicting demo entry' });
    db.reviewMarker = 'preserve';
  });
  ensureSchoolSeeded();
  const db = readDb();
  assert.equal(db.children.filter((c) => c.id === 'ch_037').length, 1);
  assert.equal(db.children.find((c) => c.id === 'ch_037').fullName, before.fullName);
  assert.equal(db.reviewMarker, 'preserve');
  assert.ok(db.demoIdentityConflicts.some((c) => c.row.fullName === 'Conflicting demo entry'));
  const count = db.demoIdentityConflicts.length;
  ensureSchoolSeeded();
  assert.equal(readDb().demoIdentityConflicts.length, count);
});

test('reward counts legacy tickets by class and school-year dates without requiring schoolYear field', async () => {
  writeDb((db) => {
    db.behaviourTickets = [
      { id: 't1', childId: child.id, classId: cls.id, type: 'WEEKLY', periodStart: '2026-10-05', periodEnd: '2026-10-09' },
      { id: 't2', childId: child.id, classId: cls.id, type: 'MONTHLY', periodStart: '2026-10-01', periodEnd: '2026-10-31' },
      { id: 't3', childId: child.id, classId: cls.id, type: 'WEEKLY', periodStart: '2025-10-05', periodEnd: '2025-10-09' },
      { id: 't4', childId: child.id, classId: 'outside', type: 'WEEKLY', periodStart: '2026-10-05', periodEnd: '2026-10-09' },
    ];
  });
  const detail = await service.getRewardList(cls.id, teacher);
  const row = detail.children.find((c) => c.childId === child.id);
  assert.equal(row.weeklyTickets, 1);
  assert.equal(row.monthlyTickets, 1);
});
beforeEach(async () => {
  resetDb();
  await mock.getCriteria();
  const db = readDb();
  year = db.schoolYears.find((y) => y.status === 'ACTIVE');
  cls = db.classes.find(
    (c) =>
      c.schoolYear === year.id &&
      c.ageGroupId === 'ag-5' &&
      c.teacherIds?.length &&
      db.children.some((ch) => ch.classId === c.id && ch.status === 'ACTIVE'),
  );
  assert.ok(cls);
  teacher = { id: cls.teacherIds[0], role: 'TEACHER', fullName: 'Teacher test' };
  vp = { id: 'vp-test', role: 'VICE_PRINCIPAL', campusId: cls.campusId, fullName: 'VP test' };
  principal = db.users.find((u) => u.role === 'PRINCIPAL');
  child = db.children.find((ch) => ch.classId === cls.id && ch.status === 'ACTIVE');
  writeDb((d) => {
    d.yearEndEvaluations = [
      {
        id: 'ye-test',
        childId: child.id,
        classId: cls.id,
        schoolYear: year.id,
        status: 'CONFIRMED',
        finalContent: 'Teacher confirmed test',
        confirmedAt: new Date().toISOString(),
        programCompleted: true,
      },
    ];
  });
});

test('mock reward facade completes teacher → VP → principal and preserves history', async () => {
  const lists = await service.getRewardLists({ schoolYear: year.id }, teacher);
  assert.ok(lists.length);
  const detail = await service.getRewardList(cls.id, teacher);
  assert.equal(detail.canEdit, true);
  const saved = await service.saveRewardList(
    cls.id,
    [{ childId: child.id, titles: [REWARD_TITLES[0]], note: '' }],
    { submit: true },
    teacher,
  );
  assert.equal(saved.status, 'PENDING_VP');
  assert.equal((await service.getRewardList(cls.id, vp)).canReview, true);
  await assert.rejects(service.reviewRewardList(saved.listId, { decision: 'FORWARD' }, { ...vp, campusId: 'outside' }), { status: 403 });
  await service.reviewRewardList(saved.listId, { decision: 'FORWARD' }, vp);
  const approved = await service.decideRewardList(saved.listId, { decision: 'APPROVE' }, principal);
  assert.equal(approved.status, 'APPROVED');
  assert.deepEqual(
    approved.history.map((e) => e.action),
    ['SUBMITTED', 'FORWARDED', 'APPROVED'],
  );
  assert.equal(approved.canEdit, false);
  assert.equal(approved.children.find((c) => c.childId === child.id).titles[0], REWARD_TITLES[0]);
});

test('reward draft is private, rejects invalid children/titles and requires confirmed evaluation', async () => {
  const items = [{ childId: child.id, titles: [REWARD_TITLES[1]] }];
  await service.saveRewardList(cls.id, items, {}, teacher);
  const vpDetail = await service.getRewardList(cls.id, vp);
  assert.ok(vpDetail.children.every((c) => c.titles.length === 0));
  await assert.rejects(service.saveRewardList(cls.id, [{ childId: 'outside', titles: [REWARD_TITLES[0]] }], {}, teacher), { status: 422 });
  await assert.rejects(service.saveRewardList(cls.id, [{ childId: child.id, titles: ['invalid'] }], {}, teacher), { status: 422 });
  writeDb((d) => {
    d.yearEndEvaluations[0].status = 'AWAITING_REVIEW';
  });
  await assert.rejects(service.saveRewardList(cls.id, items, { submit: true }, teacher), { status: 422 });
});

test('mock quality report: leaders all campuses, teacher own classes without totals; HTCT leaders only', async () => {
  for (const user of [vp, principal]) {
    const q = await service.getQualityReport({ schoolYear: year.id }, user);
    assert.ok(q.rows.length);
    assert.ok(q.totals.length);
    assert.ok(q.rows.every((r) => Number.isFinite(r.attendanceRate)));
    const p = await service.getProgramCompletion({ schoolYear: year.id }, user);
    assert.equal(p.totals.completed, 1);
    assert.ok(p.totals.children >= 1);
  }
  // AUTH-20 (Cần chốt 03/11/2026): PHT xem báo cáo mọi điểm trường như HT
  const vpView = await service.getQualityReport({ schoolYear: year.id }, vp);
  const htView = await service.getQualityReport({ schoolYear: year.id }, principal);
  assert.equal(vpView.rows.length, htView.rows.length);
  // GV xem lớp mình (Cần chốt 03/11/2026), không có dòng tổng; HTCT vẫn chỉ BGH
  const own = await service.getQualityReport({ schoolYear: year.id }, teacher);
  assert.ok(own.rows.length <= htView.rows.length);
  assert.deepEqual(own.totals, []);
  await assert.rejects(service.getProgramCompletion({ schoolYear: year.id }, teacher), { status: 403 });
});

test('CSV guards formula prefixes and control characters, preserves numeric/quoted Vietnamese data', () => {
  for (const input of ['=1+2', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =cmd', '\ttext', '\rtext', '\ntext']) {
    assert.ok(csvCell(input).replace(/^"/, '').startsWith("'"), JSON.stringify(input));
  }
  assert.equal(csvCell(-12), '-12');
  assert.equal(csvCell('Nguyễn An'), 'Nguyễn An');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell(null), '');
});

test('unlock default and request use school time across device time zones and midnight/year-end', () => {
  const old = process.env.TZ;
  try {
    for (const tz of ['UTC', 'Asia/Bangkok', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      const until = defaultUnlockUntil(undefined, Date.parse('2026-11-02T16:30:00Z'));
      assert.deepEqual(until, { untilDate: '2026-11-03', untilTime: '00:30' });
      assert.equal(parseUnlockUntil(until.untilDate, until.untilTime).toISOString(), '2026-11-02T17:30:00.000Z');
      assert.deepEqual(defaultUnlockUntil('2026-11-02', Date.parse('2026-11-02T16:30:00Z')), {
        untilDate: '2026-11-02',
        untilTime: '23:59',
      });
    }
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});

test('retired facility routes/pages have no entry points for any role; school rooms and kitchen remain', () => {
  const flatten = (entries) => entries.flatMap((e) => [e, ...flatten(e.children || [])]);
  for (const role of Object.values(ROLES)) {
    assert.ok(
      flatten(getMenuForRole(role, { role, campusId: 'c1' })).every(
        (e) => !e.to?.startsWith('/facility') && !e.to?.startsWith('/inventory-inspection'),
      ),
    );
  }
  const src = new URL('../../src/', import.meta.url);
  assert.equal(existsSync(new URL('pages/facility', src)), false);
  assert.equal(existsSync(new URL('pages/assessment/RewardProposalFormPage.jsx', src)), false);
  assert.ok(existsSync(new URL('pages/school-config/RoomListPage.jsx', src)));
  assert.ok(existsSync(new URL('pages/kitchen/KitchenFlowPage.jsx', src)));
  assert.doesNotMatch(readFileSync(new URL('routes/AppRoutes.jsx', src), 'utf8'), /facility|inventory-inspection/i);
  assert.doesNotMatch(readFileSync(new URL('services/school-config/schoolConfigService.js', src), 'utf8'), /localStorage|vpAreas/);
  assert.ok(Array.isArray(readDb().notifications));
});
