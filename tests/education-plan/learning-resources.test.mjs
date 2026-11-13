import test from 'node:test';
import assert from 'node:assert/strict';
import { resourcesOf, sectionKey } from '../../src/models/education-plan/learningResources.mjs';
import { themeActivities, teachingDayPicks, teachingDayUnlinked } from '../../src/models/education-plan/classPlan.js';

// BE:EDU-81 — học liệu theo ngày + mục của kế hoạch giáo dục ngày
test('resources are picked by day and section of the day plan', () => {
  assert.equal(sectionKey('2026-09-07', 'hoc'), '2026-09-07#hoc');
  const items = [
    { id: 1, active: true, activityKey: '2026-09-07#hoc' },
    { id: 2, active: true, activityKey: '2026-09-07#goc' },
    { id: 3, active: false, activityKey: '2026-09-07#hoc' },
    { id: 4, active: true, activityKey: '2026-09-08#hoc' },
  ];
  assert.deepEqual(
    resourcesOf(items, '2026-09-07', 'hoc').map((r) => r.id),
    [1],
  );
  assert.deepEqual(resourcesOf(items, '2026-09-09', 'hoc'), []);
});

test('heading/plus parser and day picks preserve existing activity IDs', () => {
  const activities = themeActivities([{ goals: [{ id: '9', no: 2 }] }], () => ({ activities: '- HĐ học:\n+ A\n+ B\n' }));
  assert.deepEqual(
    activities.map((a) => [a.id, a.text]),
    [
      ['9#0', 'HĐ học: A'],
      ['9#1', 'HĐ học: B'],
    ],
  );
  const doc = { picks: { 'hoc.0': [activities[0]], 'hoc.1': [activities[1]] } };
  assert.deepEqual(
    teachingDayPicks(doc, 0).map((a) => a.id),
    ['9#0'],
  );
  assert.deepEqual(teachingDayPicks(doc, 4), []);
});

test('legacy typed day content remains teachable without guessing goal or media', () => {
  const doc = {
    grid: {
      hoc: {
        allWeek: false,
        days: [
          { subject: 'Thể chất', topic: 'Đi thăng bằng' },
          { subject: 'Toán', topic: 'Đếm' },
        ],
      },
    },
    picks: {},
  };
  const day = teachingDayUnlinked(doc, 0);
  assert.equal(day.length, 1);
  assert.match(day[0].text, /Đi thăng bằng/);
  assert.equal(day[0].goalId, null);
  assert.equal(teachingDayUnlinked({ ...doc, picks: { 'hoc.0': [{ id: '9#0' }] } }, 0).length, 0);
});

test('Word NBSP and BOM preserve heading/child parser parity', () => {
  const blocks = [{ goals: [{ id: '9', no: 2 }] }];
  assert.equal(themeActivities(blocks, () => ({ activities: '- HĐ học:\u00a0' })).length, 0);
  assert.equal(themeActivities(blocks, () => ({ activities: '\u00a0+ A:' })).length, 1);
  assert.equal(themeActivities(blocks, () => ({ activities: '\ufeff+ A:' })).length, 1);
});

// Spec 901 — EDU-85: khóa xóa/đổi tên theo giáo án Chờ duyệt / đã ban hành chưa qua ngày dạy
test('deleteLock: REVIEW khóa không có ngày; APPROVED khóa tới hết ngày dạy muộn nhất; DRAFT và ngày đã qua không khóa', async () => {
  const { deleteLock, deletableText } = await import('../../src/models/education-plan/learningResources.mjs');
  const today = '2026-11-14';
  assert.deepEqual(deleteLock([], today), { locked: false, deletableFrom: null, reasons: [] });
  const past = { status: 'APPROVED', date: '2026-11-13' };
  const draft = { status: 'DRAFT', date: '2026-12-01' };
  assert.equal(deleteLock([past, draft], today).locked, false);
  const todayRow = { status: 'APPROVED', date: today };
  const later = { status: 'APPROVED', date: '2026-12-31' };
  const lock = deleteLock([past, todayRow, later], today);
  assert.equal(lock.locked, true);
  assert.equal(lock.deletableFrom, '2027-01-01');
  assert.deepEqual(lock.reasons, [todayRow, later]);
  const review = deleteLock([later, { status: 'REVIEW', date: '2026-10-01' }], today);
  assert.equal(review.locked, true);
  assert.equal(review.deletableFrom, null);
  assert.equal(deletableText('2027-01-01'), 'Xóa được từ 01/01/2027.');
  assert.equal(deletableText(null), 'Xóa được sau khi giáo án được duyệt hoặc trả lại.');
});

test('taughtThemeGroups: nhóm theo chủ đề + năm (tên chuẩn hóa), học liệu nhiều chủ đề ở mọi nhóm, "Chưa ghi chủ đề" cuối', async () => {
  const { taughtThemeGroups, NO_THEME } = await import('../../src/models/education-plan/learningResources.mjs');
  const a = { id: 1, taughtThemes: [{ name: 'Gia đình', schoolYearId: 'y1', schoolYearName: '2025-2026' }] };
  const b = {
    id: 2,
    taughtThemes: [
      { name: ' gia  đình ', schoolYearId: 'y1', schoolYearName: '2025-2026' },
      { name: 'Trường mầm non', schoolYearId: 'y2', schoolYearName: '2026-2027' },
    ],
  };
  const c = { id: 3, taughtThemes: [] };
  const groups = taughtThemeGroups([a, b, c]);
  assert.deepEqual(
    groups.map((g) => [g.name, g.schoolYearName, g.items.map((i) => i.id)]),
    [
      ['Trường mầm non', '2026-2027', [2]],
      ['Gia đình', '2025-2026', [1, 2]],
      [NO_THEME, null, [3]],
    ],
  );
});
