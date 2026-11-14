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
const { EVALUATION_LOCK_KINDS, OVERDUE_KIND_LABELS, lockedPeriods, reopenFormErrors } = await import(
  '@/models/assessment/evaluationLocks.mjs'
);

const fakeClient = () => {
  const calls = [];
  const respond = (method, url, body, config) => {
    calls.push({ method, url, body, params: config?.params });
    return Promise.resolve([]);
  };
  return {
    calls,
    get: (url, config) => respond('get', url, undefined, config),
    post: (url, body, config) => respond('post', url, body, config),
  };
};

test('BE OBS-30: kỳ của lớp, mở lại lớp – kỳ, kết thúc sớm, lớp quá hạn gọi đúng endpoint', async () => {
  const client = fakeClient();
  const api = createAssessmentBeApi(client);
  await api.getEvaluationPeriods({ classId: '5' });
  await api.unlockEvaluation({
    kind: 'SEMESTER',
    classId: '5',
    periodKey: '1',
    validUntil: '2026-11-03T10:00:00.000Z',
    reason: 'Cô nghỉ ốm',
  });
  await api.listEvaluationUnlocks({ kind: 'THEME', active: true });
  await api.revokeEvaluationUnlock('7');
  await api.getOverdueClasses({ campusId: '2' });
  assert.deepEqual(
    client.calls.map((c) => `${c.method} ${c.url}`),
    [
      'get /assessment/evaluation-periods',
      'post /assessment/evaluation-unlocks',
      'get /assessment/evaluation-unlocks',
      'post /assessment/evaluation-unlocks/7/revoke',
      'get /assessment/overdue',
    ],
  );
  assert.deepEqual(client.calls[1].body, {
    kind: 'SEMESTER',
    classId: '5',
    periodKey: '1',
    validUntil: '2026-11-03T10:00:00.000Z',
    reason: 'Cô nghỉ ốm',
  });
  assert.deepEqual(client.calls[2].params, { campusId: undefined, classId: undefined, kind: 'THEME', active: true });
  assert.deepEqual(client.calls[4].params, { campusId: '2' });
  assert.equal(BE_ERROR_FIELDS[7405], 'periodKey');
  assert.equal(BE_ERROR_FIELDS[7406], 'periodKey');
  assert.equal(BE_ERROR_FIELDS[7408], 'periodKey');
});

test('Chọn kỳ mở lại: chỉ kỳ đã khóa, chưa đang mở lại, đúng loại', () => {
  const periods = [
    { kind: 'SEMESTER', periodKey: '1', locked: true, unlockedUntil: null },
    { kind: 'SEMESTER', periodKey: '2', locked: false, unlockedUntil: null },
    { kind: 'THEME', periodKey: '9', locked: true, unlockedUntil: null },
    { kind: 'YEAR', periodKey: 'Y', locked: true, unlockedUntil: '2026-11-20T10:00:00Z' },
  ];
  assert.deepEqual(
    lockedPeriods(periods, 'SEMESTER').map((p) => p.periodKey),
    ['1'],
  );
  assert.deepEqual(
    lockedPeriods(periods, 'THEME').map((p) => p.periodKey),
    ['9'],
  );
  assert.deepEqual(lockedPeriods(periods, 'YEAR'), []);
  assert.deepEqual(
    EVALUATION_LOCK_KINDS.map((k) => k.value),
    ['THEME', 'SEMESTER', 'YEAR'],
  );
  assert.equal(OVERDUE_KIND_LABELS.WEEKLY, 'Nhận xét tuần');
});

test('Form mở lại kỳ: bắt buộc lớp, kỳ, hạn, lý do ≤ 300 ký tự', () => {
  assert.deepEqual(reopenFormErrors({ classId: '', periodKey: '', validUntilOk: false, reason: ' ' }), {
    classId: 'Chọn lớp.',
    validUntil: 'Chọn ngày giờ hết hạn.',
    reason: 'Nhập lý do mở lại.',
  });
  assert.equal(
    reopenFormErrors({ classId: '5', periodKey: '', validUntilOk: true, reason: 'x' }, { hasLocked: false }).periodKey,
    'Lớp chưa có kỳ nào đã khóa.',
  );
  assert.equal(
    reopenFormErrors({ classId: '5', periodKey: '1', validUntilOk: true, reason: 'a'.repeat(301) }).reason,
    'Lý do tối đa 300 ký tự.',
  );
  assert.deepEqual(reopenFormErrors({ classId: '5', periodKey: '1', validUntilOk: true, reason: 'Cô nghỉ ốm' }), {});
});
