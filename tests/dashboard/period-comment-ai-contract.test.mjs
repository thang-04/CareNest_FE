import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAssessmentBeApi } from '@/services/assessment/api/assessmentApi';

test('period comment UI sends an explicit AI request and keeps template redraft available', async () => {
  const calls = [];
  const api = createAssessmentBeApi({
    get: (...args) => {
      calls.push(['GET', ...args]);
      return Promise.resolve([]);
    },
    post: (...args) => {
      calls.push(['POST', ...args]);
      return Promise.resolve({ aiDraft: { source: 'TEMPLATE' } });
    },
  });

  await api.getEvaluations('monthly', { schoolYear: 1 });
  await api.getEvaluations('semester', { schoolYear: 1 });
  await api.regenerateEvaluationDraft('monthly', 369, null, true);
  await api.regenerateEvaluationDraft('monthly', 369, null, false);

  assert.deepEqual(calls, [
    ['GET', '/assessment/evaluations', { params: { periodType: 'MONTH', schoolYearId: 1, classId: undefined } }],
    ['GET', '/assessment/evaluations', { params: { periodType: 'SEMESTER', schoolYearId: 1, classId: undefined } }],
    ['POST', '/assessment/evaluations/369/redraft', { ai: true }],
    ['POST', '/assessment/evaluations/369/redraft', undefined],
  ]);
});
