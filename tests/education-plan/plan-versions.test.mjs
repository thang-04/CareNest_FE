import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addedGoalIds,
  checkFlag,
  copyDocToVersion,
  currentPlanOf,
  danglingRows,
  diffPlans,
  dropReference,
  previousPlanOf,
  remapCriteriaToPlan,
  unresolvedFlags,
  versionFlags,
  weekDocId,
} from '../../src/models/education-plan/planVersions.mjs';

const NAME = 'Phát triển thể chất';
const goal = (id, text, contents, lineageId) => ({ id, kind: 'goal', text, contents, ...(lineageId ? { lineageId } : {}) });
const content = (id, text, themes, lineageId) => ({ id, text, themes, ...(lineageId ? { lineageId } : {}) });

const v1 = {
  id: '1',
  versionNo: 1,
  status: 'APPROVED',
  ageGroupId: 'ag-3',
  schoolYear: '2026 – 2027',
  themes: [
    { id: 't1', name: 'Trường', abbr: 'TMN', start: '2026-09-07', end: '2026-09-25' },
    { id: 't2', name: 'Gia đình', abbr: 'GĐ', start: '2026-11-02', end: '2026-11-13' },
  ],
  breaks: [],
  domains: [
    {
      name: NAME,
      rows: [
        goal('g1', 'Trẻ chạy', [content('c1', 'Chạy chậm', ['t1', 't2'])]),
        goal('g2', 'Trẻ nhảy', [content('c2', 'Bật xa', ['t2'])]),
        goal('g3', 'Trẻ hát', [content('c3', 'Hát', ['t2'])]),
      ],
    },
  ],
};

// v2: thêm MT mới đầu tiên, đổi câu MT g2, bỏ MT g3, đổi tên chủ đề 2
const v2 = {
  ...v1,
  id: '2',
  versionNo: 2,
  themes: [
    { id: 't11', lineageId: 't1', name: 'Trường', abbr: 'TMN', start: '2026-09-07', end: '2026-09-25' },
    { id: 't12', lineageId: 't2', name: 'Gia đình bé', abbr: 'GĐ', start: '2026-11-02', end: '2026-11-13' },
  ],
  domains: [
    {
      name: NAME,
      rows: [
        goal('g10', 'Trẻ đi', [content('c10', 'Đi thăng bằng', ['t12'])]),
        goal('g11', 'Trẻ chạy', [content('c11', 'Chạy chậm', ['t11', 't12'], 'c1')], 'g1'),
        goal('g12', 'Trẻ nhảy xa', [content('c12', 'Bật xa', ['t12'], 'c2')], 'g2'),
      ],
    },
  ],
};

const TODAY = '2026-10-28';

test('phiên bản hiện hành = bản ban hành số lớn nhất; phiên bản trước để chép', () => {
  const draft3 = { ...v2, id: '3', versionNo: 3, status: 'DRAFT' };
  const goals = [v1, v2, draft3];
  assert.equal(currentPlanOf(goals, 'ag-3', '2026 – 2027').id, '2');
  assert.equal(previousPlanOf(goals, v2).id, '1');
  assert.equal(currentPlanOf([v1, { ...v2, status: 'PENDING_VP' }], 'ag-3', '2026 – 2027').id, '1');
  assert.equal(weekDocId('5', '2026-11-02', v1), 'wp_5_2026-11-02');
  assert.equal(weekDocId('5', '2026-11-02', v2), 'wp_5_2026-11-02_2');
});

test('so sánh theo lineage: đánh số lại không đổi; đổi câu, bỏ, thêm, đổi chủ đề phân loại đúng', () => {
  const changes = diffPlans(v1, v2);
  const g = Object.fromEntries(changes.goals.map((x) => [x.lineageId, x]));
  assert.equal(g.g10.change, 'ADDED');
  assert.equal(g.g1.change, 'UNCHANGED');
  assert.equal(g.g1.goalNo, 2);
  assert.equal(g.g1.fromGoalNo, 1);
  assert.equal(g.g2.change, 'CHANGED');
  assert.deepEqual(g.g2.fields, ['text']);
  assert.equal(g.g3.change, 'REMOVED');
  const t = Object.fromEntries(changes.themes.map((x) => [x.lineageId, x]));
  assert.equal(t.t1.change, 'UNCHANGED');
  assert.deepEqual(t.t2.fields, ['name']);
  assert.deepEqual([...addedGoalIds(changes)], ['g10']);
});

test('chép kế hoạch chủ đề: đổi id theo lineage, giữ MT bị bỏ để hiện đỏ; Đã kiểm tra / Bỏ làm hết đỏ', () => {
  const changes = diffPlans(v1, v2);
  const source = {
    id: 'tp_5_t2',
    kind: 'theme',
    classId: '5',
    yearPlanId: '1',
    themeId: 't2',
    status: 'APPROVED',
    approvals: [{ name: 'PHT' }],
    history: [{ action: 'Duyệt' }],
    rows: { g1: { activities: 'Trò chuyện: chạy' }, g2: { activities: 'HĐ học: bật' }, g3: { activities: 'Âm nhạc: hát' } },
  };
  const copy = copyDocToVersion('theme', source, changes, v2);
  assert.equal(copy.id, 'tp_5_t12');
  assert.equal(copy.yearPlanId, '2');
  assert.equal(copy.status, 'DRAFT');
  assert.deepEqual(copy.approvals, []);
  assert.equal(copy.sourceDocKey, 'tp_5_t2');
  assert.deepEqual(Object.keys(copy.rows).sort(), ['g11', 'g12', 'g3']);
  assert.equal(source.rows.g1.activities, 'Trò chuyện: chạy');
  assert.deepEqual(Object.keys(danglingRows(copy, v2)), ['g3']);

  const flags = versionFlags('theme', copy, changes, v2, TODAY);
  assert.deepEqual(flags.map((f) => [f.ref, f.type]).sort(), [
    ['goal:g12', 'changed'],
    ['goal:g3', 'removed'],
  ]);
  let fixed = checkFlag(
    copy,
    flags.find((f) => f.type === 'changed'),
  );
  fixed = dropReference(
    'theme',
    fixed,
    flags.find((f) => f.type === 'removed'),
  );
  assert.equal(unresolvedFlags(versionFlags('theme', fixed, changes, v2, TODAY), fixed).length, 0);
});

test('giáo án tuần: ô có hoạt động gắn MT đổi/bị bỏ đỏ; chủ đề đã kết thúc không đỏ', () => {
  const changes = diffPlans(v1, v2);
  const source = {
    id: 'wp_5_2026-11-02',
    kind: 'week',
    classId: '5',
    yearPlanId: '1',
    themeId: 't2',
    weekStart: '2026-11-02',
    days: [0, 1, 2, 3, 4].map(() => ({ date: '' })),
    picks: {
      'hoc.0': [{ id: 'g2#0', goalId: 'g2', goalNo: 2, text: 'HĐ học: bật' }],
      'hoc.1': [{ id: 'g3#0', goalId: 'g3', goalNo: 3, text: 'Âm nhạc: hát' }],
      'don.all': [{ id: 'g1#0', goalId: 'g1', goalNo: 1, text: 'Đón trẻ: chạy' }],
    },
  };
  const copy = copyDocToVersion('week', source, changes, v2, { weekStart: '2026-11-09', weekNo: 4, themeId: 't12' });
  assert.equal(copy.id, 'wp_5_2026-11-09_2');
  assert.equal(copy.days[4].date, '2026-11-13');
  assert.deepEqual(copy.picks['hoc.0'][0], { id: 'g12#0', goalId: 'g12', goalNo: 3, text: 'HĐ học: bật' });
  assert.equal(copy.picks['don.all'][0].goalNo, 2);
  const flags = versionFlags('week', copy, changes, v2, TODAY);
  assert.deepEqual(flags.map((f) => [f.ref, f.cells]).sort(), [
    ['goal:g12', ['hoc.0']],
    ['goal:g3', ['hoc.1']],
  ]);
  const cleaned = dropReference(
    'week',
    copy,
    flags.find((f) => f.type === 'removed'),
  );
  assert.equal(cleaned.picks['hoc.1'].length, 0);

  const past = { ...copy, themeId: 't11' };
  assert.deepEqual(versionFlags('week', past, changes, v2, TODAY), []);
});

test('chủ đề nhánh: chủ đề đổi cần kiểm tra; tuần không còn trong lịch thì đỏ tới khi bỏ', () => {
  const moved = { ...v2, themes: [v2.themes[0], { ...v2.themes[1], start: '2026-11-09', end: '2026-11-20' }] };
  const changes = diffPlans(v1, moved);
  const copy = copyDocToVersion(
    'branch',
    { id: 'bp_5_1', kind: 'branch', classId: '5', yearPlanId: '1', names: { '2026-09-07': 'A', '2026-11-02': 'B' }, notes: {} },
    changes,
    moved,
  );
  assert.equal(copy.id, 'bp_5_2');
  const flags = versionFlags('branch', copy, changes, moved, TODAY);
  assert.deepEqual(flags.map((f) => f.ref).sort(), ['theme:t12', 'week:2026-11-02']);
  const fixed = dropReference(
    'branch',
    checkFlag(
      copy,
      flags.find((f) => f.type === 'changed'),
    ),
    flags.find((f) => f.type === 'removed'),
  );
  assert.equal(unresolvedFlags(versionFlags('branch', fixed, changes, moved, TODAY), fixed).length, 0);
});

test('tài liệu không chép (không có nguồn) không có ô đỏ', () => {
  assert.deepEqual(versionFlags('theme', { themeId: 't12', rows: {} }, diffPlans(v1, v2), v2, TODAY), []);
});

test('đánh giá trẻ: MT đã chấm theo v1 hiện ở MT cùng lineage của v2; MT bị bỏ không còn; tiêu chí cũ giữ nguyên', () => {
  const record = { childId: 'c', criteriaMet: ['g1', 'TC1.1'], criteriaNotMet: ['g3'], criteriaOffered: ['g1', 'g2', 'g3'] };
  const mapped = remapCriteriaToPlan([v1, v2], '2', record);
  assert.deepEqual(mapped.criteriaMet, ['g11', 'TC1.1']);
  assert.deepEqual(mapped.criteriaNotMet, []);
  assert.deepEqual(mapped.criteriaOffered, ['g11', 'g12']);
  assert.deepEqual(record.criteriaMet, ['g1', 'TC1.1']);
  assert.deepEqual(remapCriteriaToPlan([v1, v2], '1', record).criteriaMet, ['g1', 'TC1.1']);
  assert.equal(remapCriteriaToPlan([v1, v2], '9', record), record);
});
