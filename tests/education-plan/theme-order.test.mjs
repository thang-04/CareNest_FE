import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();

const { moveItem } = await import('@/hooks/useSortableList');
const { buildRefs, toUiGoal, toYearPlanRequest } = await import('@/services/education-plan/api/yearPlanMapper');

const CONFIG = {
  domains: [{ id: 11, name: 'Phát triển thể chất', displayLabel: null, shortLabel: 'Thể chất', sortOrder: 1 }],
  schoolYears: [{ id: 5, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' }],
  ageGroups: [{ id: 3, code: 'ag-3', name: 'Mẫu giáo bé (3–4 tuổi)', shortName: 'Mẫu giáo bé', sortOrder: 2 }],
};
const refs = buildRefs(CONFIG);
const theme = (id, name, abbr) => ({ id, name, abbr, startDate: null, endDate: null, festivals: '', note: '' });
const detail = {
  id: 41,
  code: 'KHNH-2627-MGB',
  schoolYearId: 5,
  schoolYearName: '2026-2027',
  ageGroupId: 3,
  ageGroupName: 'Mẫu giáo bé (3–4 tuổi)',
  title: 'Kế hoạch MGB',
  description: '',
  status: 'DRAFT',
  owner: { userId: 7, name: 'Demo leader', title: 'Tổ trưởng nhóm tuổi', at: null },
  sentBy: null,
  issued: null,
  createdAt: '2026-10-22T03:00:00Z',
  updatedAt: '2026-10-22T03:00:00Z',
  domains: [
    {
      domainId: 11,
      name: 'Phát triển thể chất',
      label: 'Phát triển thể chất',
      rows: [{ id: 101, kind: 'goal', text: 'Trẻ thực hiện đủ động tác', goalNo: 1, contents: [{ id: 200, text: 'Hô hấp', themeIds: [302] }] }],
    },
  ],
  themes: [theme(300, 'Trường mầm non', 'TMN'), theme(301, 'Bản thân', 'BT'), theme(302, 'Gia đình', 'GĐ')],
  breaks: [
    { id: 400, label: 'Tết', startDate: null, endDate: null },
    { id: 401, label: 'Ôn tập', startDate: null, endDate: null },
  ],
  history: [],
  lastReturnNote: null,
  permissions: { canEdit: true, canSubmit: true, canIssue: false, canReturn: false, canDelete: true },
};

test('moveItem: kéo xuống, kéo lên, giữ nguyên phần tử khác', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(moveItem(['a', 'b', 'c', 'd'], 3, 1), ['a', 'd', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b'], 1, 1), ['a', 'b']);
});

test('Đổi thứ tự chủ đề: gửi BE theo thứ tự mới, giữ id và dấu tích', () => {
  const goal = toUiGoal(detail, refs);
  // Chủ đề cuối (Gia đình) chuyển lên đầu
  goal.themes = moveItem(goal.themes, 2, 0);

  const body = toYearPlanRequest(goal, refs);

  assert.deepEqual(
    body.themes.map((t) => [t.id, t.name]),
    [
      [302, 'Gia đình'],
      [300, 'Trường mầm non'],
      [301, 'Bản thân'],
    ],
  );
  const key = body.themes[0].key;
  assert.deepEqual(body.domains[0].rows[0].contents[0].themeKeys, [key]);
});

test('Đổi thứ tự đợt nghỉ: gửi BE theo thứ tự mới', () => {
  const goal = toUiGoal(detail, refs);
  goal.breaks = moveItem(goal.breaks, 0, 1);

  const body = toYearPlanRequest(goal, refs);

  assert.deepEqual(
    body.breaks.map((b) => b.id),
    [401, 400],
  );
});

test('Xóa chủ đề giữa: các chủ đề sau dồn lên và giữ id', () => {
  const goal = toUiGoal(detail, refs);
  goal.themes = goal.themes.filter((t) => t.id !== '301');

  const body = toYearPlanRequest(goal, refs);

  assert.deepEqual(
    body.themes.map((t) => t.id),
    [300, 302],
  );
});
