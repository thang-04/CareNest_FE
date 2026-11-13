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

const { createAssessmentBeApi } = await import('@/services/assessment/api/assessmentApi');
const { BE_ERROR_FIELDS } = await import('@/services/http/beErrorFields');
const { assessmentMockRepository: repo } = await import('@/services/assessment/mock/assessmentMockRepository');
const { createSchoolConfigApi } = await import('@/services/school-config/api/schoolConfigApi');
const { boardCounts, contentError, statusChip, weekDataCells, weekLocked, weekOptionLabel, WEEKLY_COMMENT_MAX } = await import(
  '@/models/assessment/weeklyComments.mjs'
);

const fakeClient = () => {
  const calls = [];
  const respond = (method, url, body, config) => {
    calls.push({ method, url, body, params: config?.params });
    return Promise.resolve({ children: [] });
  };
  return {
    calls,
    get: (url, config) => respond('get', url, undefined, config),
    post: (url, body, config) => respond('post', url, body, config),
    put: (url, body, config) => respond('put', url, body, config),
  };
};

test('BE OBS-29: nhận xét tuần gọi đúng endpoint và body', async () => {
  const client = fakeClient();
  const api = createAssessmentBeApi(client);
  await api.getWeeklyComments({ classId: '5', weekStart: '2026-10-26' });
  await api.writeWeeklyCommentDrafts({ classId: '5', weekStart: '2026-10-26', ai: true });
  await api.saveWeeklyComment({ classId: '5', weekStart: '2026-10-26', childId: '9', content: 'Con học tốt.' });
  await api.sendWeeklyComments({ classId: '5', weekStart: '2026-10-26' });
  assert.deepEqual(
    client.calls.map((c) => `${c.method} ${c.url}`),
    [
      'get /assessment/weekly-comments',
      'post /assessment/weekly-comments/drafts',
      'put /assessment/weekly-comments',
      'post /assessment/weekly-comments/send',
    ],
  );
  assert.deepEqual(client.calls[0].params, { classId: '5', weekStart: '2026-10-26' });
  assert.deepEqual(client.calls[1].body, { classId: '5', weekStart: '2026-10-26', childId: null, overwrite: false, ai: true });
  assert.deepEqual(client.calls[2].body, { classId: '5', weekStart: '2026-10-26', childId: '9', content: 'Con học tốt.' });
  // Gửi cả lớp: childId, content null
  assert.deepEqual(client.calls[3].body, { classId: '5', weekStart: '2026-10-26', childId: null, content: null });
  assert.equal(BE_ERROR_FIELDS[7340], 'content');
  assert.equal(BE_ERROR_FIELDS[7342], 'content');
});

test('BE OBS-29: mở lại nhận xét tuần theo lớp – tuần, kết thúc sớm, hạn nhận xét tuần theo năm học', async () => {
  const client = fakeClient();
  const api = createAssessmentBeApi(client);
  await api.unlockWeeklyComments({ classId: '5', weekStart: '2026-10-26', validUntil: '2026-11-03T10:00:00.000Z', reason: 'Gửi nhầm' });
  await api.listWeeklyCommentUnlocks({ classId: '5', active: true });
  await api.revokeWeeklyCommentUnlock('7');
  await api.getWeeklyCommentOverview({ weekStart: '2026-10-26' });
  assert.deepEqual(
    client.calls.map((c) => `${c.method} ${c.url}`),
    [
      'post /assessment/weekly-comments/unlocks',
      'get /assessment/weekly-comments/unlocks',
      'post /assessment/weekly-comments/unlocks/7/revoke',
      'get /assessment/weekly-comments/overview',
    ],
  );
  assert.deepEqual(client.calls[0].body, {
    classId: '5',
    weekStart: '2026-10-26',
    validUntil: '2026-11-03T10:00:00.000Z',
    reason: 'Gửi nhầm',
  });
  assert.equal(client.calls[1].params.active, true);
  const config = fakeClient();
  await createSchoolConfigApi(config).saveWeeklyCommentDeadline('3', 2);
  assert.deepEqual(config.calls[0], {
    method: 'put',
    url: '/school-years/3/weekly-comment-deadline',
    body: { deadlineDays: 2 },
    params: undefined,
  });
  assert.equal(BE_ERROR_FIELDS[2040], 'deadlineDays');
  assert.equal(BE_ERROR_FIELDS[7316], 'validUntil');
});

test('Nội dung: gửi thì bắt buộc, tối đa 2000 ký tự; lưu nháp được để trống', () => {
  assert.equal(contentError('', { sending: true }), 'Nhập nội dung đánh giá');
  assert.equal(contentError('   '), '');
  assert.equal(contentError('a'.repeat(WEEKLY_COMMENT_MAX + 1)), 'Nội dung đánh giá tối đa 2000 ký tự');
  assert.equal(contentError('Con học tốt.', { sending: true }), '');
});

test('Trạng thái và đếm: chỉ nháp có nội dung mới tính sẵn sàng gửi', () => {
  const rows = [
    { status: 'SENT', content: 'a' },
    { status: 'DRAFT', content: 'b' },
    { status: 'DRAFT', content: '  ' },
    { status: 'NONE', absentAllWeek: true },
    { status: 'DRAFT', content: 'Tuần này con nghỉ học cả tuần', absentAllWeek: true },
    { status: 'DRAFT', content: 'Bản đã gửi, cô sửa lại', reopened: true },
  ];
  assert.deepEqual(boardCounts(rows), { total: 6, sent: 1, ready: 3 });
  assert.deepEqual(
    rows.map((r) => statusChip(r).label),
    ['Đã gửi', 'Nháp', 'Chưa có', 'Nghỉ cả tuần', 'Nháp · nghỉ cả tuần', 'Đã sửa, chưa gửi lại'],
  );
  assert.deepEqual(
    weekDataCells({
      presentDays: 3,
      schoolDays: 5,
      goalsMet: 2,
      goalsTotal: 4,
      flagCount: 3,
      weeklyTicket: true,
      lunchFinished: 0,
      lunchDays: 0,
    }).map((c) => c.value),
    ['3/5 ngày', '2/4', '3 · có phiếu tuần', '—'],
  );
});

test('Nhãn tuần: tên tuần giáo án, khoảng ngày, chưa tới cuối tuần, đã khóa, đang mở lại', () => {
  assert.equal(weekOptionLabel({ from: '2026-11-09', to: '2026-11-12', label: 'Tuần 10', open: true }), 'Tuần 10 · 09/11–12/11');
  assert.equal(weekOptionLabel({ from: '2026-11-16', to: '2026-11-20', label: null, open: false }), '16/11–20/11 · Chưa tới cuối tuần');
  const locked = { from: '2026-10-26', to: '2026-10-30', label: null, open: true, locked: true, unlockedUntil: null };
  assert.equal(weekOptionLabel(locked), '26/10–30/10 · Đã khóa');
  assert.equal(weekLocked(locked), true);
  const unlocked = { ...locked, unlockedUntil: '2026-11-03T10:00:00Z' };
  assert.equal(weekOptionLabel(unlocked), '26/10–30/10 · Đang mở lại');
  assert.equal(weekLocked(unlocked), false);
});

test('BE giả OBS-29: trong hạn GV viết, gửi, sửa lại bản đã gửi; tuần quá hạn khóa; tuần chưa bắt đầu bị chặn', async () => {
  const today = new Date();
  const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1', fullName: 'Cô Minh Anh' };
  const classId = 'cls_c1_c1';
  const current = await repo.getWeeklyComments({ classId }, TEACHER);
  // Tuần quá hạn (đã qua ngày học sau tuần) khóa: không viết được
  const locked = current.weeks.find((w) => w.open && w.locked && !w.unlockedUntil);
  if (locked) {
    const board = await repo.getWeeklyComments({ classId, weekStart: locked.weekStart }, TEACHER);
    assert.equal(board.canEdit, false);
    await assert.rejects(() => repo.writeWeeklyCommentDrafts({ classId, weekStart: locked.weekStart }, TEACHER));
  }
  const writable = current.weeks.find((w) => w.open && !w.locked);
  if (writable) {
    const board = await repo.writeWeeklyCommentDrafts({ classId, weekStart: writable.weekStart }, TEACHER);
    assert.equal(board.canEdit, true);
    const first = board.children[0];
    assert.equal(first.status, 'DRAFT');
    const sent = await repo.sendWeeklyComments(
      { classId, weekStart: writable.weekStart, childId: first.childId, content: 'Con học tốt.' },
      TEACHER,
    );
    assert.equal(sent.children[0].status, 'SENT');
    const edited = await repo.saveWeeklyComment(
      { classId, weekStart: writable.weekStart, childId: first.childId, content: 'Con học tốt, ngoan.' },
      TEACHER,
    );
    assert.equal(edited.children[0].status, 'DRAFT');
    assert.equal(statusChip(edited.children[0]).label, 'Đã sửa, chưa gửi lại');
  }
  const next = new Date(today);
  next.setDate(next.getDate() + 7);
  const pad = (n) => String(n).padStart(2, '0');
  const future = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  await assert.rejects(() => repo.getWeeklyComments({ classId, weekStart: future }, TEACHER), /chưa bắt đầu/);
});
