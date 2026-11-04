import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMenuForRole } from '@/layouts/menuConfig';
import { ROLES } from '@/models/User';
import { principalSigns } from '@/models/education-plan/eduConfig';

const eduKeys = (role, hidden) => (getMenuForRole(role, { id: 'u', role }, hidden).find((m) => m.key === 'education')?.children || []).map((c) => c.key);

test('Hiệu trưởng ký khi có trong chuỗi ký của ít nhất một loại tài liệu', () => {
  assert.equal(principalSigns(null), false);
  assert.equal(principalSigns({ signers: { year: ['TEAM_LEADER', 'VICE_PRINCIPAL'] } }), false);
  assert.equal(principalSigns({ signers: { week: ['TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL'] } }), true);
});

test('mục Duyệt kế hoạch, giáo án chỉ ẩn khi được yêu cầu ẩn; mặc định vẫn hiện cho Hiệu trưởng', () => {
  assert.ok(eduKeys(ROLES.PRINCIPAL).includes('eduPlanReviews'));
  assert.ok(!eduKeys(ROLES.PRINCIPAL, ['eduPlanReviews']).includes('eduPlanReviews'));
  assert.ok(eduKeys(ROLES.PRINCIPAL, ['eduPlanReviews']).includes('eduSchool'));
});
