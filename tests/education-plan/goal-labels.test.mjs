import test from 'node:test';
import assert from 'node:assert/strict';
import { fillGoalLabels, goalDisplayLabel } from '../../src/models/education-plan/goalLabels.mjs';

const tree = () => [
  {
    name: 'A',
    rows: [
      { id: 'heading', kind: 'sub', text: 'Lĩnh vực' },
      { id: 'a', kind: 'goal', text: 'A', displayLabel: 'Mục tiêu 009', contents: [{ id: 'c', text: 'Nội dung', themes: ['t'] }] },
      { id: 'blank', kind: 'goal', text: '', contents: [] },
      { id: 'b', kind: 'goal', text: 'B', contents: [] },
    ],
  },
  {
    name: 'B',
    rows: [
      { id: 'c', kind: 'goal', text: 'C', contents: [] },
      { id: 'd', kind: 'goal', text: 'D', contents: [] },
    ],
  },
];

test('drag fill increments the last number, preserves padding, IDs, ticks and rows outside the range', () => {
  const before = tree();
  const after = fillGoalLabels(before, 'a', 'c', { a: 1, b: 2, c: 3, d: 4 });
  assert.equal(after[0].rows[1].displayLabel, 'Mục tiêu 009');
  assert.equal(after[0].rows[3].displayLabel, 'Mục tiêu 010');
  assert.equal(after[1].rows[0].displayLabel, 'Mục tiêu 011');
  assert.equal(after[0].rows[1].contents, before[0].rows[1].contents);
  assert.equal(after[0].rows[2], before[0].rows[2]);
  assert.equal(after[1].rows[1], before[1].rows[1]);
  assert.equal(before[0].rows[3].displayLabel, undefined);
  assert.equal(after[1].rows[0].id, 'c');
});

test('fill supports upward direction and legacy MT labels; nonnumeric labels are copied', () => {
  const before = tree();
  const reverse = fillGoalLabels(before, 'c', 'a', { a: 1, b: 2, c: 3 });
  assert.deepEqual(
    [reverse[0].rows[1].displayLabel, reverse[0].rows[3].displayLabel, reverse[1].rows[0].displayLabel],
    ['MT1', 'MT2', 'MT3'],
  );
  before[0].rows[1].displayLabel = 'Thể chất';
  assert.equal(fillGoalLabels(before, 'a', 'b', {})[0].rows[3].displayLabel, 'Thể chất');
  assert.equal(fillGoalLabels(before, 'a', 'a', {}), before);
  assert.equal(fillGoalLabels(before, 'missing', 'a', {}), before);
  assert.equal(goalDisplayLabel({ displayLabel: '  ' }, 2), 'MT2');
});

test('fill works from and onto goals that have a typed STT but no goal text yet', () => {
  const before = tree();
  before[0].rows[2] = { id: 'blank', kind: 'goal', text: '', displayLabel: '1', contents: [] };
  const after = fillGoalLabels(before, 'blank', 'c', { a: 1, b: 2, c: 3 });
  assert.deepEqual([after[0].rows[2].displayLabel, after[0].rows[3].displayLabel, after[1].rows[0].displayLabel], ['1', '2', '3']);
  assert.equal(after[0].rows[1].displayLabel, 'Mục tiêu 009');
});

test('fill rejects labels exceeding the persisted limit and increments large counters without precision loss', () => {
  const before = tree();
  before[0].rows[1].displayLabel = '9'.repeat(100);
  assert.throws(() => fillGoalLabels(before, 'a', 'b', {}), /100/);
  assert.equal(before[0].rows[3].displayLabel, undefined);
  before[0].rows[1].displayLabel = 'Mục 9007199254740993';
  assert.equal(fillGoalLabels(before, 'a', 'b', {})[0].rows[3].displayLabel, 'Mục 9007199254740994');
});

test('annual and TEAM exports use escaped custom labels, without changing goal numbers', async () => {
  const { yearPlanHtml } = await import('../../src/utils/education-plan/yearPlanDoc.js');
  const { DOMAINS } = await import('../../src/models/education-plan/educationPlanConstants.js');
  const domains = tree();
  domains[0].name = DOMAINS[0];
  domains[0].rows[1].displayLabel = 'Mục tiêu <01>';
  const plan = { schoolYear: '2098 – 2099', ageGroupId: 'ag-3', domains, themes: [], breaks: [] };
  for (const planLevel of ['SCHOOL_YEAR', 'TEAM']) {
    const html = yearPlanHtml({ ...plan, planLevel }, { a: 1, b: 2, c: 3, d: 4 });
    assert.match(html, /Mục tiêu &lt;01&gt;/);
    assert.doesNotMatch(html, /Mục tiêu <01>/);
  }
});

test('theme goal summary uses custom labels and falls back to MT for unlabeled goals', async () => {
  const { themeGoalLabel } = await import('../../src/models/education-plan/goalTable.js');
  const domains = tree();
  domains[0].rows[3].contents = [{ id: 'other-content', text: 'B', themes: ['t'] }];
  assert.equal(themeGoalLabel(domains, { a: 1, b: 2 }, { id: 't' }), 'Mục tiêu 009, MT2');
});
