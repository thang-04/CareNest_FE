import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findYearPlanDrafts,
  pruneYearPlanDrafts,
  storeYearPlanRecovery,
  removeYearPlanRecovery,
} from '../../src/services/education-plan/yearPlanRecovery.js';

test('recovery isolates users and preserves both offline tab slots for the same plan', () => {
  const values = new Map();
  globalThis.localStorage = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const doc = { title: 'on server', schoolYear: '2026', ageGroupId: 'ag-3' };
  storeYearPlanRecovery('a', '1', 'old-tab', { doc: { ...doc, title: 'offline A' }, baseRevision: 1, savedAt: 1 });
  storeYearPlanRecovery('a', '1', 'new-tab', { doc: { ...doc, title: 'online B' }, baseRevision: 2, savedAt: 2 });
  assert.equal(values.size, 2);
  assert.deepEqual(findYearPlanDrafts('b', '1', doc), []);
  assert.deepEqual(
    findYearPlanDrafts('a', '1', doc).map((x) => x.doc.title),
    ['online B', 'offline A'],
  );
  removeYearPlanRecovery('a', '1', 'new-tab');
  assert.equal(findYearPlanDrafts('a', '1', doc)[0].doc.title, 'offline A');
  assert.equal(values.size, 1);
  storeYearPlanRecovery('a', 'new-2026', 'initial-post', {
    doc: { ...doc, id: 'g-local', title: 'typed before lost create response' },
    baseRevision: 0,
    savedAt: 3,
  });
  assert.equal(findYearPlanDrafts('a', '999', doc)[0].doc.title, 'typed before lost create response');
  assert.deepEqual(findYearPlanDrafts('a', '999', { ...doc, ageGroupId: 'ag-4' }), []);
});

test('only the two newest editing sessions are listed and kept; one slot written under two keys counts once', () => {
  const values = new Map();
  globalThis.localStorage = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const doc = { id: '7', title: 'on server', schoolYear: '2026', ageGroupId: 'ag-3' };
  storeYearPlanRecovery('a', '7', 's1', { doc: { ...doc, title: 'one' }, baseRevision: 1, savedAt: 1 });
  storeYearPlanRecovery('a', '7', 's2', { doc: { ...doc, title: 'two' }, baseRevision: 1, savedAt: 2 });
  storeYearPlanRecovery('a', 'new-2026', 's3', { doc: { ...doc, title: 'three' }, baseRevision: 1, savedAt: 3 });
  storeYearPlanRecovery('a', '7', 's3', { doc: { ...doc, title: 'three' }, baseRevision: 1, savedAt: 3 });
  const drafts = findYearPlanDrafts('a', '7', doc);
  assert.deepEqual(
    drafts.map((x) => x.doc.title),
    ['three', 'two'],
  );
  assert.equal(drafts[0].keys.length, 2);
  pruneYearPlanDrafts('a', '7', doc);
  assert.equal(values.has('carenest:year-plan-recovery:a:7:s1'), false);
  assert.equal(values.size, 3);
});

test('storage failure propagates so the UI cannot report a successful local save', () => {
  globalThis.localStorage = {
    setItem: () => {
      throw new Error('quota exceeded');
    },
  };
  assert.throws(() => storeYearPlanRecovery('a', '1', 'slot', { doc: {} }), /quota/);
});
