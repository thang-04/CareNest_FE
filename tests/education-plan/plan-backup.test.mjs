import test from 'node:test';
import assert from 'node:assert/strict';
import { planBaseOf, usablePlanBackup } from '../../src/models/education-plan/planBackup.mjs';
import { readPlanBackup, removePlanBackup, writePlanBackup } from '../../src/services/education-plan/planBackup.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

const server = { id: 'w1', status: 'DRAFT', history: [], days: [{ note: 'đã lưu' }] };

test('backup with unsaved content is offered while the server document is unchanged', () => {
  const entry = { doc: { ...server, days: [{ note: 'chưa lưu' }] }, base: planBaseOf(server), savedAt: 1 };
  assert.equal(usablePlanBackup(entry, server), entry);
});

test('backup is not offered after the server document was submitted, returned or got new history', () => {
  const entry = { doc: { ...server, days: [{ note: 'chưa lưu' }] }, base: planBaseOf(server), savedAt: 1 };
  assert.equal(usablePlanBackup(entry, { ...server, status: 'PENDING_VP' }), null);
  assert.equal(usablePlanBackup(entry, { ...server, history: [{ action: 'Trả lại' }] }), null);
  assert.equal(usablePlanBackup(entry, { ...server, revision: 3 }), null);
});

test('backup identical to the server content or missing is not offered', () => {
  assert.equal(usablePlanBackup({ doc: server, base: planBaseOf(server) }, server), null);
  assert.equal(usablePlanBackup(null, server), null);
});

test('backups are kept per user and document, and removable', () => {
  globalThis.localStorage = memoryStorage();
  writePlanBackup('u1', 'week:c1:2026-09-07', { doc: { a: 1 }, base: 'x', savedAt: 1 });
  assert.deepEqual(readPlanBackup('u1', 'week:c1:2026-09-07').doc, { a: 1 });
  assert.equal(readPlanBackup('u2', 'week:c1:2026-09-07'), null);
  assert.equal(readPlanBackup('u1', 'week:c1:2026-09-14'), null);
  removePlanBackup('u1', 'week:c1:2026-09-07');
  assert.equal(readPlanBackup('u1', 'week:c1:2026-09-07'), null);
});

test('a corrupted backup reads as none', () => {
  globalThis.localStorage = memoryStorage();
  localStorage.setItem('carenest:plan-backup:u1:k', '{broken');
  assert.equal(readPlanBackup('u1', 'k'), null);
});
