import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const { writeDb } = await import('@/mocks/mockDatabase');
const { withDefaults } = await import('@/models/education-plan/eduConfig');

const principal = { id: 'pp-principal', role: 'PRINCIPAL', fullName: 'HT thử', status: 'ACTIVE' };
const vp = { id: 'pp-vp', role: 'VICE_PRINCIPAL', fullName: 'PHT thử', status: 'ACTIVE' };
const seed = (theme, status = 'DRAFT') =>
  writeDb((db) => {
    const cfg = withDefaults();
    db.eduConfig = { ...cfg, workflowPolicy: { ...cfg.workflowPolicy, theme } };
    db.users = [principal, vp];
    db.classes = [{ id: 'pp-class', teacherIds: [], homeroomTeacherId: null, ageGroupId: 'pp-age', schoolYear: 'pp-year' }];
    db.eduGoals = [
      { id: 'pp-plan', planLevel: 'TEAM', status: 'APPROVED', ageGroupId: 'pp-age', schoolYear: 'pp-year', themes: [], domains: [] },
    ];
    db.eduClassBranch = [];
    db.eduClassWeek = [];
    db.eduClassTheme = [
      {
        id: 'pp-theme',
        kind: 'theme',
        classId: 'pp-class',
        yearPlanId: 'pp-plan',
        themeId: 'pp-t',
        status,
        version: 0,
        authorIds: [principal.id],
      },
    ];
  });

test('HT bấm Ban hành kế hoạch năm/tổ ⇒ hook nạp lại như khi duyệt; API gọi /principal-publish', () => {
  const hook = readFileSync(new URL('../../src/hooks/education-plan/useEducationPlan.jsx', import.meta.url), 'utf8');
  assert.match(hook, /reviewAction = \['approve', 'reject', 'publish'\]\.includes\(options\.action\)/);
  const api = readFileSync(new URL('../../src/services/education-plan/api/educationPlanApi.js', import.meta.url), 'utf8');
  assert.match(api, /publish: 'principal-publish'/);
});
