import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGeneralDraft, getGeneralSaveEntries } from '@/utils/assessment/dailyGeneralDraft';
import { createAssessmentBeApi } from '@/services/assessment/api/assessmentApi';

const row = (childId, recorded = false) => ({
  childId,
  recorded,
  health: { signs: [], note: '', overridden: false },
  meals: {},
  nap: null,
  emotion: null,
  participation: null,
  behaviors: [],
  behaviorNote: '',
  flag: null,
  comment: '',
});
const sessions = ['LUNCH', 'AFTERNOON'];

test('lần đầu có thể lưu cả ba trẻ với giá trị mặc định dù chưa chỉnh ô nào', () => {
  const rows = [row('1'), row('2'), row('3')];
  const snapshot = structuredClone(rows);
  const entries = getGeneralSaveEntries(rows, sessions, {}, new Set());
  assert.deepEqual(
    entries.map((entry) => entry.childId),
    ['1', '2', '3'],
  );
  for (const entry of entries) {
    assert.deepEqual(entry.meals, { LUNCH: 'AN_HET', AFTERNOON: 'AN_HET' });
    assert.equal(entry.nap, 'NGU_TOT');
    assert.equal(entry.emotion, 'HAPPY');
    assert.equal(entry.participation, 'BINH_THUONG');
    assert.equal(entry.flag, false);
    assert.deepEqual(entry.behaviors, []);
  }
  assert.deepEqual(rows, snapshot);
});

test('lưu chung trẻ mới và trẻ đã sửa, giữ giá trị đã nhập và không gửi trùng trẻ', () => {
  const rows = [row('1', true), row('2'), row('3', true)];
  const drafts = {
    3: {
      ...createGeneralDraft(rows[2], sessions),
      nap: 'NGU_IT',
      comment: 'Ngủ ít hơn thường ngày',
      emotion: 'SAD',
      participation: 'BINH_THUONG',
    },
  };
  const entries = getGeneralSaveEntries(rows, sessions, drafts, new Set(['3']));
  assert.deepEqual(
    entries.map((entry) => entry.childId),
    ['2', '3'],
  );
  assert.equal(entries[0].nap, 'NGU_TOT');
  assert.equal(entries[1].nap, 'NGU_IT');
  assert.equal(entries[1].comment, drafts[3].comment);
  assert.equal(entries[1].emotion, 'SAD');
  assert.equal(entries[1].participation, 'BINH_THUONG');
});

test('sau tải lại phiếu đã lưu thì không gửi lại trẻ chưa sửa', () => {
  const rows = [row('1', true), row('2', true), row('3', true)];
  assert.deepEqual(getGeneralSaveEntries(rows, sessions, {}, new Set()), []);
  const draft = { ...createGeneralDraft(rows[1], sessions), flag: true };
  assert.deepEqual(getGeneralSaveEntries(rows, sessions, { 2: draft }, new Set(['2'])), [{ childId: '2', ...draft }]);
});

test('lớp rỗng không lưu và không gửi draft của lớp hoặc ngày cũ', () => {
  const oldDraft = { old: { comment: 'Dữ liệu nháp khác' } };
  assert.deepEqual(getGeneralSaveEntries([], sessions, oldDraft, new Set(['old'])), []);
  const entries = getGeneralSaveEntries([row('new')], sessions, oldDraft, new Set(['old']));
  assert.deepEqual(
    entries.map((entry) => entry.childId),
    ['new'],
  );
});

test('API General nhận đủ các dòng mặc định mà không tự chấm mục tiêu kỹ năng', async () => {
  const rows = [row('1'), row('2')];
  const calls = [];
  const api = createAssessmentBeApi({
    put: async (url, body) => {
      calls.push({ url, body });
      return { saved: body.entries.length };
    },
  });
  const entries = getGeneralSaveEntries(rows, sessions, {}, new Set());
  const result = await api.saveDailyGeneral({ classId: '5', date: '2026-10-29', entries });
  assert.equal(result.saved, 2);
  assert.equal(calls[0].url, '/classes/5/daily-assessment/general');
  assert.equal(calls[0].body.date, '2026-10-29');
  assert.deepEqual(
    calls[0].body.entries.map((entry) => entry.childId),
    ['1', '2'],
  );
  for (const entry of calls[0].body.entries) {
    assert.deepEqual(entry.meals, { LUNCH: 'AN_HET', AFTERNOON: 'AN_HET' });
    assert.equal(entry.nap, 'NGU_TOT');
    assert.equal(entry.emotion, 'HAPPY');
    assert.equal(entry.participation, 'BINH_THUONG');
    assert.ok(!('activities' in entry));
    assert.ok(!('goalsMet' in entry));
  }
});

test('giữ mức tham gia đã lưu, không tự bổ sung giá trị cho bản cũ đã ghi nhận', () => {
  for (const participation of ['TICH_CUC', 'BINH_THUONG', 'CHUA_TICH_CUC']) {
    assert.equal(createGeneralDraft({ ...row('saved', true), participation }, sessions).participation, participation);
  }
  assert.equal(createGeneralDraft(row('saved', true), sessions).participation, '');
});
