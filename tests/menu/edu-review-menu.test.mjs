import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { principalSigns } from '@/models/education-plan/eduConfig';

const eduKeys = (role, hidden) =>
  (getMenuForRole(role, { id: 'u', role }, hidden).find((m) => m.key === 'education')?.children || []).map((c) => c.key);

test('sidebar Hiệu trưởng đặt kế hoạch giáo dục trước đánh giá trẻ', () => {
  const keys = getMenuForRole(ROLES.PRINCIPAL, { id: 'u', role: ROLES.PRINCIPAL }).map((entry) => entry.key);
  assert.ok(keys.includes('education') && keys.includes('assessment'));
  assert.ok(keys.indexOf('education') < keys.indexOf('assessment'));
});

test('Hiệu trưởng ký khi có trong chuỗi ký của ít nhất một loại tài liệu', () => {
  assert.equal(principalSigns(null), true);
  assert.equal(principalSigns({ signers: { year: ['TEAM_LEADER', 'VICE_PRINCIPAL'] } }), true);
  assert.equal(
    principalSigns({
      workflowPolicy: { schoolYear: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL'] } },
      signers: { year: ['VICE_PRINCIPAL'], branch: ['TEAM_LEADER'], week: ['TEAM_LEADER'] },
    }),
    false,
  );
  assert.equal(principalSigns({ signers: { week: ['TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL'] } }), true);
});

test('mục Duyệt kế hoạch giáo dục chỉ ẩn khi được yêu cầu ẩn; mặc định vẫn hiện cho Hiệu trưởng', () => {
  assert.ok(eduKeys(ROLES.PRINCIPAL).includes('eduPlanReviews'));
  assert.ok(!eduKeys(ROLES.PRINCIPAL, ['eduPlanReviews']).includes('eduPlanReviews'));
  assert.ok(eduKeys(ROLES.PRINCIPAL, ['eduPlanReviews']).includes('eduSchoolYear'));
  assert.ok(eduKeys(ROLES.PRINCIPAL).includes('eduGoals'));
});
