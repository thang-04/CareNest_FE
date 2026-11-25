import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const { readDb, writeDb } = await import('../../src/mocks/mockDatabase.js');
const user = { id: 700, role: 'TEACHER' };
writeDb((db) => {
  db.classes = [{ id: 'class-test', ageGroupId: 'ag-test', schoolYear: '2026-2027', teacherIds: [700] }];
  db.eduGoals = [
    {
      id: 'plan-test',
      ageGroupId: 'ag-test',
      schoolYear: '2026 – 2027',
      status: 'APPROVED',
      themes: [{ id: 'theme-test', name: 'Mẫu', start: '2026-09-07', end: '2026-09-18' }],
      breaks: [],
    },
  ];
  db.eduClassBranch = [];
});
test('parser CSV chung giữ nguyên export tuyển sinh: BOM, dấu phân cách, quote và xuống dòng', async () => {
  const shared = await import('../../src/utils/csv.js');
  const enrollment = await import('../../src/services/children/mock/enrollmentImport.js');
  assert.equal(enrollment.parseCsv, shared.parseCsv);
  assert.deepEqual(shared.parseCsv('\uFEFFChủ đề;Chủ đề nhánh\r\n"Mẫu; A";"Tên ""nhánh""\nxuống dòng"\r\n'), [
    ['Chủ đề', 'Chủ đề nhánh'],
    ['Mẫu; A', 'Tên "nhánh"\nxuống dòng'],
  ]);
});
