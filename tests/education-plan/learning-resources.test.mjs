import test from 'node:test';
import assert from 'node:assert/strict';
import { activitySignature, matchDayActivities, resourceMatches, fileLimit } from '../../src/models/education-plan/learningResources.mjs';
import { themeActivities, teachingDayPicks, teachingDayUnlinked } from '../../src/models/education-plan/classPlan.js';

test('fingerprint preserves content and normalizes CRLF only', async () => {
  assert.equal(await activitySignature('A\r\nB'), await activitySignature('A\nB'));
  assert.notEqual(await activitySignature('A\nB'), await activitySignature('B\nA'));
});
test('day does not substitute positional ID after theme reorder', () => {
  const current = [
    { id: '1#0', goalId: '1', text: 'B' },
    { id: '1#1', goalId: '1', text: 'A' },
  ];
  const result = matchDayActivities(current, [{ id: '1#0', goalId: '1', text: 'A' }]);
  assert.equal(result[0].text, 'A');
  assert.equal(result[0].stale, true);
  assert.equal(resourceMatches({ active: true, activityKey: '1#0', activitySignature: 'sig' }, result[0], 'sig'), false);
  assert.equal(matchDayActivities(current, [current[1]])[0].stale, false);
});
test('resource needs both current key and full row signature', () => {
  assert.equal(resourceMatches({ active: true, activityKey: '1#0', activitySignature: 'old' }, { id: '1#0' }, 'new'), false);
  assert.equal(fileLimit('image/png'), 5 * 1024 * 1024);
  assert.equal(fileLimit('video/mp4'), 100 * 1024 * 1024);
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
  assert.deepEqual(matchDayActivities([], []), []);
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
