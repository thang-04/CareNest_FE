import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

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
const { readDb, writeDb } = await import('@/mocks/mockDatabase');

/** Client giả: ghi lại lời gọi, trả dữ liệu đã bóc envelope và đổi id như beClient (id / xxxId số → chuỗi). */
const fakeClient = (responses = {}) => {
  const calls = [];
  const respond = (method, url, body, config) => {
    calls.push({ method, url, body, params: config?.params });
    const r = responses[`${method} ${url}`];
    return Promise.resolve(typeof r === 'function' ? r(body, config) : r);
  };
  return {
    calls,
    get: (url, config) => respond('get', url, undefined, config),
    post: (url, body, config) => respond('post', url, body, config),
    put: (url, body, config) => respond('put', url, body, config),
  };
};

const SHEET = {
  classId: '5',
  className: 'Chồi 1',
  campusId: '1',
  date: '2026-10-27',
  today: '2026-10-28',
  yearStart: '2026-09-05',
  canRecord: true,
  yearReadOnly: false,
  locked: false,
  unlock: null,
  attendanceTaken: true,
  mealSessions: ['LUNCH'],
  lesson: {
    classDocId: '9',
    weekStart: '2026-10-26',
    date: '2026-10-27',
    weekLabel: 'Tuần 8',
    activities: [{ key: 'hoc', label: 'Hoạt động học', topic: 'Toán', goals: [{ id: '11', goalNo: 3, text: 'Đếm đến 5' }] }],
  },
  rows: [
    {
      childId: '21',
      fullName: 'Bé A',
      attendanceStatus: 'PRESENT',
      health: { signs: ['TIRED'], note: null, overridden: false, prefillSigns: ['TIRED'] },
      meals: null,
      nap: null,
      emotion: null,
      behaviors: null,
      behaviorNote: null,
      flag: null,
      comment: null,
      recorded: true,
      // beClient không đổi phần tử của goalsMet (không phải khóa Ids): còn là số
      activities: [{ key: 'hoc', participation: 'TICH_CUC', goalsMet: [11], goalsEffort: [], goalsNotMet: null, updatedAt: null }],
    },
  ],
};

beforeEach(() => values.clear());

test('BE: phiếu đánh giá ngày giữ dạng DailySheetResponse, id MT đã chấm cùng kiểu với goals[].id', async () => {
  const client = fakeClient({ 'get /classes/5/daily-assessment': SHEET });
  const sheet = await createAssessmentBeApi(client).getDailyAssessment({ classId: '5', date: '2026-10-27' });
  assert.deepEqual(client.calls[0].params, { date: '2026-10-27' });
  const row = sheet.rows[0];
  assert.deepEqual(row.activities[0].goalsMet, ['11']);
  assert.deepEqual(row.activities[0].goalsNotMet, []);
  assert.equal(row.activities[0].goalsMet[0], sheet.lesson.activities[0].goals[0].id);
  assert.deepEqual(row.behaviors, []);
  assert.deepEqual(row.meals, {});
  assert.deepEqual(row.health.prefillSigns, ['TIRED']);
});

test('BE: lesson null (chưa có giáo án duyệt) giữ null để khóa view Kiến thức kỹ năng', async () => {
  const client = fakeClient({ 'get /classes/5/daily-assessment': { ...SHEET, lesson: null, rows: [], attendanceTaken: false } });
  const sheet = await createAssessmentBeApi(client).getDailyAssessment({ classId: '5', date: '2026-10-27' });
  assert.equal(sheet.lesson, null);
  assert.equal(sheet.attendanceTaken, false);
  assert.deepEqual(sheet.rows, []);
});

test('BE: lưu Hoạt động chung gửi đúng body, kèm Tham gia cả ngày; nhận xét luôn gửi (1 nhận xét / trẻ / ngày)', async () => {
  const client = fakeClient({ 'put /classes/5/daily-assessment/general': { saved: 1, savedAt: '2026-10-27T09:00:00Z' } });
  await createAssessmentBeApi(client).saveDailyGeneral({
    classId: '5',
    date: '2026-10-27',
    entries: [
      {
        childId: '21',
        healthOverridden: true,
        healthSigns: ['FEVER'],
        meals: { LUNCH: 'AN_IT' },
        nap: '',
        emotion: 'HAPPY',
        participation: 'TICH_CUC',
        flag: true,
      },
      { childId: '22', participation: '' },
    ],
  });
  const body = client.calls[0].body;
  assert.equal(body.date, '2026-10-27');
  assert.deepEqual(body.entries[0], {
    childId: '21',
    healthOverridden: true,
    healthSigns: ['FEVER'],
    healthNote: '',
    meals: { LUNCH: 'AN_IT' },
    nap: null,
    emotion: 'HAPPY',
    participation: 'TICH_CUC',
    behaviors: [],
    behaviorNote: '',
    flag: true,
    comment: '',
  });
  // Chưa chọn mức tham gia ⇒ null; chỉ một lần gọi API Hoạt động chung, không đi qua API Kiến thức kỹ năng
  assert.equal(body.entries[1].participation, null);
  assert.equal(client.calls.length, 1);
});

test('BE: lưu Kiến thức kỹ năng chỉ gửi MT cô đã chọn (id số), không tự điền Đạt; comment null = giữ', async () => {
  const client = fakeClient({ 'put /classes/5/daily-assessment/skills': { saved: 1 } });
  await createAssessmentBeApi(client).saveDailySkills({
    classId: '5',
    date: '2026-10-27',
    entries: [{ childId: '21', comment: null, activities: [{ key: 'hoc', participation: '', goalsNotMet: ['11'] }] }],
  });
  assert.deepEqual(client.calls[0].body.entries[0], {
    childId: '21',
    comment: null,
    activities: [{ key: 'hoc', participation: null, goalsMet: [], goalsEffort: [], goalsNotMet: [11] }],
  });
});

test('BE: lịch sử mở lại gửi bộ lọc campusId / classId / active / from / to, bỏ ô trống', async () => {
  const client = fakeClient({ 'get /assessment/day-unlocks': [] });
  const api = createAssessmentBeApi(client);
  await api.listAssessmentDayUnlocks({ campusId: '2', classId: '', active: false, from: '2026-10-01', to: '' });
  assert.deepEqual(client.calls[0].params, { campusId: '2', classId: undefined, active: false, from: '2026-10-01', to: undefined });
  await api.unlockAssessmentDay({ classId: '5', date: '2026-10-20', validUntil: '2026-10-28T10:00:00.000Z', reason: 'Quên lưu', extra: 1 });
  assert.deepEqual(client.calls[1].body, { classId: '5', date: '2026-10-20', validUntil: '2026-10-28T10:00:00.000Z', reason: 'Quên lưu' });
  await api.revokeAssessmentDayUnlock('7');
  assert.equal(client.calls[2].url, '/assessment/day-unlocks/7/revoke');
});

test('BE: tổng quan ghép tên điểm trường / nhóm tuổi (BE trả name null)', async () => {
  const client = fakeClient({
    'get /assessment/overview': {
      period: 'WEEK',
      campuses: [{ id: '1', name: null }],
      ageGroups: [{ id: '3', name: null }],
      classes: [],
      rows: [],
      totals: {},
    },
    'get /campuses': [{ id: '1', name: 'Điểm chính' }],
    'get /age-groups': [{ id: '3', name: 'Mẫu giáo nhỡ' }],
  });
  const o = await createAssessmentBeApi(client).getClassAssessmentOverview({ period: 'WEEK', schoolYear: '2026-2027', campusId: '' });
  assert.deepEqual(client.calls[0].params, {
    period: 'WEEK',
    schoolYearId: '2026-2027',
    campusId: undefined,
    ageGroupId: undefined,
    classId: undefined,
  });
  assert.equal(o.campuses[0].name, 'Điểm chính');
  assert.equal(o.ageGroups[0].name, 'Mẫu giáo nhỡ');
});

test('mã lỗi đánh giá gắn đúng ô: 7316 hạn, 7314/7315/7317 ngày, 7311 nhận xét, 7307 dòng trẻ', () => {
  assert.equal(BE_ERROR_FIELDS[7316], 'validUntil');
  for (const code of [7314, 7315, 7317]) assert.equal(BE_ERROR_FIELDS[code], 'date');
  assert.equal(BE_ERROR_FIELDS[7311], 'comment');
  assert.equal(BE_ERROR_FIELDS[7307], 'row');
});

test('mock cùng dạng BE: chỉ trẻ có mặt, lưu Kiến thức kỹ năng không tự ghi Đạt', async () => {
  const TEACHER = { id: 'u_minhanh', role: 'TEACHER', campusId: 'c1' };
  const today = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  if ([0, 6].includes(today.getDay())) return;
  await repo.getDailyAssessment({ classId: 'cls_c1_c1', date }, TEACHER);
  // Lớp có 2 trẻ: 1 có mặt, 1 vắng ⇒ phiếu chỉ có trẻ có mặt
  const kids = readDb().children.filter((c) => c.classId === 'cls_c1_c1' && c.status === 'ACTIVE');
  writeDb((db) => {
    db.attendance = (db.attendance || []).filter((r) => !(r.classId === 'cls_c1_c1' && r.date === date));
    db.attendance.push({ id: 'att_t1', classId: 'cls_c1_c1', childId: kids[0].id, date, status: 'PRESENT' });
    db.attendance.push({ id: 'att_t2', classId: 'cls_c1_c1', childId: kids[1].id, date, status: 'ABSENT' });
  });
  const sheet = await repo.getDailyAssessment({ classId: 'cls_c1_c1', date }, TEACHER);
  assert.equal(sheet.attendanceTaken, true);
  assert.deepEqual(
    sheet.rows.map((r) => r.childId),
    [kids[0].id],
  );
  assert.ok('lesson' in sheet && 'canRecord' in sheet && 'yearReadOnly' in sheet);
  const act = sheet.lesson?.activities.find((a) => a.goals.length);
  const row = sheet.rows[0];
  if (!act) return;
  const goal = act.goals[0];
  await repo.saveDailySkills(
    {
      classId: 'cls_c1_c1',
      date,
      entries: [{ childId: row.childId, comment: null, activities: [{ key: act.key, goalsNotMet: [goal.id] }] }],
    },
    TEACHER,
  );
  const after = await repo.getDailyAssessment({ classId: 'cls_c1_c1', date }, TEACHER);
  const saved = after.rows.find((r) => r.childId === row.childId).activities.find((a) => a.key === act.key);
  assert.deepEqual(saved.goalsNotMet, [goal.id]);
  assert.deepEqual(saved.goalsMet, []);
});
