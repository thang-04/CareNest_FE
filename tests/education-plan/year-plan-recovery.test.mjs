import test from 'node:test';
import assert from 'node:assert/strict';
import { findYearPlanRecovery, storeYearPlanRecovery, removeYearPlanRecovery } from '../../src/services/education-plan/yearPlanRecovery.js';

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
  assert.equal(findYearPlanRecovery('b', '1', doc), null);
  const latest = findYearPlanRecovery('a', '1', doc);
  assert.equal(latest.doc.title, 'online B');
  removeYearPlanRecovery('a', '1', 'new-tab');
  assert.equal(findYearPlanRecovery('a', '1', doc).doc.title, 'offline A');
  assert.equal(values.size, 1);
  storeYearPlanRecovery('a', 'new-2026', 'initial-post', {
    doc: { ...doc, id: 'g-local', title: 'typed before lost create response' },
    baseRevision: 0,
    savedAt: 3,
  });
  assert.equal(findYearPlanRecovery('a', '999', doc).doc.title, 'typed before lost create response');
  assert.equal(findYearPlanRecovery('a', '999', { ...doc, ageGroupId: 'ag-4' }), null);
});

test('storage failure propagates so the UI cannot report a successful local save', () => {
  globalThis.localStorage = {
    setItem: () => {
      throw new Error('quota exceeded');
    },
  };
  assert.throws(() => storeYearPlanRecovery('a', '1', 'slot', { doc: {} }), /quota/);
});
