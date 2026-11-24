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

test('EDU-73 (Tiền 24/11/2026): người chỉ xem không thuộc lớp thấy lịch nhánh theo các gói học kỳ đã ban hành ở "Tất cả"', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../../src/pages/education-plan/BranchPlanPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /ctx\.branchPlan \|\| \(packages\.length \? publishedBranchCalendar\(ctx\.yearPlan, packages\) : null\)/);
  const { publishedBranchCalendar } = await import('@/models/education-plan/branchCalendar.mjs');
  const plan = { themes: [{ id: 't1', startDate: '2026-09-07', endDate: '2026-09-18' }], breaks: [] };
  const cal = publishedBranchCalendar(plan, [
    { status: 'APPROVED', themeIds: ['t1'], branchNames: { '2026-09-07': 'Nhánh A' } },
    { status: 'REVIEW', themeIds: ['t2'], branchNames: { '2026-10-05': 'Nhánh chờ' } },
  ]);
  assert.deepEqual([...cal.themeIds], ['t1']);
  assert.equal(cal.names['2026-10-05'], undefined);
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
