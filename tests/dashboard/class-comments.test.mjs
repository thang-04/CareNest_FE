import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

const NativeDate = Date;
const NOW = '2026-10-29T03:00:00.000Z';
globalThis.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [NOW]));
  }
  static now() {
    return NativeDate.parse(NOW);
  }
};
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { assessmentMockRepository: repo } = await import('@/services/assessment/mock/assessmentMockRepository');
const { createAssessmentBeApi } = await import('@/services/assessment/api/assessmentApi');
const { readDb, writeDb, resetDb } = await import('@/mocks/mockDatabase');
const { createGeneralDraft } = await import('@/utils/assessment/dailyGeneralDraft');
const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
const VP = { id: 'u_lan', role: 'VICE_PRINCIPAL', campusId: 'c1' };
const OTHER_VP = { id: 'u_duc', role: 'VICE_PRINCIPAL', campusId: 'c2' };
const HT = { id: 'u_hung', role: 'PRINCIPAL', campusId: null };
const CLASS = 'cls_c1_c1';
const TODAY = '2026-10-29';
const NOTE = 'Lớp tham gia hoạt động tốt, cần rèn nề nếp giờ ngủ.';
beforeEach(() => {
  storage.clear();
  resetDb();
});

test('lưu nhận xét chung cùng trẻ, sửa riêng và request cũ không xóa nhận xét lớp', async () => {
  await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER);
  const child = readDb().children.find((c) => c.classId === CLASS && c.status === 'ACTIVE');
  writeDb((db) => {
    db.attendance = (db.attendance || []).filter((r) => !(r.classId === CLASS && r.date === TODAY));
    db.attendance.push({ id: 'review-att', classId: CLASS, childId: child.id, date: TODAY, status: 'PRESENT' });
    db.dailyObservations = (db.dailyObservations || []).filter((r) => !(r.childId === child.id && r.date === TODAY));
  });
  const sheet = await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER);
  const entry = { childId: child.id, ...createGeneralDraft(sheet.rows[0], sheet.mealSessions) };
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [entry], classComment: ` ${NOTE} ` }, TEACHER);
  const loaded = await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER);
  assert.equal(loaded.classComment.text, NOTE);
  assert.equal(loaded.classComment.recordedBy, TEACHER.id);
  assert.ok(loaded.classComment.recordedByName);
  assert.equal(loaded.classComment.updatedAt, NOW);
  assert.equal(loaded.rows[0].recorded, true);
  const childBefore = structuredClone(readDb().dailyObservations);
  const noteOnly = await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: 'Đã ổn định nề nếp.' }, TEACHER);
  assert.equal(noteOnly.saved, 0);
  assert.deepEqual(readDb().dailyObservations, childBefore);
  assert.equal(readDb().classDailyComments.length, 1);
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [{ ...entry, comment: 'Trẻ tích cực.' }] }, TEACHER);
  assert.equal((await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER)).classComment.text, 'Đã ổn định nề nếp.');
});

test('nhận xét lớp không tăng số đã đánh giá; PHT đúng campus/HT đọc được, campus khác bị chặn', async () => {
  const before = await repo.getClassAssessmentOverview({ period: 'DAY', classId: CLASS }, HT);
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: NOTE }, TEACHER);
  const after = await repo.getClassAssessmentOverview({ period: 'DAY', classId: CLASS }, VP);
  assert.equal(after.rows[0].assessed, before.rows[0].assessed);
  assert.equal(after.rows[0].flags, before.rows[0].flags);
  assert.equal(after.rows[0].classComments[0].text, NOTE);
  const detail = await repo.getClassAssessmentDetail({ classId: CLASS, period: 'DAY' }, HT);
  assert.equal(detail.classComments[0].text, NOTE);
  assert.ok(detail.children.every((child) => child.comments.every((c) => c.text !== NOTE)));
  await assert.rejects(
    () => repo.getClassAssessmentDetail({ classId: CLASS, period: 'DAY' }, OTHER_VP),
    (e) => e.status === 403,
  );
  await assert.rejects(
    () => repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: 'Ghi thay' }, VP),
    (e) => e.status === 403,
  );
});

test('tuần/tháng liệt kê đúng ngày, không lấy lớp khác hoặc ngày ngoài kỳ', async () => {
  await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER);
  writeDb((db) => {
    db.assessmentDayUnlocks.push({
      id: 'review-open',
      classId: CLASS,
      date: '2026-10-28',
      campusId: 'c1',
      validUntil: '2026-10-29T05:00:00.000Z',
    });
  });
  await repo.saveDailyGeneral({ classId: CLASS, date: '2026-10-28', entries: [], classComment: 'Nhận xét ngày trước.' }, TEACHER);
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: NOTE }, TEACHER);
  writeDb((db) => {
    db.classDailyComments.push({ classId: CLASS, date: '2026-09-10', text: 'Ngoài tháng', recordedBy: TEACHER.id, updatedAt: NOW });
    db.classDailyComments.push({ classId: 'cls_c2_c1', date: TODAY, text: 'Lớp khác', recordedBy: TEACHER.id, updatedAt: NOW });
  });
  for (const period of ['WEEK', 'MONTH']) {
    const detail = await repo.getClassAssessmentDetail({ classId: CLASS, period }, VP);
    assert.deepEqual(
      detail.classComments.map((n) => n.date),
      [TODAY, '2026-10-28'],
    );
    assert.ok(detail.classComments.every((n) => n.classId === CLASS));
  }
});

test('xóa trắng được, ngày khóa/lớp khác và nhận xét không hợp lệ không ghi dữ liệu', async () => {
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: NOTE }, TEACHER);
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: '' }, TEACHER);
  assert.equal((await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER)).classComment.text, '');
  assert.deepEqual((await repo.getClassAssessmentDetail({ classId: CLASS, period: 'DAY' }, VP)).classComments, []);
  const longComment = 'x'.repeat(10000);
  await repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment: longComment }, TEACHER);
  assert.equal((await repo.getDailyAssessment({ classId: CLASS, date: TODAY }, TEACHER)).classComment.text, longComment);
  for (const classComment of ['Lớp có trẻ tự kỷ']) {
    await assert.rejects(
      () => repo.saveDailyGeneral({ classId: CLASS, date: TODAY, entries: [], classComment }, TEACHER),
      (e) => e.status === 400 && !!e.details.classComment,
    );
  }
  writeDb((db) => {
    db.assessmentDayUnlocks = [];
  });
  await assert.rejects(
    () => repo.saveDailyGeneral({ classId: CLASS, date: '2026-10-28', entries: [], classComment: NOTE }, TEACHER),
    (e) => e.status === 409,
  );
  assert.equal(readDb().classDailyComments.length, 1);
});

test('adapter BE giữ/null không gửi field, chuỗi rỗng xóa, lưu riêng không giả lập dòng trẻ', async () => {
  const calls = [];
  const api = createAssessmentBeApi({
    put: async (url, body) => {
      calls.push({ url, body });
      return { saved: body.entries.length };
    },
  });
  await api.saveDailyGeneral({ classId: '5', date: TODAY, entries: [], classComment: NOTE });
  await api.saveDailyGeneral({ classId: '5', date: TODAY, entries: [], classComment: '' });
  await api.saveDailyGeneral({ classId: '5', date: TODAY, entries: [] });
  await api.saveDailyGeneral({ classId: '5', date: TODAY, entries: [], classComment: null });
  assert.deepEqual(calls[0], { url: '/classes/5/daily-assessment/general', body: { date: TODAY, entries: [], classComment: NOTE } });
  assert.equal(calls[1].body.classComment, '');
  assert.ok(!('classComment' in calls[2].body));
  assert.ok(!('classComment' in calls[3].body));
});

test('transport BE giữ chuỗi rỗng để xóa nhận xét, các trường rỗng khác vẫn đổi null', async () => {
  const axios = (await import('axios')).default;
  const previousAdapter = axios.defaults.adapter;
  const sent = [];
  axios.defaults.adapter = async (config) => {
    if (config.method === 'put') sent.push(JSON.parse(config.data));
    return {
      status: 200,
      statusText: 'OK',
      config,
      headers: {},
      data: { code: 200, desc: 'OK', data: config.method === 'get' ? [] : { saved: 0 } },
    };
  };
  try {
    const { beClient } = await import(new URL('../../src/services/http/beClient.js?class-comment-transport', import.meta.url));
    await createAssessmentBeApi(beClient).saveDailyGeneral({ classId: '5', date: TODAY, entries: [], classComment: '' });
    assert.equal(sent[0].classComment, '');
    await beClient.put('/review', { id: '5', optional: '', classComment: '' });
    assert.deepEqual(sent[1], { id: 5, optional: null, classComment: null });
  } finally {
    axios.defaults.adapter = previousAdapter;
  }
});
