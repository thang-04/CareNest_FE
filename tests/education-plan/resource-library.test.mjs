import assert from 'node:assert/strict';
import { test } from 'node:test';

// Spec 900/901 — kho học liệu cá nhân cho giáo án ngày (BE:EDU-82…88)
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => storage.get(k) ?? null,
  setItem: (k, v) => storage.set(k, v),
  removeItem: (k) => storage.delete(k),
};

const lr = await import('../../src/models/education-plan/learningResources.mjs');
const { writeDb } = await import('../../src/mocks/mockDatabase.js');

const teacher = { id: 'u-t1', role: 'TEACHER' };
const other = { id: 'u-t2', role: 'TEACHER' };
const binding = (key) => ({ activityKey: key, activityLabel: 'Hoạt động học' });

test('FR-005 EDU-83: link YouTube mọi dạng chuẩn hóa như BE; link khác bị chặn', () => {
  const id = 'dQw4w9WgXcQ';
  for (const raw of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?list=PL1&v=${id}&t=10`,
    `https://youtu.be/${id}?si=x`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
  ])
    assert.equal(lr.normalizeLink(raw), `https://www.youtube.com/watch?v=${id}`, raw);
  assert.equal(lr.normalizeLink(' https://drive.google.com/file/d/x/view '), 'https://drive.google.com/file/d/x/view');
  for (const raw of [
    'http://www.youtube.com/watch?v=' + id,
    'https://example.com/a',
    'https://www.youtube.com/playlist?list=PL1',
    'javascript:alert(1)',
    '',
  ])
    assert.equal(lr.normalizeLink(raw), null, raw);
  // FR-016: phát qua tên miền không cookie
  assert.equal(lr.youtubeEmbed(`https://www.youtube.com/watch?v=${id}`), `https://www.youtube-nocookie.com/embed/${id}?rel=0`);
  assert.equal(lr.resourceKind({ kind: 'LINK', url: 'https://docs.google.com/x' }), 'google');
});

test('FR-013 EDU-87 SC-005: Cùng MT (kể cả mã Bộ năm trước) → Cùng chủ đề (id hoặc tên) → mới nhất', () => {
  const ctx = { goalIds: [20], curriculumIds: [77], themeId: 30, themeName: 'Trường mầm non của bé' };
  assert.equal(lr.matchOf([{ kind: 'GOAL', refId: 500, curriculumGoalId: 77 }], ctx), 'GOAL');
  assert.equal(lr.matchOf([{ kind: 'THEME', refId: 300, name: ' trường  mầm non của bé ' }], ctx), 'THEME');
  assert.equal(lr.matchOf([{ kind: 'GOAL', refId: 21 }], ctx), null);
  const ranked = lr.rankResources([
    { id: 1, match: null, updatedAt: '2026-11-13' },
    { id: 2, match: 'THEME', updatedAt: '2026-11-01' },
    { id: 3, match: 'GOAL', updatedAt: '2025-11-01' },
    { id: 4, match: null, updatedAt: '2026-11-14' },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.id),
    [3, 2, 4, 1],
  );
});
