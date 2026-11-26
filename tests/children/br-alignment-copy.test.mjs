import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = (path) => readFileSync(new URL('../../src/' + path, import.meta.url), 'utf8');

test('Giới hạn dị ứng và họ tên phụ huynh', () => {
  assert.match(source('components/children/HealthDeclarationFields.jsx'), /maxItemLength=\{100\}/);
  assert.match(source('components/children/ChildInfoFields.jsx'), /maxLength=\{150\}/);
});

test('Nội dung xác nhận trả trẻ, chuyển lớp và cấp lại mật khẩu', () => {
  const pickup = source('components/pickup/PickupVerifyFlow.jsx');
  assert.ok(pickup.includes('ở lại lớp. Nội dung cuộc gọi được lưu.`'));
  assert.ok(pickup.includes("'Đã ghi nhận không trả trẻ.'"));
  assert.ok(source('pages/children/ClassPlacementPage.jsx').includes('Giáo viên lớp cũ và lớp mới được thông báo.'));
  for (const page of ['components/account/GuardianPanel.jsx', 'pages/children/ParentActivationPage.jsx']) {
    assert.match(source(page), /Cấp lại mật khẩu tạm cho/);
    assert.doesNotMatch(source(page), /Cấp mật khẩu mới/);
  }
});
