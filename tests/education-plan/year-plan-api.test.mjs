import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AxiosError } from 'axios';

globalThis.window = new EventTarget();

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { buildRefs, planSteps, toUiEduConfig, toUiGoal, toYearPlanRequest } = await import('@/services/education-plan/api/yearPlanMapper');
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

  assert.deepEqual(
    planSteps(null, { status: 'DRAFT' }).map((s) => s.call),
    ['create'],
  );
  assert.deepEqual(
    planSteps(draft, { status: 'DRAFT' }).map((s) => s.call),
    ['update'],
  );
  assert.deepEqual(
    planSteps(draft, { status: 'PENDING_VP', history: [] }).map((s) => s.call),
    ['update', 'submit'],
  );
  assert.deepEqual(
    planSteps(draft, { status: 'PENDING_VP', history: [] }, false).map((s) => s.call),
    ['submit'],
  );
  // Phó HT ban hành / trả lại ở trang chi tiết: không lưu lại nội dung
  assert.deepEqual(
    planSteps(pending, { status: 'APPROVED', history: [] }, false).map((s) => s.call),
    ['issue'],
  );
  assert.deepEqual(planSteps(pending, { status: 'REJECTED', history: [{ note: 'Sửa MT' }] }), [{ call: 'return', note: 'Sửa MT' }]);
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

test('BE:EDU-10 — khóa "Đang sửa": người giữ khóa; lưu khi đang sửa chỉ là update, gửi vẫn là submit', () => {
  const goal = toUiGoal(
    detail({ status: 'EDITING', editing: { userId: 7, name: 'Demo leader', title: null, at: '2026-10-22T03:05:00Z' } }),
    refs,
  );
  assert.equal(goal.status, 'EDITING');
  assert.equal(goal.editing.name, 'Demo leader');
  assert.match(goal.editing.at, /^2026-10-22 \d\d:05$/);
  assert.equal(toUiGoal(detail(), refs).editing, null);

  const editing = { status: 'EDITING', permissions: { canEdit: true } };
  assert.deepEqual(
    planSteps(editing, { status: 'DRAFT' }).map((s) => s.call),
    ['update'],
  );
  assert.deepEqual(
    planSteps(editing, { status: 'PENDING_VP', history: [] }).map((s) => s.call),
    ['update', 'submit'],
  );
});

test('BE:EDU-10 — vào / thoát trang soạn gọi start-editing / finish-editing', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const data = config.url === '/education-plans/config' ? CONFIG : detail({ status: 'DRAFT' });
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };

  const edit = { sessionId: crypto.randomUUID(), revision: 0 };
  await educationPlanApi.startEditingGoal('41', edit);
  await educationPlanApi.finishEditingGoal('41', { edit });

  assert.deepEqual(calls.slice(-2), ['POST /education-plans/goals/41/start-editing', 'POST /education-plans/goals/41/finish-editing']);
});

test('trang chi tiết cũ không dùng revision mới nhận được để ghi đè; quyền tạm luôn được nhả', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const data = config.url === '/education-plans/config' ? CONFIG : detail({ revision: 9 });
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };
  const stale = { ...toUiGoal(detail({ revision: 8 }), refs), status: 'APPROVED' };
  await assert.rejects(educationPlanApi.saveGoal(stale), { status: 409 });
  assert.ok(calls.includes('POST /education-plans/goals/41/finish-editing'));
  assert.ok(!calls.some((call) => call.startsWith('PUT ') || call.endsWith('/issue')));
});

test('BE:EDU-11 — cấu hình: lĩnh vực thêm là lĩnh vực không chuẩn; lưu gửi PUT /education-plans/config', async () => {
  const signers = { year: ['TEAM_LEADER', 'VICE_PRINCIPAL'], branch: ['VICE_PRINCIPAL'], week: ['TEAM_LEADER', 'VICE_PRINCIPAL'] };
  const weekRows = [{ key: 'hoc', label: 'Hoạt động học', canMerge: false, allWeek: false, extraLabel: null }];
  const beConfig = {
    ...CONFIG,
    domains: [
      { id: 11, name: 'Phát triển thể chất', displayLabel: 'Thể chất', standard: true },
      { id: 20, name: 'Lĩnh vực mới', displayLabel: null, standard: false },
    ],
    signers,
    weekRows,
  };
  assert.deepEqual(toUiEduConfig(beConfig), {
    domainLabels: { 'Phát triển thể chất': 'Thể chất' },
    extraDomains: ['Lĩnh vực mới'],
    signers,
    weekRows,
  });

  let sent = null;
  axiosClient.defaults.adapter = async (config) => {
    sent = { method: config.method, url: config.url, body: JSON.parse(config.data) };
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data: beConfig } };
  };
  const saved = await educationPlanApi.saveEduConfig({ domainLabels: {}, extraDomains: ['Lĩnh vực mới'], signers, weekRows });

  assert.equal(sent.method, 'put');
  assert.equal(sent.url, '/education-plans/config');
  assert.deepEqual(sent.body.extraDomains, ['Lĩnh vực mới']);
  assert.deepEqual(saved.signers, signers);
});

const sourceActor = { id: 'vp-demo', role: 'VICE_PRINCIPAL' };
const respond = (config, data) => ({ status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } });

test('import sources maps filters, traverses pages, dedupes/excludes and never eagerly loads details', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    const page = config.params.page;
    return respond(config, {
      items:
        page === 0
          ? [detail({ id: 81, goalCount: 4 }), detail({ id: 82 })]
          : [detail({ id: 81 }), detail({ id: 83, goalCount: 2, revision: 7 })],
      totalPages: 2,
    });
  };
  const result = await educationPlanApi.listGoalSources({ schoolYear: '2026 – 2027', ageGroupId: 'ag-3', excludeId: '82' }, sourceActor, {
    signal,
  });
  assert.deepEqual(
    result.map((s) => s.id),
    ['81', '83'],
  );
  assert.deepEqual(result[1], {
    id: '83',
    code: 'KHNH-2627-MGB',
    title: 'Kế hoạch MGB',
    schoolYear: '2026 – 2027',
    ageGroupId: 'ag-3',
    status: 'DRAFT',
    revision: 7,
    goalCount: 2,
  });
  assert.deepEqual(
    calls.map((c) => c.params),
    [0, 1].map((page) => ({ schoolYearId: 5, ageGroupId: 3, page, size: 200 })),
  );
  assert.ok(calls.every((c) => c.url === '/education-plans/goals' && c.signal === signal));
});

test('import sources rejects unknown filters rather than widening scope', async () => {
  let calls = 0;
  axiosClient.defaults.adapter = async (config) => {
    calls++;
    return respond(config, { items: [], totalPages: 0 });
  };
  await assert.rejects(educationPlanApi.listGoalSources({ schoolYear: 'unknown' }, sourceActor), { status: 400 });
  await assert.rejects(educationPlanApi.listGoalSources({ ageGroupId: 'unknown' }, sourceActor), { status: 400 });
  assert.equal(calls, 0);
});

test('import source detail stays fresh and does not overwrite the writer baseline or start editing', async () => {
  const calls = [];
  const signal = new AbortController().signal;
  const edit = { sessionId: 'writer-session', revision: 0 };
  const original = toUiGoal(detail({ id: 91 }), refs);
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method} ${config.url}`);
    const sourceRead = config.method === 'get';
    if (sourceRead) assert.equal(config.signal, signal);
    return respond(
      config,
      detail({ id: 91, title: sourceRead ? 'Changed source' : original.title, revision: sourceRead ? calls.length : 0 }),
    );
  };
  await educationPlanApi.startEditingGoal('91', edit);
  const first = await educationPlanApi.getGoalSource('91', sourceActor, { signal });
  const second = await educationPlanApi.getGoalSource('91', sourceActor, { signal });
  assert.notEqual(first.revision, second.revision);
  assert.equal(first.domains[0].rows[1].contents[0].text, 'Hô hấp');
  const beforeSave = calls.length;
  await educationPlanApi.saveGoal(original, { edit });
  assert.equal(calls.length, beforeSave);
  assert.deepEqual(calls, [
    'post /education-plans/goals/91/start-editing',
    'get /education-plans/goals/91',
    'get /education-plans/goals/91',
  ]);
});

test('import source reads preserve forbidden, missing and network errors', async () => {
  for (const status of [403, 404, 500]) {
    axiosClient.defaults.adapter = async (config) => {
      throw new AxiosError('read failed', 'ERR_BAD_REQUEST', config, null, { status, config, headers: {}, data: { desc: 'read failed' } });
    };
    await assert.rejects(educationPlanApi.listGoalSources({}, sourceActor), { status });
    await assert.rejects(educationPlanApi.getGoalSource('41', sourceActor), { status });
  }
  axiosClient.defaults.adapter = async (config) => {
    throw new AxiosError('Network Error', 'ERR_NETWORK', config);
  };
  await assert.rejects(educationPlanApi.listGoalSources({}, sourceActor), { status: 0 });
  await assert.rejects(educationPlanApi.getGoalSource('41', sourceActor), { status: 0 });
});

test('import sources restrict team leader filter and detail to their age group without sending actor', async () => {
  const leader = { id: 'leader-demo', role: 'TEAM_LEADER', ageGroupId: 'ag-3' };
  let sent;
  axiosClient.defaults.adapter = async (config) => {
    sent = config;
    return respond(config, config.url.endsWith('/42') ? detail({ id: 42, ageGroupId: 99 }) : { items: [], totalPages: 0 });
  };
  await educationPlanApi.listGoalSources({ ageGroupId: 'other' }, leader);
  assert.equal(sent.params.ageGroupId, 3);
  assert.equal(sent.params.actor, undefined);
  await assert.rejects(educationPlanApi.getGoalSource('42', leader), { status: 403 });
});
