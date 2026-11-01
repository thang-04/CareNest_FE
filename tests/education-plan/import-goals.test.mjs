import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getImportGoals, mergeImportedGoals } from '../../src/models/education-plan/importGoals.mjs';
import { toRows } from '@/models/education-plan/goalTable';
import { buildRefs, toYearPlanRequest } from '@/services/education-plan/api/yearPlanMapper';

const NAME = 'Phát triển thể chất';
const heading = (id, kind, text = id) => ({ id, kind, text });
const goal = (id, text = id, contents = []) => ({ id, kind: 'goal', text, contents });
const plan = (rows, extra = {}) => ({ domains: [{ id: 'domain', name: NAME, rows }], ...extra });
const ids = () => {
  let n = 0;
  return () => String(++n);
};
const merge = (target, source, selected) => mergeImportedGoals(target, source, selected, ids());
const goalPaths = (domain) => {
  let sub = null;
  let group = null;
  const result = [];
  for (const row of toRows(domain, () => 'fallback')) {
    if (row.kind === 'sub') {
      sub = row.text;
      group = null;
    } else if (row.kind === 'group') group = row.text;
    else if (row.kind === 'goal') result.push({ text: row.text, sub, group });
  }
  return result;
};

test('source view selects stable row IDs and distinguishes repeated heading labels', () => {
  const source = plan([
    heading('s1', 'sub', 'Cùng tên'),
    heading('g1', 'group', 'Nhóm'),
    goal('a'),
    heading('s2', 'sub', 'Cùng tên'),
    heading('g2', 'group', 'Nhóm'),
    goal('b'),
  ]);
  const view = getImportGoals(source);
  assert.deepEqual(
    view.map((g) => [g.id, g.domainName, g.sub.id, g.group.id]),
    [
      ['a', NAME, 's1', 'g1'],
      ['b', NAME, 's2', 'g2'],
    ],
  );
  assert.deepEqual(
    getImportGoals(source).map((g) => g.id),
    ['a', 'b'],
  );
});

test('selected subset appends only minimal ancestors and preserves source paths on reopen', () => {
  const target = plan([heading('old-sub', 'sub'), heading('old-group', 'group'), goal('10', 'Existing')]);
  const source = plan([
    heading('s1', 'sub', 'Sub'),
    heading('g1', 'group', 'Group'),
    goal('a'),
    goal('unselected'),
    goal('b'),
    heading('g2', 'group', 'Group'),
    goal('c'),
    heading('s2', 'sub', 'Sub'),
    goal('d'),
  ]);
  const { domains, report } = merge(target, source, ['d', 'c', 'b', 'a']);
  assert.deepEqual(report, { added: 4, duplicates: 0, unavailable: [] });
  assert.deepEqual(
    domains[0].rows.map((r) => r.text),
    ['old-sub', 'old-group', 'Existing', 'Sub', 'Group', 'a', 'b', 'Group', 'c', 'Sub', 'd'],
  );
  assert.deepEqual(goalPaths(domains[0]), [
    { text: 'Existing', sub: 'old-sub', group: 'old-group' },
    { text: 'a', sub: 'Sub', group: 'Group' },
    { text: 'b', sub: 'Sub', group: 'Group' },
    { text: 'c', sub: 'Sub', group: 'Group' },
    { text: 'd', sub: 'Sub', group: null },
  ]);
  assert.equal(domains[0].rows[0], target.domains[0].rows[0]);
});

test('new IDs serialize as null, old IDs/ticks survive, and inputs remain unchanged', () => {
  const target = plan([goal('10', 'Existing', [{ id: '11', text: 'Old content', themes: ['20'] }])], {
    title: 'Target',
    themes: [{ id: '20', name: 'Target theme' }],
    breaks: [{ id: '30', label: 'Break' }],
    revision: 9,
  });
  const source = plan(
    [
      {
        ...goal('50', 'New', [{ id: '51', text: 'New content', themes: ['52'], themeIds: [52], themeKeys: ['52'] }]),
        goalNo: 99,
        code: 'MT99',
      },
    ],
    { themes: [{ id: '52' }] },
  );
  const baseline = structuredClone({ target, source });
  const { domains } = merge(target, source, ['50']);
  assert.deepEqual({ target, source }, baseline);
  const added = domains[0].rows[1];
  assert.match(added.id, /^[a-z]/i);
  assert.match(added.contents[0].id, /^[a-z]/i);
  assert.deepEqual(added.contents[0].themes, []);
  assert.equal(added.contents[0].themeIds, undefined);
  assert.equal(added.contents[0].themeKeys, undefined);
  assert.equal(added.goalNo, undefined);
  assert.equal(added.code, undefined);
  assert.notEqual(added.contents, source.domains[0].rows[0].contents);
  const refs = buildRefs({ domains: [{ id: 1, name: NAME }] });
  const body = toYearPlanRequest({ ...target, domains }, refs);
  assert.deepEqual(
    body.domains[0].rows.map((r) => r.id),
    [10, null],
  );
  assert.deepEqual(
    body.domains[0].rows.map((r) => r.contents[0].id),
    [11, null],
  );
  assert.deepEqual(body.domains[0].rows[0].contents[0].themeKeys, ['20']);
  assert.deepEqual(body.domains[0].rows[1].contents[0].themeKeys, []);
});

test('dedupes trimmed text case sensitively within each domain and the same batch', () => {
  const target = plan([goal('old', ' Same ')]);
  const source = plan([heading('g', 'group'), goal('a', 'Same'), goal('b', 'Next'), goal('c', ' Next '), goal('d', 'same')]);
  const { domains, report } = merge(target, source, ['a', 'b', 'c', 'd']);
  assert.deepEqual(report, { added: 2, duplicates: 2, unavailable: [] });
  assert.deepEqual(
    domains[0].rows.map((r) => r.text),
    [' Same ', 'g', 'Next', 'same'],
  );
  assert.equal(merge(target, source, ['a']).domains[0], target.domains[0]);
});

test('missing target domain is reported with goal label without changing target', () => {
  const target = plan([]);
  const source = { domains: [{ id: 'other', name: 'Unknown domain', rows: [goal('a', 'Cannot add')] }] };
  const result = merge(target, source, ['a']);
  assert.equal(result.domains[0], target.domains[0]);
  assert.equal(result.report.added, 0);
  assert.equal(result.report.unavailable.length, 1);
  assert.equal(result.report.unavailable[0].label, 'Cannot add');
  assert.ok(result.report.unavailable[0].reason);
});

test('legacy items retain deterministic IDs and clone requirements without ticks', () => {
  const source = { domains: [{ id: 'legacy', name: NAME, items: [{ text: 'Legacy', code: 'MT9', requirements: [{ text: 'Learn' }] }] }] };
  const first = getImportGoals(source);
  assert.deepEqual(first, getImportGoals(source));
  assert.equal(first[0].code, 'MT9');
  const result = merge(plan([]), source, [first[0].id]);
  assert.equal(result.report.added, 1);
  assert.equal(result.domains[0].rows[0].contents[0].text, 'Learn');
  assert.deepEqual(result.domains[0].rows[0].contents[0].themes, []);
});

test('first incoming sub cannot reparent existing root goals after reopen', () => {
  const target = plan([goal('old', 'Root target')]);
  const source = plan([heading('s', 'sub'), goal('a')]);
  const result = merge(target, source, ['a']);
  assert.equal(result.report.added, 0);
  assert.equal(result.report.unavailable.length, 1);
  assert.equal(result.domains[0], target.domains[0]);
  assert.deepEqual(goalPaths(result.domains[0]), [{ text: 'Root target', sub: null, group: null }]);
});

test('source root goals cannot silently inherit target sub/group context', () => {
  for (const rows of [
    [heading('s', 'sub'), goal('old')],
    [heading('g', 'group'), goal('old')],
  ]) {
    const target = plan(rows);
    const result = merge(target, plan([goal('a')]), ['a']);
    assert.equal(result.report.added, 0);
    assert.equal(result.report.unavailable.length, 1);
    assert.equal(result.domains[0], target.domains[0]);
  }
});

test('root source groups can append to root target and independent domains do not dedupe', () => {
  const target = {
    domains: [
      { id: 'one', name: NAME, rows: [goal('old', 'Same')] },
      { id: 'two', name: 'Phát triển nhận thức', rows: [] },
    ],
  };
  const source = { domains: [{ id: 'other', name: 'Phát triển nhận thức', rows: [heading('g', 'group'), goal('a', 'Same')] }] };
  const result = merge(target, source, ['a']);
  assert.equal(result.report.added, 1);
  assert.equal(result.domains[0], target.domains[0]);
  assert.deepEqual(goalPaths(result.domains[1]), [{ text: 'Same', sub: null, group: 'g' }]);
});

test('200 selected goals preserve order and import within one second', () => {
  const source = plan(Array.from({ length: 200 }, (_, i) => goal(`source-${i}`)));
  const start = performance.now();
  const result = merge(
    plan([]),
    source,
    getImportGoals(source).map((g) => g.id),
  );
  assert.equal(result.report.added, 200);
  assert.deepEqual(
    result.domains[0].rows.map((r) => r.text),
    source.domains[0].rows.map((r) => r.text),
  );
  assert.ok(performance.now() - start < 1000);
});

test('inactive or unconfigured matching domains report unavailable instead of silently dropping at save', () => {
  for (const domain of [
    { id: 'disabled', name: NAME, active: false, rows: [] },
    { id: 'removed', name: 'Removed domain', rows: [] },
  ]) {
    const target = { domains: [domain] };
    const source = { domains: [{ name: domain.name, rows: [goal('a')] }] };
    const result = merge(target, source, ['a']);
    assert.equal(result.report.unavailable.length, 1);
    assert.equal(result.report.added, 0);
    assert.equal(result.domains[0], domain);
  }
});

test('duplicate-only selection creates no headings or new domain objects', () => {
  const target = plan([heading('s', 'sub'), goal('old', 'Same')]);
  const source = plan([heading('source-sub', 'sub'), heading('source-group', 'group'), goal('a', 'Same')]);
  const result = merge(target, source, ['a']);
  assert.deepEqual(result.report, { added: 0, duplicates: 1, unavailable: [] });
  assert.equal(result.domains[0], target.domains[0]);
});

test('failed first-sub candidate does not leave orphan headings before a later valid goal', () => {
  const target = plan([goal('old')]);
  const source = {
    domains: [
      { name: NAME, rows: [heading('s', 'sub'), goal('a')] },
      { name: NAME, rows: [goal('b')] },
    ],
  };
  const result = merge(target, source, ['a', 'b']);
  assert.equal(result.report.added, 1);
  assert.equal(result.report.unavailable.length, 1);
  assert.deepEqual(
    result.domains[0].rows.map((r) => r.text),
    ['old', 'b'],
  );
});

test('ID generator collisions cannot duplicate target or incoming row and content identities', () => {
  const target = plan([goal('new-id')]);
  const source = plan([goal('source', 'Incoming', [{ id: 'source-content', text: 'Content' }])]);
  const result = mergeImportedGoals(target, source, ['source'], () => 'new-id');
  const incoming = result.domains[0].rows[1];
  assert.notEqual(incoming.id, 'new-id');
  assert.notEqual(incoming.contents[0].id, incoming.id);
  assert.notEqual(incoming.contents[0].id, 'new-id');
});

test('unknown selection IDs and empty selection cannot import extra goals', () => {
  for (const selected of [[], ['missing']]) {
    const target = plan([]);
    const result = merge(target, plan([goal('a')]), selected);
    assert.deepEqual(result.report, { added: 0, duplicates: 0, unavailable: [] });
    assert.equal(result.domains[0], target.domains[0]);
  }
});
