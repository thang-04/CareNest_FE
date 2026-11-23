import assert from 'node:assert/strict';
import { test } from 'node:test';

const { canTick, creatorOptions, reviewerOptions, toEduWorkflowRequest, toggleCell, validateEduWorkflow } = await import(
  '@/utils/account/eduWorkflowPermissions'
);
const { isEduVicePrincipal, canEduApprove } = await import('@/utils/education-plan/eduPermissions');

const doc = () => ({
  docType: 'SEMESTER_PACKAGE',
  creators: ['TEACHER'],
  reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
  editRoles: ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEAM_LEADER', 'TEACHER'],
  approveRoles: ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEAM_LEADER'],
});

test('FR7.2: HT cố định, GV không có ô duyệt', () => {
  assert.equal(canTick('edit', 'PRINCIPAL'), false);
  assert.equal(canTick('approve', 'TEACHER'), false);
  assert.equal(canTick('approve', 'VICE_PRINCIPAL'), true);
});

test('FR7.3: bỏ tích mã duyệt PHT ⇒ PHT rời chuỗi duyệt; danh sách thêm duyệt chỉ gồm vai trò đã tích', () => {
  const next = toggleCell(doc(), 'approve', 'VICE_PRINCIPAL', false);
  assert.deepEqual(next.reviewers, ['TEAM_LEADER']);
  assert.ok(!next.approveRoles.includes('VICE_PRINCIPAL'));
  assert.deepEqual(reviewerOptions(next), ['PRINCIPAL']);
  assert.deepEqual(creatorOptions(doc()), ['PRINCIPAL', 'TEACHER']);
});

test('FR7.4: báo lỗi khi soạn trùng duyệt, chuỗi rỗng hoặc thiếu người soạn', () => {
  assert.deepEqual(validateEduWorkflow([doc()]), {});
  assert.ok(validateEduWorkflow([{ ...doc(), reviewers: ['TEACHER'] }]).SEMESTER_PACKAGE);
  assert.ok(validateEduWorkflow([{ ...doc(), reviewers: [] }]).SEMESTER_PACKAGE);
  assert.ok(validateEduWorkflow([{ ...doc(), creators: [] }]).SEMESTER_PACKAGE);
  assert.deepEqual(Object.keys(toEduWorkflowRequest(1, [doc()], 'lý do')), ['revision', 'reason', 'documents']);
});

test('FR6: PHT không có mã nào chỉ xem; mock không có bePermissions giữ hành vi cũ', () => {
  const vp = { role: 'VICE_PRINCIPAL' };
  assert.equal(isEduVicePrincipal(vp), true);
  assert.equal(isEduVicePrincipal({ ...vp, bePermissions: [] }), false);
  assert.equal(isEduVicePrincipal({ ...vp, bePermissions: ['EDU_THEME_PLAN_EDIT'] }), true);
  assert.equal(canEduApprove({ ...vp, bePermissions: ['EDU_THEME_PLAN_EDIT'] }), false);
});
