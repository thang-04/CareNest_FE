import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const { axiosClient } = await import('../../src/services/http/axiosClient.js');
const { buildRefs, planSteps, toUiGoal } = await import('@/services/education-plan/api/yearPlanMapper');
const { educationPlanApi } = await import('@/services/education-plan/api/educationPlanApi');
const { EDU_STATUS } = await import('@/models/education-plan/educationPlanConstants');

const CONFIG = {
  domains: [
    { id: 11, name: 'Phát triển thể chất', displayLabel: null, shortLabel: 'Thể chất', sortOrder: 1 },
  ],
  schoolYears: [{ id: 5, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-05-31' }],
  ageGroups: [{ id: 3, code: 'ag-3', name: 'Mẫu giáo bé (3–4 tuổi)', shortName: 'Mẫu giáo bé', sortOrder: 2 }],
};
const refs = buildRefs(CONFIG);

test('deleting an annual draft uses revision directly without opening an editing lease', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, data: { revision: 4 } } };
  };
  await educationPlanApi.deleteGoal('901', 4);
  assert.deepEqual(calls.map((call) => call.method), ['delete']);
  assert.equal(calls[0].headers['X-Plan-Revision'], '4');
});

test('planSteps: chuyển từ DRAFT sang REVIEW phát sinh hành động submit', () => {
  const prev = { status: EDU_STATUS.DRAFT, permissions: { canEdit: true } };
  const goal = { status: 'REVIEW', history: [{ note: 'Gửi duyệt lần 1' }] };
  const steps = planSteps(prev, goal, false);

  assert.deepEqual(steps, [{ call: 'submit', note: 'Gửi duyệt lần 1' }]);
});

test('planSteps: từ REVIEW sang APPROVED phát sinh hành động issue (ban hành)', () => {
  const prev = { status: 'REVIEW', permissions: { canEdit: false } };
  const goal = { status: EDU_STATUS.APPROVED, history: [{ note: 'Đồng ý ban hành' }] };
  const steps = planSteps(prev, goal, false);

  assert.deepEqual(steps, [{ call: 'issue', note: 'Đồng ý ban hành' }]);
});

test('planSteps: từ REVIEW trả về DRAFT phát sinh hành động return kèm note', () => {
  const prev = { status: 'REVIEW', permissions: { canEdit: false } };
  const goal = { status: EDU_STATUS.DRAFT, history: [{ note: 'Bổ sung thêm mục tiêu thể chất' }] };
  const steps = planSteps(prev, goal, false);

  assert.deepEqual(steps, [{ call: 'return', note: 'Bổ sung thêm mục tiêu thể chất' }]);
});

test('planSteps: không cập nhật nội dung (update) khi không có quyền canEdit', () => {
  const prev = { status: 'REVIEW', permissions: { canEdit: false } };
  const goal = { status: 'REVIEW', title: 'Tên mới' };
  const steps = planSteps(prev, goal, true);

  assert.deepEqual(steps, []);
});

test('toUiGoal: map đúng status REVIEW, waitingRole, waitingRoleLabel và creationCapabilities', () => {
  const detail = {
    id: 50,
    code: 'KHNH-2627-MGB',
    schoolYearId: 5,
    schoolYearName: '2026-2027',
    ageGroupId: 3,
    title: 'Kế hoạch năm',
    status: 'REVIEW',
    waitingRole: 'VICE_PRINCIPAL',
    waitingRoleLabel: 'Phó hiệu trưởng',
    creationCapabilities: { canCreate: false, reason: 'ALREADY_EXISTS' },
    permissions: { canEdit: false, canSubmit: false, canIssue: true, canReturn: true },
    domains: [],
    themes: [],
    breaks: [],
    history: [],
  };

  const uiGoal = toUiGoal(detail, refs);
  assert.equal(uiGoal.status, 'REVIEW');
  assert.equal(uiGoal.waitingRole, 'VICE_PRINCIPAL');
  assert.equal(uiGoal.waitingRoleLabel, 'Phó hiệu trưởng');
  assert.deepEqual(uiGoal.creationCapabilities, { canCreate: false, reason: 'ALREADY_EXISTS' });
});

test('ClassDoc API: saveClassDoc gửi X-Class-Doc-Version và X-Dossier-Version headers', async () => {
  let capturedHeaders = null;
  axiosClient.defaults.adapter = async (config) => {
    capturedHeaders = config.headers;
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { code: 200, desc: 'ok', data: { id: 'cd-1', version: 3, dossierVersion: 5 } },
    };
  };

  const doc = { id: 'cd-1', title: 'Chủ đề 1', version: 2, dossierVersion: 4 };
  await educationPlanApi.saveClassDoc('theme', doc);

  assert.ok(capturedHeaders, 'Phải gửi headers');
  assert.equal(capturedHeaders['X-Class-Doc-Version'], '2');
  assert.equal(capturedHeaders['X-Dossier-Version'], '4');
});

test('ClassDoc API: saveClassDocAdjustments gửi X-Class-Doc-Version header', async () => {
  let capturedHeaders = null;
  axiosClient.defaults.adapter = async (config) => {
    capturedHeaders = config.headers;
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { code: 200, desc: 'ok', data: { id: 'w-1', adjustments: 'Sửa ngày 2' } },
    };
  };

  await educationPlanApi.saveClassDocAdjustments('w-1', 'Sửa ngày 2', { version: 5, dossierVersion: 8 });

  assert.ok(capturedHeaders, 'Phải gửi headers');
  assert.equal(capturedHeaders['X-Class-Doc-Version'], '5');
});

test('ClassDoc API: actOnClassDoc gửi Idempotency-Key và version headers', async () => {
  let capturedHeaders = null;
  let capturedBody = null;
  axiosClient.defaults.adapter = async (config) => {
    capturedHeaders = config.headers;
    capturedBody = JSON.parse(config.data);
    return {
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      data: { code: 200, desc: 'ok', data: { id: 'th-1', status: 'REVIEW', waitingRole: 'VICE_PRINCIPAL' } },
    };
  };

  await educationPlanApi.actOnClassDoc('theme', 'th-1', { action: 'submit' }, { version: 1, dossierVersion: 1, requestId: 'req-123' });

  assert.ok(capturedHeaders, 'Phải gửi headers');
  assert.equal(capturedHeaders['Idempotency-Key'], 'req-123');
  assert.equal(capturedHeaders['X-Class-Doc-Version'], '1');
  assert.equal(capturedHeaders['X-Dossier-Version'], '1');
  assert.deepEqual(capturedBody, { action: 'submit' });
});

test('Stale version 409 ném lỗi để UI nhận diện và yêu cầu tải lại', async () => {
  axiosClient.defaults.adapter = async (config) => {
    const error = new Error('Request failed with status code 409');
    error.isAxiosError = true;
    error.response = { status: 409, data: { code: 9012, desc: 'Tài liệu đã được chỉnh sửa bởi phiên khác' } };
    throw error;
  };

  await assert.rejects(
    async () => {
      await educationPlanApi.saveClassDoc('theme', { id: 'th-1', version: 1 });
    },
    (err) => {
      return err.response?.status === 409 || err.status === 409;
    },
  );
});

test('T050 [US3]: Mock repository - Sửa sau khi bị trả lại rồi gửi lại reset approvals và tăng reviewRound', async () => {
  const { educationPlanMockRepository } = await import('@/services/education-plan/mock/educationPlanMockRepository');
  const user = { id: 1, fullName: 'Tổ trưởng Khối', role: 'TEAM_LEADER' };

  // 1. Tạo plan và gửi duyệt vòng 1
  const saved = await educationPlanMockRepository.saveGoal(
    { id: 'yp-mock-round-1', title: 'KH Mock', status: EDU_STATUS.DRAFT, owner: { userId: user.id } },
    { edit: { sessionId: 's1', revision: 0, requestId: 'r1' } },
  );
  const submitted1 = await educationPlanMockRepository.saveGoal(
    { ...saved, status: 'REVIEW', sentBy: user },
    { edit: { sessionId: 's1', revision: saved.revision, requestId: 'r1-sub' } },
  );
  assert.equal(submitted1.status, 'REVIEW');
  assert.equal(submitted1.reviewRound, 1);

  // 2. Trả lại về DRAFT/REJECTED
  const rejected = await educationPlanMockRepository.saveGoal(
    { ...submitted1, status: EDU_STATUS.REJECTED, approvals: [{ roleKey: 'VICE_PRINCIPAL', name: 'PHT' }] },
    {},
  );
  assert.equal(rejected.status, EDU_STATUS.REJECTED);

  // 3. Sửa và gửi lại vòng 2
  const edited = await educationPlanMockRepository.saveGoal(
    { ...rejected, title: 'KH Mock Đã Sửa' },
    { edit: { sessionId: 's2', revision: rejected.revision, requestId: 'r2' } },
  );
  const submitted2 = await educationPlanMockRepository.saveGoal(
    { ...edited, status: 'REVIEW', sentBy: user },
    { edit: { sessionId: 's2', revision: edited.revision, requestId: 'r2-sub' } },
  );
  assert.equal(submitted2.status, 'REVIEW');
  assert.equal(submitted2.reviewRound, 2);
  assert.deepEqual(submitted2.approvals, []);
});

test('T050 [US3]: Mock repository - Giữ approvals của round hiện tại khi chỉ đổi workflow policy', async () => {
  const { educationPlanMockRepository } = await import('@/services/education-plan/mock/educationPlanMockRepository');
  const user = { id: 1, fullName: 'Tổ trưởng Khối', role: 'TEAM_LEADER' };

  const plan = await educationPlanMockRepository.saveGoal(
    {
      id: 'yp-mock-policy-1',
      title: 'KH Mock Policy Change',
      status: 'REVIEW',
      reviewRound: 1,
      approvals: [{ roleKey: 'TEAM_LEADER', name: 'Tổ trưởng A' }],
      owner: { userId: user.id },
    },
    {},
  );

  // Lưu tiếp với cùng status REVIEW giữ approvals
  const unchanged = await educationPlanMockRepository.saveGoal(
    { ...plan },
    {},
  );
  assert.equal(unchanged.reviewRound, 1);
  assert.equal(unchanged.approvals.length, 1);
  assert.equal(unchanged.approvals[0].roleKey, 'TEAM_LEADER');
});


test('nested review metadata takes precedence over legacy waitingRole', () => {
  const goal = toUiGoal({ id: 52, status: 'REVIEW', waitingRole: 'VICE_PRINCIPAL', review: { waitingRole: 'PRINCIPAL', roles: ['PRINCIPAL'] }, domains: [], themes: [] }, refs);
  assert.equal(goal.waitingRole, 'PRINCIPAL');
  assert.deepEqual(goal.review.roles, ['PRINCIPAL']);
});

test('explicit intermediate year approval never opens author lease or writes content', async () => {
  const calls = [];
  axiosClient.defaults.adapter = async (config) => {
    calls.push(config);
    const data = config.url.endsWith('/config') ? CONFIG : { id: 52, revision: 6, status: 'REVIEW', review: { waitingRole: 'PRINCIPAL' }, domains: [], themes: [], permissions: { canEdit: false, canApprove: false } };
    return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, desc: 'ok', data } };
  };
  const plan = { id: '52', revision: 5, status: 'REVIEW', permissions: { canEdit: false, canApprove: true }, history: [{ note: 'Đồng ý' }] };
  const saved = await educationPlanApi.saveGoal(plan, { action: 'approve' });
  assert.equal(saved.status, 'REVIEW');
  const writes = calls.filter((call) => call.method !== 'get');
  assert.deepEqual(writes.map((call) => call.url), ['/education-plans/goals/52/issue']);
  assert.equal(writes[0].headers.get('X-Plan-Revision'), '5');
  assert.equal(writes[0].headers.get('X-Edit-Session'), undefined);
});

test('class creation sends -1 and strips server metadata; week refuses missing root version', async () => {
  let sent;
  axiosClient.defaults.adapter = async (config) => { sent = config; return { status: 200, statusText: 'OK', headers: {}, config, data: { code: 200, data: { id: 'new' } } }; };
  await educationPlanApi.saveClassDoc('branch', { id: 'new', review: { waitingRole: 'PRINCIPAL' }, permissions: { canEdit: true } });
  assert.equal(sent.headers.get('X-Class-Doc-Version'), '-1');
  assert.equal(JSON.parse(sent.data).review, undefined);
  assert.equal(JSON.parse(sent.data).permissions, undefined);
  assert.throws(() => educationPlanApi.saveClassDoc('week', { id: 'new-week' }), { status: 409 });
});
