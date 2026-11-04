import test from 'node:test';
import assert from 'node:assert/strict';
import { readDrafts, writeDrafts } from '../../src/services/assessment/draftStore.js';

test('class-level drafts are stored per user and document; an empty list removes the key', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const key = 'class-monthly-comment:1:2026-10-01';
  writeDrafts('u1', key, [{ session: 's', doc: 'Lớp ngoan', savedAt: 1 }]);
  assert.equal(readDrafts('u1', key)[0].doc, 'Lớp ngoan');
  assert.deepEqual(readDrafts('u2', key), []);
  values.set([...values.keys()][0], '{broken');
  assert.deepEqual(readDrafts('u1', key), []);
  writeDrafts('u1', key, []);
  assert.equal(values.size, 0);
});
