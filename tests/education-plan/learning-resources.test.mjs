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
