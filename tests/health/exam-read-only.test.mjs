import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) ?? null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: (k) => values.delete(k),
};
globalThis.window = new EventTarget();
const { resetDb, writeDb } = await import('@/mocks/mockDatabase');
const { ensureChildRecordsSeeded } = await import('@/services/children/mock/childrenMockRepository');
const { healthExamMockRepository: exams } = await import('@/services/children/mock/healthExamMockRepository');
const { healthCheckMockRepository: checks } = await import('@/services/children/mock/healthCheckMockRepository');
const { todayInput, addDays } = await import('@/utils/format');
const { buildEmptyExam } = await import('@/models/children/healthExamForm');
const teacher = { id: 'readonly_teacher', role: 'TEACHER', campusId: 'c1' };
let childId, classId, targetId;
beforeEach(() => {
  resetDb();
  ensureChildRecordsSeeded();
  writeDb((db) => {
    const [cls, target] = db.classes.filter((c) => c.campusId === 'c1');
    cls.teacherIds = [teacher.id];
    target.teacherIds = [];
    const child = db.children.find((c) => c.classId === cls.id && c.status === 'ACTIVE');
    childId = child.id;
    classId = cls.id;
    targetId = target.id;
    db.healthMeasurements = db.healthMeasurements.filter((m) => !(m.childId === childId && m.campaignId === 'hc_c1_open'));
    db.healthMeasurements.push({
      id: 'readonly_exam',
      childId,
      campaignId: 'hc_c1_open',
      date: addDays(todayInput(), -3),
      exam: buildEmptyExam(),
      examStatus: 'DRAFT',
      heightCm: 100,
      weightKg: 16,
    });
  });
});
test('left child retains an accessible locked exam and read-only roster action', async () => {
  writeDb((db) => {
    db.children.find((c) => c.id === childId).status = 'LEFT';
  });
  const view = await exams.getHealthExam('hc_c1_open', childId, teacher);
  assert.equal(view.canEdit, false);
  assert.equal(view.locked, true);
  const row = (await checks.getHealthCheckClass('hc_c1_open', classId, teacher)).children.find((r) => r.childId === childId);
  assert.equal(row.canEdit, false);
  await assert.rejects(exams.saveHealthExam('hc_c1_open', childId, {}, teacher), (e) => e.status === 403);
});
test('former teacher can read a recorded exam after a class transfer', async () => {
  writeDb((db) => {
    db.childPlacements.push({
      id: 'readonly_move',
      childId,
      fromClassId: classId,
      toClassId: targetId,
      effectiveFrom: addDays(todayInput(), -1),
    });
    db.children.find((c) => c.id === childId).classId = targetId;
  });
  const view = await exams.getHealthExam('hc_c1_open', childId, teacher);
  assert.equal(view.canEdit, false);
  assert.equal(view.locked, true);
});
test('exam access state depends on a failed request rather than edit permission', () => {
  const page = readFileSync('src/pages/children/HealthExamFormPage.jsx', 'utf8');
  assert.match(page, /if \(error \|\| !view\)/);
  assert.match(page, /if \(!editable\)/);
  const roster = readFileSync('src/components/children/HealthCheckClassRoster.jsx', 'utf8');
  assert.match(roster, /r\.canEdit && !yearLocked/);
  assert.ok(roster.includes('Xem phiếu'));
});
