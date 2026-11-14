import test from 'node:test';
import assert from 'node:assert/strict';
import { themeBranchGroups } from '../../src/models/education-plan/classPlan.js';

// Tiền 12/11/2026: tab "Nhánh n · Tuần a+b" gom các tuần của cùng một chủ đề nhánh
const plan = {
  themes: [{ id: 't1', name: 'Trường mầm non', start: '2026-09-07', end: '2026-09-25' }],
  breaks: [],
};

test('nhánh 2 tuần gom thành "Tuần 2+3", tên lấy theo nhánh', () => {
  const branchDoc = {
    schemaVersion: 2,
    branches: [
      { key: 'a', themeId: 't1', startDate: '2026-09-07', endDate: '2026-09-11', name: 'Em yêu trường em' },
      { key: 'b', themeId: 't1', startDate: '2026-09-14', endDate: '2026-09-25', name: 'Em là con vịt' },
    ],
  };
  const groups = themeBranchGroups(plan, branchDoc, 't1');
  assert.deepEqual(
    groups.map((g) => [g.no, g.label, g.name, g.weeks.length]),
    [
      [1, 'Tuần 1', 'Em yêu trường em', 1],
      [2, 'Tuần 2+3', 'Em là con vịt', 2],
    ],
  );
});

test('lịch nhánh cũ (không có branches): mỗi tuần một nhánh, tên theo names', () => {
  const groups = themeBranchGroups(plan, { names: { '2026-09-14': 'Bé đến trường' } }, 't1');
  assert.deepEqual(
    groups.map((g) => [g.label, g.name]),
    [
      ['Tuần 1', ''],
      ['Tuần 2', 'Bé đến trường'],
      ['Tuần 3', ''],
    ],
  );
});
