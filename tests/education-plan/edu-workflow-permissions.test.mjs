import assert from 'node:assert/strict';
import { test } from 'node:test';

const { isEduVicePrincipal, canEduApprove, canPrincipalPublish } = await import('@/utils/education-plan/eduPermissions');

test('FR6: PHT không có mã nào chỉ xem; mock không có bePermissions giữ hành vi cũ', () => {
  const vp = { role: 'VICE_PRINCIPAL' };
  assert.equal(isEduVicePrincipal(vp), true);
  assert.equal(isEduVicePrincipal({ ...vp, bePermissions: [] }), false);
  assert.equal(isEduVicePrincipal({ ...vp, bePermissions: ['EDU_THEME_PLAN_EDIT'] }), true);
  assert.equal(canEduApprove({ ...vp, bePermissions: ['EDU_THEME_PLAN_EDIT'] }), false);
});

const ht = { role: 'PRINCIPAL' };
const htCreates = { creators: ['PRINCIPAL'], reviewers: [] };

test('EDU-110 (8): HT soạn, chuỗi rỗng ⇒ HT tác giả thấy Ban hành ở Nháp', () => {
  assert.equal(canPrincipalPublish({ user: ht, policy: htCreates, status: 'DRAFT', author: true }), true);
  assert.equal(canPrincipalPublish({ user: ht, policy: htCreates, status: 'DRAFT', author: false }), false);
});

test('EDU-110 (10): hồ sơ Chờ duyệt mà chuỗi đã rỗng ⇒ HT ban hành không cần là tác giả', () => {
  assert.equal(canPrincipalPublish({ user: ht, policy: htCreates, status: 'REVIEW', author: false }), true);
  assert.equal(canPrincipalPublish({ user: ht, policy: htCreates, status: 'APPROVED', author: true }), false);
});

test('Không ban hành thẳng khi người soạn không phải HT, còn chuỗi duyệt, hoặc người xem không phải HT', () => {
  assert.equal(
    canPrincipalPublish({ user: ht, policy: { creators: ['VICE_PRINCIPAL'], reviewers: [] }, status: 'DRAFT', author: true }),
    false,
  );
  assert.equal(
    canPrincipalPublish({ user: ht, policy: { creators: ['PRINCIPAL'], reviewers: ['VICE_PRINCIPAL'] }, status: 'DRAFT', author: true }),
    false,
  );
  assert.equal(canPrincipalPublish({ user: { role: 'VICE_PRINCIPAL' }, policy: htCreates, status: 'REVIEW', author: true }), false);
  assert.equal(canPrincipalPublish({ user: ht, policy: undefined, status: 'DRAFT', author: true }), false);
});
