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
const { learningResourceMockRepository: day, resourceLibraryMockRepository: lib } = await import(
  '../../src/services/education-plan/mock/learningResourceMockRepository.js'
);
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
  const page = await lib.list(teacher, {});
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].usageCount, 1);
});

test('FR-003: mỗi mục tối đa 20 học liệu', async () => {
  const ids = [];
  for (let i = 0; i < 21; i++)
    ids.push(
      (await day.addLink(other, `dd_src${i}`, { url: `https://drive.google.com/file/d/f${i}/view`, ...binding('2026-09-07#hoc') })).itemId,
    );
  await day.attach(other, 'dd_full', { itemIds: ids.slice(0, 20), ...binding('2026-09-07#goc') });
  await assert.rejects(day.attach(other, 'dd_full', { itemIds: [ids[20]], ...binding('2026-09-07#goc') }), /tối đa 20/);
});

test('901 FR-001/002 SC-004: kho chỉ của người tạo; không gắn, xem, sửa học liệu của người khác', async () => {
  const mine = await day.addLink(teacher, 'dd_own', { url: 'https://drive.google.com/file/d/own/view', ...binding('2026-09-10#hoc') });
  assert.ok(!(await lib.list(other, {})).items.some((r) => r.id === mine.itemId));
  await assert.rejects(day.attach(other, 'dd_x', { itemIds: [mine.itemId], ...binding('2026-09-10#hoc') }), /Không tìm thấy học liệu/);
  await assert.rejects(lib.update(other, mine.itemId, { title: 'X' }), /Không tìm thấy học liệu/);
  await assert.rejects(lib.contentUrl(other, mine.itemId), /Không tìm thấy học liệu/);
  // Dữ liệu mock cũ có phạm vi trường vẫn chỉ là học liệu của người tạo
  writeDb((db) => {
    db.eduResources.items.find((i) => i.id === mine.itemId).scope = 'SCHOOL';
  });
  assert.ok(!(await lib.list(other, {})).items.some((r) => r.id === mine.itemId));
  for (const gone of ['upload', 'addLink', 'share', 'withdraw', 'review']) assert.equal(lib[gone], undefined, gone);
});

test('901 FR-004: nhãn chủ đề + năm tự thêm theo dòng gắn, gỡ là mất; nhãn tay giữ; lọc theo chủ đề đã dạy', async () => {
  writeDb((db) => {
    db.eduGoals = [...(db.eduGoals || []).filter((g) => g.id !== 'yp-t'), { id: 'yp-t', schoolYear: '2026-2027' }];
    db.eduClassWeek = [
      ...(db.eduClassWeek || []).filter((w) => w.id !== 'wp_tag'),
      { id: 'wp_tag', classId: 'c1', yearPlanId: 'yp-t', themeId: 't1', status: 'DRAFT' },
    ];
  });
  const tags = { themeId: 't1', themeName: 'Gia đình', goalIds: [] };
  const row = await day.addLink(teacher, 'dd_tag', { url: 'https://drive.google.com/file/d/tag/view', ...binding('2026-09-11#hoc'), tags });
  const find = async (q = {}) => (await lib.list(teacher, q)).items.find((r) => r.id === row.itemId);
  let item = await find();
  assert.deepEqual(item.taughtThemes, [{ name: 'Gia đình', schoolYearId: '2026-2027', schoolYearName: '2026-2027' }]);
  assert.equal(item.tags[0].auto, true);
  assert.ok(await find({ teachThemeName: ' gia đình ', schoolYearId: '2026-2027' }));
  assert.equal(await find({ teachThemeName: 'Bản thân' }), undefined);
  item = await lib.update(teacher, row.itemId, { themes: [{ name: 'Bản thân' }], removeTagIds: [item.tags[0].id] });
  assert.equal(item.tags.length, 2, 'nhãn tự thêm không bỏ tay được');
  await day.detach(teacher, 'dd_tag', row.id);
  item = await find();
  assert.deepEqual(
    item.tags.map((t) => [t.name, t.auto]),
    [['Bản thân', false]],
  );
  item = await lib.update(teacher, row.itemId, { removeTagIds: [item.tags[0].id] });
  assert.deepEqual(item.taughtThemes, []);
});

test('901 FR-010 EDU-85: Chờ duyệt / đã ban hành chưa qua ngày dạy ⇒ chặn xóa và đổi tên (7137); qua ngày dạy ⇒ xóa cả dòng gắn', async () => {
  const { todayVn } = lr;
  const today = todayVn();
  writeDb((db) => {
    db.classes = [{ id: 'c1', name: 'A1', ageGroupId: 'ag-3', teacherIds: [teacher.id] }];
    db.eduClassWeek = [
      ...(db.eduClassWeek || []).filter((w) => !['wp_rv', 'wp_ap'].includes(w.id)),
      { id: 'wp_rv', classId: 'c1', yearPlanId: 'yp-t', themeId: 't1', status: 'PENDING_TL' },
      { id: 'wp_ap', classId: 'c1', yearPlanId: 'yp-t', themeId: 't2', status: 'APPROVED' },
    ];
  });
  const url = 'https://docs.google.com/presentation/d/lock/edit';
  const first = await day.addLink(teacher, 'dd_ap', { url, ...binding(`${today}#hoc`) });
  let usages = await lib.usages(teacher, first.itemId);
  assert.equal(usages.locked, true);
  assert.equal(usages.rows[0].status, 'APPROVED');
  assert.equal(usages.rows[0].classroomId, 'c1');
  assert.equal(usages.deletableFrom > today, true);
  await assert.rejects(
    lib.remove(teacher, first.itemId),
    (e) => e.errorCode === 7137 && /A1 – .* – Hoạt động học\. Xóa được từ/.test(e.message),
  );
  await assert.rejects(lib.update(teacher, first.itemId, { title: 'Tên mới' }), (e) => e.errorCode === 7137);
  // Sửa nhãn vẫn được khi bị khóa
  await lib.update(teacher, first.itemId, { ageGroupId: 'ag-3' });
  await day.addLink(teacher, 'dd_rv', { url, ...binding('2020-01-01#goc') });
  usages = await lib.usages(teacher, first.itemId);
  assert.equal(usages.deletableFrom, null);
  await assert.rejects(lib.remove(teacher, first.itemId), /sau khi giáo án được duyệt hoặc trả lại/);
  // Hết khóa: còn dòng gắn ở giáo án nháp ⇒ xóa được, mọi dòng gắn mất
  writeDb((db) => {
    db.eduClassWeek.forEach((w) => {
      if (w.id === 'wp_rv' || w.id === 'wp_ap') w.status = 'DRAFT';
    });
  });
  await lib.remove(teacher, first.itemId);
  assert.equal((await day.list(teacher, 'dd_ap')).length, 0);
  assert.equal((await day.list(teacher, 'dd_rv')).length, 0);
});

test('EDU-82: đổi thứ tự học liệu trong mục; danh sách cũ (thiếu dòng) bị từ chối', async () => {
  assert.deepEqual(lr.moveId([1, 2, 3], 3, -1), [1, 3, 2]);
  assert.deepEqual(lr.moveId([1, 2, 3], 1, -1), [1, 2, 3]);
  const key = 'dd_order';
  const ids = [];
  for (const v of ['aaaaaaaaaa1', 'aaaaaaaaaa2', 'aaaaaaaaaa3'])
    ids.push((await day.addLink(teacher, key, { url: `https://youtu.be/${v}`, ...binding('2026-09-09#hoc') })).id);
  assert.deepEqual(
    (await day.list(teacher, key)).map((r) => r.id),
    ids,
  );
  const next = lr.moveId(ids, ids[2], -1);
  assert.deepEqual(
    (await day.reorder(teacher, key, { activityKey: '2026-09-09#hoc', ids: next })).map((r) => r.id),
    next,
  );
  await assert.rejects(day.reorder(teacher, key, { activityKey: '2026-09-09#hoc', ids: ids.slice(1) }), /tải lại trang/);
});
