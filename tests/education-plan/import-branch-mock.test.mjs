import assert from 'node:assert/strict';
import { test } from 'node:test';
globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
const { readDb, writeDb } = await import('../../src/mocks/mockDatabase.js');
const { classPlanMockRepository } = await import('../../src/services/education-plan/mock/classPlanMockRepository.js');
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
test('mock CSV dùng tuần hệ thống, chuẩn hóa chủ đề, không ghi nháp', async () => {
  const before = JSON.stringify(readDb());
  const file = new File(['Chủ đề,Chủ đề nhánh,Ngày\nMẫu,Một,1999-01-01\nmẫu,Hai,1999-01-02\nLạ,Ba,1999-01-03'], 'branch.csv');
  const result = await classPlanMockRepository.previewBranchFile(file, { classId: 'class-test', yearPlanId: 'plan-test' }, user);
  assert.deepEqual(
    result.matches.map((m) => [m.weekStart, m.name]),
    [
      ['2026-09-07', 'Một'],
      ['2026-09-14', 'Hai'],
    ],
  );
  assert.equal(result.warnings.length, 1);
  assert.equal(JSON.stringify(readDb()), before);
});
test('mock kiểm giáo viên và hướng dẫn Word/Excel dùng BE thật', async () => {
  const context = { classId: 'class-test', yearPlanId: 'plan-test' };
  await assert.rejects(classPlanMockRepository.previewBranchFile(new File([], 'x.csv'), context, { id: 999 }), /giáo viên/);
  await assert.rejects(classPlanMockRepository.previewBranchFile(new File([], 'x.doc'), context, user), { status: 400, errorCode: 7124 });
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

test('mock bỏ dòng nghỉ/ôn tập và nhãn số nhánh như BE, không chiếm tuần', async () => {
  const file = new File(
    ['Chủ đề,Chủ đề nhánh\nMẫu,Nghỉ lễ\n,Ôn tập\n,Từ 10/09 nghỉ lễ\n,11/09 ôn tập\n,Nhánh 1: Một\n,Nhánh 1. Hai'],
    'branch.csv',
  );
  const result = await classPlanMockRepository.previewBranchFile(file, { classId: 'class-test', yearPlanId: 'plan-test' }, user);
  assert.deepEqual(
    result.matches.map((m) => [m.weekStart, m.name]),
    [
      ['2026-09-07', 'Một'],
      ['2026-09-14', 'Hai'],
    ],
  );
  assert.deepEqual(result.warnings, []);
});

test('mock file lỗi trả đúng HTTP400 và errorCode7124/7125/7126', async () => {
  const context = { classId: 'class-test', yearPlanId: 'plan-test' };
  for (const [file, errorCode] of [
    [null, 7124],
    [new File([], 'empty.csv'), 7124],
    [new File(['x'], 'x.docx'), 7124],
    [new File(['x'], 'bad.csv'), 7125],
    [new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.csv'), 7126],
    [new File(['Chủ đề,Chủ đề nhánh\n' + 'Mẫu,Tên\n'.repeat(2000)], 'rows.csv'), 7126],
  ]) {
    await assert.rejects(classPlanMockRepository.previewBranchFile(file, context, user), { status: 400, errorCode });
  }
});

test('mock kiểm role giáo viên và cùng năm học như BE', async () => {
  const context = { classId: 'class-test', yearPlanId: 'plan-test' };
  const file = new File(['Chủ đề,Chủ đề nhánh\nMẫu,Một'], 'x.csv');
  await assert.rejects(classPlanMockRepository.previewBranchFile(file, context, { ...user, role: 'VICE_PRINCIPAL' }), {
    status: 403,
    errorCode: 7103,
  });
  writeDb((db) => {
    db.classes[0].schoolYear = '2025-2026';
  });
  try {
    await assert.rejects(classPlanMockRepository.previewBranchFile(file, context, user), { status: 400, errorCode: 7108 });
  } finally {
    writeDb((db) => {
      db.classes[0].schoolYear = '2026-2027';
    });
  }
});

test('mock kế hoạch sai nhóm tuổi hoặc chưa ban hành trả mã lỗi BE', async () => {
  const context = { classId: 'class-test', yearPlanId: 'plan-test' };
  const file = new File(['Chủ đề,Chủ đề nhánh\nMẫu,Một'], 'x.csv');
  for (const [field, value, status, errorCode] of [
    ['ageGroupId', 'ag-other', 400, 7108],
    ['status', 'DRAFT', 409, 7109],
  ]) {
    const previous = readDb().eduGoals[0][field];
    writeDb((db) => {
      db.eduGoals[0][field] = value;
    });
    try {
      await assert.rejects(classPlanMockRepository.previewBranchFile(file, context, user), { status, errorCode });
    } finally {
      writeDb((db) => {
        db.eduGoals[0][field] = previous;
      });
    }
  }
});
