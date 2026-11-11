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

const { withDefaults, DEFAULT_WORKFLOW_POLICY, WORKFLOW_ROLES } = await import('@/models/education-plan/eduConfig');
const { toUiEduConfig } = await import('@/services/education-plan/api/yearPlanMapper');
const { eduConfigMockRepository } = await import('@/services/education-plan/mock/eduConfigMockRepository');

const principalUser = { id: 1, role: 'PRINCIPAL', fullName: 'Demo Principal' };
const vicePrincipalUser = { id: 2, role: 'VICE_PRINCIPAL', fullName: 'Demo VP' };
const teacherUser = { id: 3, role: 'TEACHER', fullName: 'Demo Teacher' };

test('FR-001 / AC-01: cấu hình mặc định có đầy đủ workflowPolicy với creators và reviewers phân biệt cho 3 loại', () => {
  const cfg = withDefaults(null);
  assert.ok(cfg.workflowPolicy, 'Phải có workflowPolicy');
  assert.deepEqual(cfg.workflowPolicy.year, {
    creators: ['TEAM_LEADER'],
    reviewers: ['VICE_PRINCIPAL'],
  });
  assert.deepEqual(cfg.workflowPolicy.branch, {
    creators: ['TEACHER'],
    reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
  });
  assert.deepEqual(cfg.workflowPolicy.theme, {
    creators: ['TEACHER'],
    reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
  });
  assert.equal(cfg.workflowRevision, 1);
});

test('FR-002 / US1.3: chỉ Hiệu trưởng được lưu workflowPolicy, Phó HT và GV bị từ chối', async () => {
  const customPolicy = {
    ...DEFAULT_WORKFLOW_POLICY,
    year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL', 'PRINCIPAL'] },
  };

  // Phó HT cố đổi workflowPolicy -> bị từ chối
  await assert.rejects(
    async () => eduConfigMockRepository.saveWorkflowPolicy({ workflowRevision: 1, workflowPolicy: customPolicy }, vicePrincipalUser),
    (err) => err.status === 403 || err.code === 'EDU_CONFIG_FORBIDDEN',
  );

  // GV cố đổi -> bị từ chối
  await assert.rejects(
    async () => eduConfigMockRepository.saveWorkflowPolicy({ workflowRevision: 1, workflowPolicy: customPolicy }, teacherUser),
    (err) => err.status === 403 || err.code === 'EDU_CONFIG_FORBIDDEN',
  );

  // Hiệu trưởng đổi hợp lệ -> thành công và tăng workflowRevision
  const saved = await eduConfigMockRepository.saveWorkflowPolicy({ workflowRevision: 1, workflowPolicy: customPolicy }, principalUser);
  assert.deepEqual(saved.workflowPolicy.year.reviewers, ['VICE_PRINCIPAL', 'PRINCIPAL']);
  assert.ok(saved.workflowRevision >= 2);
});

test('FR-006 / FR-012: chặn lặp vai trò giữa creator và reviewer hoặc lặp reviewer trong chuỗi', async () => {
  // Giao nhau giữa creator và reviewer (ví dụ PHT vừa soạn vừa duyệt kế hoạch năm)
  const overlappingPolicy = {
    ...DEFAULT_WORKFLOW_POLICY,
    year: { creators: ['VICE_PRINCIPAL'], reviewers: ['VICE_PRINCIPAL'] },
  };
  await assert.rejects(
    async () => eduConfigMockRepository.saveWorkflowPolicy({ workflowRevision: 2, workflowPolicy: overlappingPolicy }, principalUser),
    (err) => err.status === 400 || err.message.includes('trùng') || err.message.includes('giao'),
  );

  // Thiếu creator
  const missingCreatorPolicy = {
    ...DEFAULT_WORKFLOW_POLICY,
    year: { creators: [], reviewers: ['VICE_PRINCIPAL'] },
  };
  await assert.rejects(
    async () => eduConfigMockRepository.saveWorkflowPolicy({ workflowRevision: 2, workflowPolicy: missingCreatorPolicy }, principalUser),
    (err) => err.status === 400,
  );

  // Trùng vai trò duyệt
  const duplicateReviewerPolicy = {
    ...DEFAULT_WORKFLOW_POLICY,
    year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL', 'VICE_PRINCIPAL'] },
  };
  await assert.rejects(
    async () => eduConfigMockRepository.saveWorkflowPolicy({ workflowRevision: 2, workflowPolicy: duplicateReviewerPolicy }, principalUser),
    (err) => err.status === 400,
  );
});

test('toUiEduConfig map chính xác workflowPolicy và workflowRevision từ backend response', () => {
  const beResponse = {
    domains: [{ name: 'Thể chất', standard: true }],
    workflowPolicy: {
      year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL'] },
      branch: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
      theme: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
    },
    workflowRevision: 5,
    signers: { year: ['VICE_PRINCIPAL'] },
  };
  const uiConfig = toUiEduConfig(beResponse);
  assert.equal(uiConfig.workflowRevision, 5);
  assert.deepEqual(uiConfig.workflowPolicy.year.creators, ['TEAM_LEADER']);
  assert.deepEqual(uiConfig.workflowPolicy.year.reviewers, ['VICE_PRINCIPAL']);
});

test('mock workflow save retains missing final reviewer and invalidates stale revisions', async () => {
  const { writeDb, readDb } = await import('@/mocks/mockDatabase');
  const current = await eduConfigMockRepository.get(principalUser);
  writeDb((db) => { db.eduGoals = [{ id: 'pending-test', status: 'REVIEW', ageGroupId: 'ag-test', reviewRound: 1, revision: 4, approvals: [], waitingRole: 'VICE_PRINCIPAL' }]; });
  const changed = { ...current, workflowPolicy: { ...current.workflowPolicy, year: { creators: ['TEACHER'], reviewers: ['PRINCIPAL'] } } };
  const saved = await eduConfigMockRepository.saveWorkflowPolicy(changed, principalUser);
  const pending = readDb().eduGoals.find((goal) => goal.id === 'pending-test');
  assert.equal(pending.status, 'REVIEW');
  assert.equal(pending.waitingRole, 'PRINCIPAL');
  assert.equal(pending.revision, 5);
  await assert.rejects(eduConfigMockRepository.saveWorkflowPolicy(changed, principalUser), { status: 409 });
  const same = await eduConfigMockRepository.saveWorkflowPolicy(saved, principalUser);
  assert.equal(same.workflowRevision, saved.workflowRevision);
});

test('mock year creation scopes exclude a user who also holds a reviewer role', async () => {
  const cfg = await eduConfigMockRepository.get({ role: 'TEACHER', roles: ['TEACHER', 'PRINCIPAL'], ageGroupId: 'ag-test' });
  assert.deepEqual(cfg.yearCreationScopes, []);
});
