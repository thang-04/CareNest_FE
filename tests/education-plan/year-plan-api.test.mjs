import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';

globalThis.window = new EventTarget();

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { buildRefs, planSteps, toUiGoal, toYearPlanRequest } = await import('@/services/education-plan/api/yearPlanMapper');
const { educationPlanApi } = await import('@/services/education-plan/api/educationPlanApi');

// Dữ liệu giả theo DTO BE (docs/api/openapi.yaml của CareNest_BE)
const CONFIG = {
  domains: [
    { id: 11, name: 'Phát triển thể chất', displayLabel: null, shortLabel: 'Thể chất', sortOrder: 1 },
    { id: 13, name: 'Phát triển ngôn ngữ', displayLabel: null, shortLabel: 'Ngôn ngữ', sortOrder: 3 },
  ],
  schoolYears: [{ id: 5, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' }],
  ageGroups: [{ id: 3, code: 'ag-3', name: 'Mẫu giáo bé (3–4 tuổi)', shortName: 'Mẫu giáo bé', sortOrder: 2 }],
};
const refs = buildRefs(CONFIG);

const detail = (overrides = {}) => ({
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
      rows: [
        { id: 100, kind: 'sub', text: 'Phát triển vận động', goalNo: null, contents: [] },
        { id: 101, kind: 'goal', text: 'Trẻ thực hiện đủ động tác', goalNo: 1, contents: [{ id: 200, text: 'Hô hấp', themeIds: [300] }] },
      ],
    },
  ],
  themes: [{ id: 300, name: 'Trường mầm non', abbr: 'TMN', startDate: '2026-09-07', endDate: '2026-09-25', festivals: '', note: '' }],
  breaks: [],
  history: [],
  lastReturnNote: null,
  permissions: { canEdit: true, canSubmit: true, canIssue: false, canReturn: false, canDelete: true },
  ...overrides,
});

test('BE → UI: id thành chuỗi, mã nhóm tuổi, năm học có gạch dài, số MT', () => {
  const goal = toUiGoal(detail(), refs);

  assert.equal(goal.id, '41');
  assert.equal(goal.ageGroupId, 'ag-3');
  assert.equal(goal.schoolYear, '2026 – 2027');
  assert.deepEqual(goal.domains[0].rows[1].contents[0].themes, ['300']);
  assert.equal(goal.domains[0].items[0].code, 'MT1');
  assert.equal(goal.themes[0].start, '2026-09-07');
});

test('UI → BE: id UI tự sinh gửi null, tích chủ đề theo key, lĩnh vực theo id', () => {
  const goal = toUiGoal(detail(), refs);
  goal.themes.push({ id: 'k9x2', name: 'Gia đình', abbr: 'GĐ', start: '', end: '', festivals: '', note: '' });
  goal.domains[0].rows[1].contents.push({ id: 'n1', text: 'Đi bước dồn', themes: ['k9x2'] });

  const body = toYearPlanRequest(goal, refs);

  assert.equal(body.schoolYearId, 5);
  assert.equal(body.ageGroupId, 3);
  assert.equal(body.domains[0].domainId, 11);
  assert.deepEqual(body.domains[0].rows[1].contents[1], { id: null, text: 'Đi bước dồn', themeKeys: ['k9x2'] });
  assert.deepEqual(
    body.themes.map((t) => [t.key, t.id]),
    [
      ['300', 300],
      ['k9x2', null],
    ],
  );
});

test('trạng thái UI → endpoint hành động của BE', () => {
  const draft = { status: 'DRAFT', permissions: { canEdit: true } };
  const pending = { status: 'PENDING_VP', permissions: { canEdit: true } };

  assert.deepEqual(planSteps(null, { status: 'DRAFT' }).map((s) => s.call), ['create']);
  assert.deepEqual(planSteps(draft, { status: 'DRAFT' }).map((s) => s.call), ['update']);
  assert.deepEqual(planSteps(draft, { status: 'PENDING_VP', history: [] }).map((s) => s.call), ['update', 'submit']);
  assert.deepEqual(planSteps(draft, { status: 'PENDING_VP', history: [] }, false).map((s) => s.call), ['submit']);
  // Phó HT ban hành / trả lại ở trang chi tiết: không lưu lại nội dung
  assert.deepEqual(planSteps(pending, { status: 'APPROVED', history: [] }, false).map((s) => s.call), ['issue']);
  assert.deepEqual(
    planSteps(pending, { status: 'REJECTED', history: [{ note: 'Sửa MT' }] }),
    [{ call: 'return', note: 'Sửa MT' }],
  );
});

test('lưu kế hoạch mới: POST rồi trả bản BE (id thật), bóc envelope { code, desc, data }', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const envelope = (data, status = 200) => ({ status, statusText: 'OK', headers: {}, config, data: { code: status, desc: 'ok', data } });
    if (config.url === '/education-plans/config') return envelope(CONFIG);
    if (config.method === 'post' && config.url === '/education-plans/goals') return envelope(detail(), 201);
    throw new AxiosError('Not found', AxiosError.ERR_BAD_REQUEST, config, null, {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
      data: { code: 404, desc: 'Year plan not found', data: null },
    });
  };

  const draft = { ...toUiGoal(detail(), refs), id: 'g-abc1234', status: 'DRAFT' };
  const saved = await educationPlanApi.saveGoal(draft);

  assert.equal(saved.id, '41');
  assert.deepEqual(calls, ['GET /education-plans/config', 'POST /education-plans/goals']);
  // Lỗi của BE đọc từ desc
  await assert.rejects(axiosClient.get('/education-plans/goals/999'), { status: 404, message: 'Year plan not found' });
});
