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
const { boardCounts, contentError, statusChip, weekDataCells, WEEKLY_COMMENT_MAX } = await import('@/models/assessment/weeklyComments.mjs');

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
  ];
  assert.deepEqual(boardCounts(rows), { total: 4, sent: 1, ready: 1 });
  assert.deepEqual(
    rows.map((r) => statusChip(r).label),
    ['Đã gửi', 'Nháp', 'Chưa có', 'Nghỉ cả tuần'],
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

test('BE giả OBS-29: GV viết nháp, gửi thì khóa; tuần chưa bắt đầu bị chặn', async () => {
  const today = new Date();
  if ([0, 6].includes(today.getDay())) return;
  const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1', fullName: 'Cô Minh Anh' };
  const classId = 'cls_c1_c1';
  const board = await repo.writeWeeklyCommentDrafts({ classId }, TEACHER);
  assert.equal(board.canEdit, true);
  const first = board.children[0];
  assert.equal(first.status, 'DRAFT');
  assert.match(first.content, /^Tuần này con đi học/);
  const sent = await repo.sendWeeklyComments({ classId, childId: first.childId, content: 'Con học tốt.' }, TEACHER);
  assert.equal(sent.children[0].status, 'SENT');
  await assert.rejects(() => repo.saveWeeklyComment({ classId, childId: first.childId, content: 'Sửa' }, TEACHER), /đã gửi/);
  const next = new Date(today);
  next.setDate(next.getDate() + 7);
  const pad = (n) => String(n).padStart(2, '0');
  const future = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
  await assert.rejects(() => repo.getWeeklyComments({ classId, weekStart: future }, TEACHER), /chưa bắt đầu/);
});
