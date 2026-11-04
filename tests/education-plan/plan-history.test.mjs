import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_DRAFTS, diffLines, docLines, draftsOf, upsertDraft, yearPlanLines } from '../../src/models/education-plan/planHistory.mjs';
import { readPlanDrafts, writePlanDrafts } from '../../src/services/education-plan/planBackup.js';

test('one entry per editing session, newest first, a third session pushes out the oldest', () => {
  let list = upsertDraft([], { session: 'a', savedAt: 1, doc: { v: 1 } });
  list = upsertDraft(list, { session: 'a', savedAt: 2, doc: { v: 2 } });
  assert.equal(list.length, 1);
  assert.equal(list[0].doc.v, 2);
  list = upsertDraft(list, { session: 'b', savedAt: 3, doc: { v: 3 } });
  list = upsertDraft(list, { session: 'c', savedAt: 4, doc: { v: 4 } });
  assert.equal(list.length, MAX_DRAFTS);
  assert.deepEqual(
    list.map((x) => x.session),
    ['c', 'b'],
  );
});

test('a backup kept in the old single-entry shape still reads as one draft', () => {
  assert.deepEqual(draftsOf({ doc: { a: 1 }, base: 'x', savedAt: 5 }), [{ doc: { a: 1 }, base: 'x', savedAt: 5, session: 'legacy' }]);
  assert.deepEqual(draftsOf(null), []);
  assert.equal(draftsOf({ entries: [{ doc: {} }, { bad: true }] }).length, 1);
});

test('drafts are stored per user and document; an empty list removes the key', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  writePlanDrafts('u1', 'week:c1', [{ session: 's', doc: { a: 1 }, savedAt: 1 }]);
  assert.equal(readPlanDrafts('u1', 'week:c1').length, 1);
  assert.deepEqual(readPlanDrafts('u2', 'week:c1'), []);
  writePlanDrafts('u1', 'week:c1', []);
  assert.equal(values.size, 0);
});

test('class document lines keep content text and skip technical fields', () => {
  const lines = docLines({
    id: 'w1',
    status: 'DRAFT',
    classId: 'c',
    history: [{ note: 'x' }],
    days: [{ aims: 'Trẻ biết\nđếm', prep: '' }],
  });
  assert.deepEqual(lines, ['Trẻ biết', 'đếm']);
});

test('year plan lines show content with ticked theme abbreviations', () => {
  const doc = {
    title: 'KH',
    themes: [{ id: 't1', name: 'Trường', abbr: 'TR', start: '2026-09-07', end: '2026-09-11' }],
    domains: [{ name: 'Thể chất', rows: [{ text: 'MT1', contents: [{ text: 'Bò', themes: ['t1'] }] }] }],
  };
  assert.deepEqual(yearPlanLines(doc), [
    'Tên kế hoạch: KH',
    'Thể chất',
    '• MT1',
    '– Bò [TR]',
    'Chủ đề: Trường (TR) 2026-09-07 – 2026-09-11',
  ]);
});

test('diff marks lines only in the chosen version as added and lines only in the open one as removed', () => {
  const ops = diffLines(['a', 'b', 'c'], ['a', 'x', 'c', 'd']);
  assert.deepEqual(ops, [
    { type: 'same', text: 'a' },
    { type: 'del', text: 'b' },
    { type: 'add', text: 'x' },
    { type: 'same', text: 'c' },
    { type: 'add', text: 'd' },
  ]);
  assert.ok(diffLines(['a'], ['a']).every((x) => x.type === 'same'));
});

test('diff of a 200-row plan stays fast', () => {
  const from = Array.from({ length: 1200 }, (_, i) => `dòng ${i}`);
  const to = from.map((x, i) => (i % 7 === 0 ? `${x} sửa` : x));
  const t = performance.now();
  const ops = diffLines(from, to);
  assert.ok(performance.now() - t < 300);
  assert.equal(ops.filter((x) => x.type === 'add').length, Math.ceil(1200 / 7));
});
