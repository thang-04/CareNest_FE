import assert from 'node:assert/strict';
import { test } from 'node:test';

// Spec 900 — kho học liệu cho giáo án ngày (BE:EDU-82…88)
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) };

const lr = await import('../../src/models/education-plan/learningResources.mjs');
const { learningResourceMockRepository: day, resourceLibraryMockRepository: lib } = await import(
  '../../src/services/education-plan/mock/learningResourceMockRepository.js'
);
const { writeDb } = await import('../../src/mocks/mockDatabase.js');

const teacher = { id: 'u-t1', role: 'TEACHER' };
const other = { id: 'u-t2', role: 'TEACHER' };
const leader = { id: 'u-tl', role: 'TEAM_LEADER' };
const vice = { id: 'u-vp', role: 'VICE_PRINCIPAL' };
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
  for (const raw of ['http://www.youtube.com/watch?v=' + id, 'https://example.com/a', 'https://www.youtube.com/playlist?list=PL1', 'javascript:alert(1)', ''])
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
  assert.deepEqual(ranked.map((r) => r.id), [3, 2, 4, 1]);
});

test('US1 FR-001/006 SC-004: tải một lần, gắn lại ngày khác; không gắn trùng; gỡ không mất ở ngày khác', async () => {
  const link = await day.addLink(teacher, 'dd_a', { url: 'https://youtu.be/dQw4w9WgXcQ', ...binding('2026-09-07#hoc') });
  assert.equal(link.kind, 'LINK');
  assert.equal(link.title, 'Video YouTube');
  // Dán lại cùng video ở ngày khác ⇒ dùng lại học liệu cũ
  const again = await day.addLink(teacher, 'dd_b', { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', ...binding('2026-09-14#chieu') });
  assert.equal(again.itemId, link.itemId);
  await assert.rejects(day.attach(teacher, 'dd_a', { itemIds: [link.itemId], ...binding('2026-09-07#hoc') }), /đã gắn vào mục này/);
  await day.detach(teacher, 'dd_a', link.id);
  assert.equal((await day.list(teacher, 'dd_a')).length, 0);
  assert.equal((await day.list(teacher, 'dd_b')).length, 1);
  const page = await lib.list(teacher, { view: 'MINE' });
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].usageCount, 1);
});

test('FR-003: mỗi mục tối đa 20 học liệu', async () => {
  const ids = [];
  for (let i = 0; i < 21; i++) ids.push((await lib.addLink(other, { url: `https://drive.google.com/file/d/f${i}/view` })).id);
  await day.attach(other, 'dd_full', { itemIds: ids.slice(0, 20), ...binding('2026-09-07#goc') });
  await assert.rejects(day.attach(other, 'dd_full', { itemIds: [ids[20]], ...binding('2026-09-07#goc') }), /tối đa 20/);
});

test('FR-007 EDU-85: xóa khi còn dùng bị chặn, ẩn thì không hiện trong kho nhưng giáo án vẫn có', async () => {
  const row = await day.addLink(teacher, 'dd_c', { url: 'https://docs.google.com/presentation/d/p1/edit', ...binding('2026-09-08#hoc') });
  await assert.rejects(lib.remove(teacher, row.itemId), /đang dùng ở 1 mục/);
  await lib.update(teacher, row.itemId, { hidden: true });
  assert.ok(!(await lib.list(teacher, { view: 'ALL' })).items.some((r) => r.id === row.itemId));
  assert.ok((await lib.list(teacher, { view: 'HIDDEN' })).items.some((r) => r.id === row.itemId));
  assert.equal((await day.list(teacher, 'dd_c')).length, 1);
  await day.detach(teacher, 'dd_c', row.id);
  await lib.remove(teacher, row.itemId);
  assert.ok(!(await lib.list(teacher, { view: 'HIDDEN' })).items.some((r) => r.id === row.itemId));
});

test('FR-009/010 EDU-84: chia sẻ lớp chỉ lớp mình dạy; đề nghị lên trường, tổ trưởng nhóm tuổi duyệt, trả lại cần lý do', async () => {
  writeDb((db) => {
    db.classes = [{ id: 'c1', name: 'A1', ageGroupId: 'ag-3', teacherIds: [teacher.id, other.id] }];
    db.users = [...(db.users || []).filter((u) => u.id !== leader.id), { ...leader, ageGroupId: 'ag-3' }];
  });
  const item = await lib.addLink(teacher, { url: 'https://drive.google.com/file/d/share/view', ageGroupId: 'ag-3' });
  await assert.rejects(lib.share(teacher, item.id, { scope: 'CLASS', classroomId: 'c9' }), /không có quyền/);
  await lib.share(teacher, item.id, { scope: 'CLASS', classroomId: 'c1' });
  const seen = (await lib.list(other, { view: 'CLASS' })).items.find((r) => r.id === item.id);
  assert.ok(seen && !seen.canEdit);
  const pending = await lib.share(teacher, item.id, { scope: 'SCHOOL' });
  assert.equal(pending.shareStatus, 'PENDING');
  assert.equal(pending.scope, 'CLASS');
  await assert.rejects(lib.remove(teacher, item.id), /rút đề nghị/);
  assert.ok((await lib.list(leader, { view: 'PENDING' })).items.some((r) => r.id === item.id && r.canReview));
  await assert.rejects(lib.review(leader, item.id, { approve: false, reason: ' ' }), /lý do/);
  const rejected = await lib.review(leader, item.id, { approve: false, reason: 'Video quảng cáo' });
  assert.equal(rejected.shareStatus, 'REJECTED');
  await lib.share(teacher, item.id, { scope: 'SCHOOL' });
  const approved = await lib.review(leader, item.id, { approve: true });
  assert.equal(approved.scope, 'SCHOOL');
  // PHT đưa thẳng lên trường
  const own = await lib.addLink(vice, { url: 'https://drive.google.com/file/d/vp/view' });
  assert.equal((await lib.share(vice, own.id, { scope: 'SCHOOL' })).scope, 'SCHOOL');
});
