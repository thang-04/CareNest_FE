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

test('goal labels round-trip through the API; empty clears and missing remains omitted for legacy clients', () => {
  const response = detail();
  response.domains[0].rows[1].displayLabel = 'Mục tiêu 01';
  const goal = toUiGoal(response, refs);
  assert.equal(goal.domains[0].rows[1].displayLabel, 'Mục tiêu 01');
  assert.equal(goal.domains[0].items[0].code, 'Mục tiêu 01');
  assert.equal(toYearPlanRequest(goal, refs).domains[0].rows[1].displayLabel, 'Mục tiêu 01');
  goal.domains[0].rows[1].displayLabel = '';
  assert.equal(toYearPlanRequest(goal, refs).domains[0].rows[1].displayLabel, '');
  delete goal.domains[0].rows[1].displayLabel;
  assert.equal(Object.hasOwn(toYearPlanRequest(goal, refs).domains[0].rows[1], 'displayLabel'), false);
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
  let createHeaders;
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const envelope = (data, status = 200) => ({ status, statusText: 'OK', headers: {}, config, data: { code: status, desc: 'ok', data } });
    if (config.url === '/education-plans/config') return envelope(CONFIG);
    if (config.method === 'post' && config.url === '/education-plans/goals') {
      createHeaders = config.headers;
      return envelope(detail(), 201);
    }
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
  // BE:BUG-261102 — proxy hosting ghi đè X-Request-Id; khóa chống gửi trùng đi ở Idempotency-Key (UUID)
  assert.match(createHeaders.get('Idempotency-Key'), /^[0-9a-f-]{36}$/);
  assert.equal(createHeaders.get('X-Request-Id'), undefined);
  // Lỗi của BE đọc từ desc
  await assert.rejects(axiosClient.get('/education-plans/goals/999'), { status: 404, message: 'Year plan not found' });
});

test('EDU-70 — dữ liệu EDITING cũ hiển thị nháp, không giữ khóa sửa', () => {
  const goal = toUiGoal(
    detail({ status: 'EDITING', editing: { userId: 7, name: 'Demo leader', title: null, at: '2026-10-22T03:05:00Z' } }),
    refs,
  );
  assert.equal(goal.status, 'DRAFT');
  assert.equal(goal.editing, null);
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

test('EDU-70 — adapter tương thích chỉ đọc bản mới, không mở hoặc đóng lease', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const data = config.url === '/education-plans/config' ? CONFIG : detail({ status: 'DRAFT' });
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };

  const edit = { sessionId: crypto.randomUUID(), revision: 0 };
  await educationPlanApi.startEditingGoal('41', edit);
  await educationPlanApi.finishEditingGoal('41', { edit });

  assert.equal(calls.at(-1), 'GET /education-plans/goals/41');
  assert.ok(!calls.some((call) => /start-editing|finish-editing/.test(call)));
});

test('trang chi tiết cũ không dùng revision mới nhận được để ghi đè và không mở lease', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`);
    const data = config.url === '/education-plans/config' ? CONFIG : detail({ revision: 9 });
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };
  const stale = { ...toUiGoal(detail({ revision: 8 }), refs), status: 'APPROVED' };
  await assert.rejects(educationPlanApi.saveGoal(stale), { status: 409 });
  assert.ok(calls.includes('GET /education-plans/goals/41'));
  assert.ok(!calls.some((call) => /start-editing|finish-editing/.test(call)));
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
    workflowPolicy: null,
    durationPolicyAvailable: true,
    workflowRevision: 1,
    canConfigure: false,
    yearCreationScopes: [],
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
    const sourceRead = config.method === 'get' && config.signal === signal;
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
    'get /education-plans/goals/91',
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

test('import sources: team leader chọn được nhóm tuổi khác; chi tiết nhóm khác chưa ban hành bị chặn (BE:EDU-06)', async () => {
  const leader = { id: 'leader-demo', role: 'TEAM_LEADER', ageGroupId: 'ag-3' };
  let sent;
  axiosClient.defaults.adapter = async (config) => {
    sent = config;
    if (config.url.endsWith('/42')) return respond(config, detail({ id: 42, ageGroupId: 99 }));
    if (config.url.endsWith('/43')) return respond(config, detail({ id: 43, ageGroupId: 99, status: 'APPROVED' }));
    return respond(config, { items: [], totalPages: 0 });
  };
  // Không ép về nhóm mình nữa: BE lọc theo phạm vi xem
  await educationPlanApi.listGoalSources({}, leader);
  assert.equal(sent.params.ageGroupId, undefined);
  assert.equal(sent.params.actor, undefined);
  await assert.rejects(educationPlanApi.getGoalSource('42', leader), { status: 403 });
  assert.equal((await educationPlanApi.getGoalSource('43', leader)).id, '43');
});

test('toUiGoal: giữ nguyên quyền permissions, waitingRole và creationCapabilities từ server detail', () => {
  const serverDetail = detail({
    id: 99,
    status: 'REVIEW',
    waitingRole: 'VICE_PRINCIPAL',
    waitingRoleLabel: 'Phó hiệu trưởng',
    creationCapabilities: { canCreate: false, reason: 'ALREADY_EXISTS' },
    permissions: { canEdit: false, canSubmit: false, canIssue: true, canReturn: true, canDelete: false },
  });
  const ui = toUiGoal(serverDetail, refs);
  assert.equal(ui.status, 'REVIEW');
  assert.equal(ui.waitingRole, 'VICE_PRINCIPAL');
  assert.equal(ui.waitingRoleLabel, 'Phó hiệu trưởng');
  assert.equal(ui.permissions.canEdit, false);
  assert.equal(ui.permissions.canIssue, true);
  assert.equal(ui.permissions.canReturn, true);
});

test('old backend ignoring planLevel does not duplicate TEAM records or turn them into annual plans', async () => {
  const detailReads = [];
  axiosClient.defaults.adapter = async (config) => {
    let data;
    if (config.url.endsWith('/config')) data = CONFIG;
    else if (config.url.endsWith('/workflow-policy')) data = { revision: 1, policies: {}, canConfigure: false };
    else if (config.url.endsWith('/duration-policy'))
      throw new AxiosError('not found', 'ERR_BAD_REQUEST', config, null, { status: 404, config, headers: {}, data: { desc: 'Not found' } });
    else if (config.url.endsWith('/goals')) data = { items: [{ id: 41 }], totalPages: 1 };
    else {
      detailReads.push(config.url);
      data = detail();
    }
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };
  await educationPlanApi.getEduConfig();
  const loaded = await educationPlanApi.getAll();
  assert.equal(loaded.goals.length, 1);
  assert.equal(loaded.goals[0].planLevel, 'TEAM');
  assert.equal(detailReads.length, 1);
});

test('annual import sends SCHOOL_YEAR to the API list filter', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    return respond(config, { items: [], totalPages: 1 });
  };
  await educationPlanApi.listGoalSources({ planLevel: 'SCHOOL_YEAR' }, sourceActor);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.planLevel, 'SCHOOL_YEAR');
});

test('label-only draft goals roundtrip without requiring text or replacing the entered STT', () => {
  const goal = toUiGoal(detail(), refs);
  goal.domains[0].rows.push({ id: 'pending-label', kind: 'goal', text: '', displayLabel: 'MTR20', contents: [] });
  const body = toYearPlanRequest(goal, refs);
  const pending = body.domains[0].rows.at(-1);
  assert.equal(pending.text, '');
  assert.equal(pending.displayLabel, 'MTR20');
  const response = detail();
  response.domains[0].rows.push({ ...pending, id: 103, goalNo: 2, contents: [] });
  const restored = toUiGoal(response, refs).domains[0].rows.at(-1);
  assert.equal(restored.displayLabel, 'MTR20');
  assert.equal(restored.text, '');
});

test('annual source trusts server scope for a manager with a team-leader primary role', async () => {
  axiosClient.defaults.adapter = async (config) => {
    const data = config.url === '/education-plans/config' ? CONFIG : detail({ planLevel: 'SCHOOL_YEAR', status: 'REVIEW' });
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };
  const goal = await educationPlanApi.getGoalSource('41', { role: 'TEAM_LEADER', roles: ['VICE_PRINCIPAL'], ageGroupId: 'ag-4' });
  assert.equal(goal.planLevel, 'SCHOOL_YEAR');
  assert.equal(goal.status, 'REVIEW');
});

test('spec015 maps planType, sentAt, source baseline, distinct review IDs and revision aliases', () => {
  const ui = toUiGoal(detail({ planType: 'SCHOOL_YEAR', planLevel: 'TEAM', sentAt: '2026-11-09T03:00:00Z',
    previousSourcePlanId: 10, curriculumSourcePlanId: 20, contentRevision: 8, revision: 7,
    reviewItems: [{ reviewItemId: 600, itemId: 200, itemKind: 'CONTENT', sourcePlanId: 20, reason: 'Nội dung đổi', resolved: false }],
    newItems: [{ itemKind: 'GOAL', itemId: 102 }] }), refs);
  assert.equal(ui.planLevel, 'SCHOOL_YEAR'); assert.equal(ui.planTypeLabel, 'Kế hoạch năm học');
  assert.equal(ui.sentAt, '2026-11-09'); assert.equal(ui.previousSourcePlanId, '10');
  assert.equal(ui.revision, 8); assert.equal(ui.contentRevision, 8);
  assert.equal(ui.reviewItems[0].reviewItemId, '600'); assert.equal(ui.reviewItems[0].itemId, '200');
  assert.equal(ui.newItems[0].itemId, '102');
  assert.equal(toUiGoal(detail({ createdAt: '2026-11-09T03:00:00Z', sentBy: null }), refs).sentAt, null);
  assert.equal(toUiGoal(detail({ sentBy: { at: '2026-11-08T03:00:00Z' } }), refs).sentAt, '2026-11-08');
});

test('resolve sends review primary key, current source and existing edit/revision/idempotency headers; conflicts propagate without retry', async () => {
  const calls = [];
  const edit = { sessionId: crypto.randomUUID(), revision: 8, requestId: crypto.randomUUID() };
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    return respond(config, detail({ revision: 9, reviewItems: [{ reviewItemId: 600, itemId: 200, sourcePlanId: 20, resolved: true }] }));
  };
  const saved = await educationPlanApi.resolveGoalReview('41', '600', '20', edit);
  const request = calls.at(-1);
  assert.equal(request.url, '/education-plans/goals/41/review/600/resolve');
  assert.deepEqual(JSON.parse(request.data), { expectedSourcePlanId: 20 });
  assert.equal(request.headers.get('X-Edit-Session'), edit.sessionId);
  assert.equal(request.headers.get('X-Plan-Revision'), '8');
  assert.equal(request.headers.get('Idempotency-Key'), edit.requestId);
  assert.equal(saved.reviewItems[0].resolved, true); assert.equal(saved.revision, 9);
  let attempts = 0;
  axiosClient.defaults.adapter = async (config) => {
    attempts++;
    throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, null, { status: 409, config, headers: {}, data: { desc: 'Nguồn đã thay đổi' } });
  };
  await assert.rejects(educationPlanApi.resolveGoalReview('41', '600', '20', edit), { status: 409 });
  assert.equal(attempts, 1);
});
