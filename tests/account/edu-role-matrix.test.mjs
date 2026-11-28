import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.window = new EventTarget();
const { readDb, resetDb } = await import('@/mocks/mockDatabase');
const { permissionMockRepository: repo } = await import('@/services/account/mock/permissionMockRepository');
const {
  eduApproveToClear,
  eduCellLock,
  eduLocalIssues,
  eduChainLabel,
  eduIssueText,
  eduCodesChanged,
  eduSaveErrorMessage,
  EDU_WORKFLOW_CODES,
} = await import('@/utils/account/eduRoleMatrix');
const { withoutEduWorkflowRows, permissionDraftRows, overridesFromSwitches } = await import('@/utils/account/personPermissions');

// Mặc định EDU-54: năm PHT soạn/HT duyệt; tổ TT soạn/PHT duyệt; gói và hồ sơ GV soạn, TT → PHT duyệt
const defaults = () => ({
  PRINCIPAL: ['EDU_SCHOOL_YEAR_PLAN_APPROVE'],
  VICE_PRINCIPAL: ['EDU_SCHOOL_YEAR_PLAN_EDIT', 'EDU_TEAM_PLAN_APPROVE', 'EDU_SEMESTER_PACKAGE_APPROVE', 'EDU_THEME_PLAN_APPROVE'],
  TEAM_LEADER: ['EDU_TEAM_PLAN_EDIT', 'EDU_SEMESTER_PACKAGE_APPROVE', 'EDU_THEME_PLAN_APPROVE'],
  TEACHER: ['EDU_SEMESTER_PACKAGE_EDIT', 'EDU_THEME_PLAN_EDIT'],
  KITCHEN_STAFF: [],
});

test('mặc định EDU-54 hợp lệ; chuỗi duyệt xếp cấp dưới trước', () => {
  assert.deepEqual(eduLocalIssues(defaults()), []);
  assert.equal(eduChainLabel(defaults(), 'SEMESTER_PACKAGE'), 'Gói học kỳ – chuỗi duyệt: Tổ trưởng → Phó hiệu trưởng.');
});

test('US1.2: dòng Soạn đã có vai trò ⇒ ô Soạn vai trò khác khóa, bỏ tick thì mở', () => {
  const m = defaults();
  assert.match(eduCellLock(m, 'TEAM_LEADER', 'EDU_SEMESTER_PACKAGE_EDIT'), /chỉ một vai trò soạn. Bỏ tick Giáo viên/);
  assert.equal(eduCellLock(m, 'TEACHER', 'EDU_SEMESTER_PACKAGE_EDIT'), null);
  m.TEACHER = ['EDU_THEME_PLAN_EDIT'];
  assert.equal(eduCellLock(m, 'PRINCIPAL', 'EDU_SEMESTER_PACKAGE_EDIT'), null);
});

test('US1.3 + EDU-110 (8): vai trò soạn không duyệt cùng loại; người duyệt phải cấp cao hơn', () => {
  const m = defaults();
  m.VICE_PRINCIPAL = m.VICE_PRINCIPAL.filter((c) => c !== 'EDU_TEAM_PLAN_APPROVE');
  assert.match(eduCellLock(m, 'TEAM_LEADER', 'EDU_TEAM_PLAN_APPROVE'), /không duyệt hồ sơ cùng loại/);
  assert.match(eduCellLock(m, 'TEAM_LEADER', 'EDU_SCHOOL_YEAR_PLAN_APPROVE'), /cấp cao hơn/);
  assert.equal(eduCellLock(m, 'PRINCIPAL', 'EDU_TEAM_PLAN_APPROVE'), null);
  // Đang tick Duyệt ⇒ ô Soạn cùng loại khóa
  assert.match(eduCellLock(defaults(), 'TEAM_LEADER', 'EDU_THEME_PLAN_EDIT'), /chỉ một vai trò soạn/);
  const noCreator = { ...defaults(), TEACHER: ['EDU_SEMESTER_PACKAGE_EDIT'] };
  assert.match(eduCellLock(noCreator, 'TEAM_LEADER', 'EDU_THEME_PLAN_EDIT'), /không duyệt hồ sơ cùng loại/);
});

test('EDU-110 (8): HT soạn ⇒ không cần Duyệt, dòng Duyệt khóa, chuỗi ghi HT ban hành', () => {
  const m = {
    ...defaults(),
    PRINCIPAL: ['EDU_SCHOOL_YEAR_PLAN_EDIT'],
    VICE_PRINCIPAL: ['EDU_TEAM_PLAN_APPROVE', 'EDU_SEMESTER_PACKAGE_APPROVE', 'EDU_THEME_PLAN_APPROVE'],
  };
  assert.deepEqual(eduLocalIssues(m), []);
  assert.match(eduCellLock(m, 'VICE_PRINCIPAL', 'EDU_SCHOOL_YEAR_PLAN_APPROVE'), /Hiệu trưởng soạn/);
  assert.match(eduChainLabel(m, 'SCHOOL_YEAR'), /Hiệu trưởng soạn và ban hành/);
});

test('EDU-110 (8): HT tick Soạn ⇒ tự bỏ mọi ô Duyệt cùng loại, kể cả ô của HT; vai trò khác không bị bỏ', () => {
  const m = { ...defaults(), VICE_PRINCIPAL: defaults().VICE_PRINCIPAL.filter((c) => c !== 'EDU_SCHOOL_YEAR_PLAN_EDIT') };
  // HT đang tick Duyệt năm học nhưng vẫn tick được Soạn
  assert.equal(eduCellLock(m, 'PRINCIPAL', 'EDU_SCHOOL_YEAR_PLAN_EDIT'), null);
  assert.deepEqual(eduApproveToClear(m, 'PRINCIPAL', 'EDU_SCHOOL_YEAR_PLAN_EDIT', true), {
    code: 'EDU_SCHOOL_YEAR_PLAN_APPROVE',
    roles: ['PRINCIPAL'],
  });
  const teamFree = { ...defaults(), TEAM_LEADER: defaults().TEAM_LEADER.filter((c) => c !== 'EDU_TEAM_PLAN_EDIT') };
  assert.deepEqual(eduApproveToClear(teamFree, 'PRINCIPAL', 'EDU_TEAM_PLAN_EDIT', true), {
    code: 'EDU_TEAM_PLAN_APPROVE',
    roles: ['VICE_PRINCIPAL'],
  });
  assert.equal(eduApproveToClear(teamFree, 'PRINCIPAL', 'EDU_TEAM_PLAN_EDIT', false), null);
  assert.equal(eduApproveToClear(teamFree, 'VICE_PRINCIPAL', 'EDU_TEAM_PLAN_EDIT', true), null);
});

test('lỗi theo loại: hai vai trò soạn, thiếu soạn, thiếu duyệt, GV duyệt, duyệt cấp thấp', () => {
  const two = { ...defaults(), TEAM_LEADER: [...defaults().TEAM_LEADER, 'EDU_SCHOOL_YEAR_PLAN_EDIT'] };
  assert.deepEqual(eduLocalIssues(two)[0], {
    docType: 'SCHOOL_YEAR',
    rule: 'CREATOR_NOT_EXACTLY_ONE',
    roles: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
  });
  const none = { ...defaults(), TEACHER: ['EDU_THEME_PLAN_EDIT'] };
  assert.deepEqual(eduLocalIssues(none), [{ docType: 'SEMESTER_PACKAGE', rule: 'CREATOR_NOT_EXACTLY_ONE', roles: [] }]);
  const noReviewer = { ...defaults(), PRINCIPAL: [] };
  assert.deepEqual(eduLocalIssues(noReviewer), [{ docType: 'SCHOOL_YEAR', rule: 'NO_REVIEWER', roles: [] }]);
  assert.equal(eduIssueText(eduLocalIssues(noReviewer)[0]), 'Kế hoạch năm học: cần ít nhất một vai trò Duyệt.');
  const teacherReviews = { ...defaults(), TEACHER: [...defaults().TEACHER, 'EDU_TEAM_PLAN_APPROVE'] };
  assert.ok(eduLocalIssues(teacherReviews).some((i) => i.rule === 'TEACHER_REVIEWER'));
  const lower = { ...defaults(), TEAM_LEADER: [...defaults().TEAM_LEADER, 'EDU_SCHOOL_YEAR_PLAN_APPROVE'] };
  assert.deepEqual(eduLocalIssues(lower), [{ docType: 'SCHOOL_YEAR', rule: 'REVIEWER_NOT_ABOVE_CREATOR', roles: ['TEAM_LEADER'] }]);
});

test('chỉ coi là đổi EDU khi một trong 8 mã đổi', () => {
  assert.equal(eduCodesChanged(defaults(), { ...defaults(), VICE_PRINCIPAL: [...defaults().VICE_PRINCIPAL, 'MENU_MANAGE'] }), false);
  assert.equal(eduCodesChanged(defaults(), { ...defaults(), PRINCIPAL: [] }), true);
  assert.equal(EDU_WORKFLOW_CODES.length, 8);
});

test('câu báo lỗi lưu theo mã 7202, 7201, 1118; mã khác giữ câu BE', () => {
  assert.match(eduSaveErrorMessage({ errorCode: 7202 }), /chưa đúng luật/);
  assert.match(eduSaveErrorMessage({ errorCode: 7201 }), /Hiệu trưởng/);
  assert.match(eduSaveErrorMessage({ errorCode: 1118 }), /không cấu hình được/);
  assert.equal(eduSaveErrorMessage({ errorCode: 9001, message: 'Câu BE' }), 'Câu BE');
});

let principal;
let teacher;
beforeEach(async () => {
  resetDb();
  principal = readDb().users.find((u) => u.role === 'PRINCIPAL');
  teacher = readDb().users.find((u) => u.role === 'TEACHER');
});
const roleCodes = async (role) => (await repo.getRolePermissions(principal)).find((r) => r.role === role).permissions;

test('mock C2/C3: có cột Tổ trưởng, HT tick được 8 mã, cấu hình mặc định không lỗi', async () => {
  const roles = await repo.getRolePermissions(principal);
  const ht = roles.find((r) => r.role === 'PRINCIPAL');
  assert.equal(ht.editable, true);
  assert.deepEqual(ht.configurablePermissions, [...EDU_WORKFLOW_CODES].sort());
  assert.ok(roles.find((r) => r.role === 'TEAM_LEADER').permissions.includes('EDU_TEAM_PLAN_EDIT'));
  assert.deepEqual(await repo.getEduWorkflowIssues(principal), { issues: [] });
});

test('mock C1: lưu hàng loạt chuyển HT soạn năm học trong một lần', async () => {
  const vp = (await roleCodes('VICE_PRINCIPAL')).filter((c) => c !== 'EDU_SCHOOL_YEAR_PLAN_EDIT');
  const result = await repo.updateRolePermissionsBulk(
    {
      reason: 'HT tự soạn kế hoạch năm',
      roles: [
        { role: 'PRINCIPAL', permissions: ['EDU_SCHOOL_YEAR_PLAN_EDIT'] },
        { role: 'VICE_PRINCIPAL', permissions: vp },
      ],
    },
    principal,
  );
  assert.deepEqual(
    result.find((r) => r.role === 'PRINCIPAL').permissions.filter((c) => c.startsWith('EDU_')),
    ['EDU_SCHOOL_YEAR_PLAN_EDIT'],
  );
  const logs = (await repo.getPermissionChangeLogs({}, principal)).items;
  assert.equal(new Set(logs.map((l) => l.batchId)).size, 1);
});

test('mock C1: sai luật ⇒ 400 7202 + issues, không lưu gì', async () => {
  const before = structuredClone(readDb().permissionCenterRoleRows);
  await assert.rejects(
    repo.updateRolePermissionsBulk({ reason: 'Bỏ HT duyệt', roles: [{ role: 'PRINCIPAL', permissions: [] }] }, principal),
    (error) => error.status === 400 && error.errorCode === 7202 && error.details.issues[0].rule === 'NO_REVIEWER',
  );
  assert.deepEqual(readDb().permissionCenterRoleRows, before);
  await assert.rejects(
    repo.updateRolePermissionsBulk(
      {
        reason: 'Lặp',
        roles: [
          { role: 'TEACHER', permissions: [] },
          { role: 'TEACHER', permissions: [] },
        ],
      },
      principal,
    ),
    (error) => error.status === 400,
  );
});

test('US4.2: ngoại lệ theo người không có 8 mã soạn/duyệt; gửi mã đó bị 1120', async () => {
  const view = await repo.getPermissionOverrides(teacher.id, principal);
  assert.ok(!view.configurablePermissions.some((c) => EDU_WORKFLOW_CODES.includes(c)));
  await assert.rejects(
    repo.updatePermissionOverrides(
      teacher.id,
      { overrides: [{ permission: 'EDU_THEME_PLAN_EDIT', effect: 'REVOKE' }], reason: 'Thử' },
      principal,
    ),
    (error) => error.status === 403 && error.errorCode === 1120,
  );
  const rows = withoutEduWorkflowRows(
    permissionDraftRows(
      { configurablePermissions: ['CHILD_PROFILE_VIEW', 'EDU_THEME_PLAN_EDIT'], overrides: [] },
      ['EDU_THEME_PLAN_EDIT'],
      undefined,
    ),
  );
  assert.deepEqual(
    rows.map((r) => r.code),
    ['CHILD_PROFILE_VIEW'],
  );
  assert.deepEqual(overridesFromSwitches(rows, { CHILD_PROFILE_VIEW: true, EDU_THEME_PLAN_EDIT: false }), [
    { permission: 'CHILD_PROFILE_VIEW', effect: 'GRANT' },
  ]);
});

test('US4.1: bỏ tab Soạn / duyệt, link cũ chuyển về Mặc định theo vai trò', () => {
  const routes = readFileSync(new URL('../../src/routes/AppRoutes.jsx', import.meta.url), 'utf8');
  assert.match(routes, /path="edu-workflow" element=\{<Navigate to="\/school\/roles" replace \/>\}/);
  assert.doesNotMatch(routes, /EduWorkflowPermissionsPage/);
  const tabs = readFileSync(new URL('../../src/components/permissions/PermissionTabs.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(tabs, /edu-workflow/);
});
