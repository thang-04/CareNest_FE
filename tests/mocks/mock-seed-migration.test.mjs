import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};
globalThis.window = new EventTarget();

const { applyMockSeedMigration, needsMockSeedMigration, readDb, writeDb } = await import('@/mocks/mockDatabase');
const { buildSeedDatabase } = await import('@/mocks/seed');
const { ensureSchoolSeeded } = await import('@/mocks/schoolMockRepository');

test('legacy base DB backfills empty demo lists and preserves lists with records', () => {
  const seed = buildSeedDatabase();
  localStorage.setItem('carenest.mockdb.v3', JSON.stringify({ ...seed, assets: [], transfers: [], notifications: [] }));

  const db = readDb();

  assert.deepEqual(db.assets, seed.assets);
  assert.deepEqual(db.transfers, seed.transfers);
  assert.deepEqual(db.notifications, seed.notifications);
  assert.equal(db.mockSeedVersions.base, 1);
});

test('school repository backfills empty class and child collections in a legacy DB', () => {
  const originalUsers = readDb().users;
  writeDb((db) => {
    db.classes = [];
    db.children = [];
    delete db.mockSeedVersions.school;
  });

  const db = ensureSchoolSeeded();

  assert.ok(db.classes.length > 0);
  assert.ok(db.children.length > 0);
  assert.deepEqual(db.users, originalUsers);
});

test('module seed migration fills empty collections once and preserves existing rows', () => {
  const db = {
    campuses: [],
    users: [{ id: 'user-added' }],
    mockSeedVersions: {},
  };

  assert.equal(needsMockSeedMigration(db, 'school', 1, ['campuses', 'users']), true);
  applyMockSeedMigration(db, 'school', 1, { campuses: [{ id: 'c1' }], users: [{ id: 'seed-user' }] });
  assert.deepEqual(db.campuses, [{ id: 'c1' }]);
  assert.deepEqual(db.users, [{ id: 'user-added' }]);
  assert.equal(db.mockSeedVersions.school, 1);

  db.campuses = [];
  assert.equal(needsMockSeedMigration(db, 'school', 1, ['campuses', 'users']), false);
  assert.equal(needsMockSeedMigration(db, 'school', 2, ['campuses', 'users']), true);
  applyMockSeedMigration(db, 'school', 2, { campuses: [{ id: 'c1', migrated: true }], users: [{ id: 'seed-user' }] });
  assert.deepEqual(db.campuses, [{ id: 'c1', migrated: true }]);
  assert.deepEqual(db.users, [{ id: 'user-added' }]);
  assert.equal(db.mockSeedVersions.school, 2);
});
