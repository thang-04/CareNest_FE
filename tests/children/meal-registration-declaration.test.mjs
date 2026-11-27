import assert from 'node:assert/strict';
import { test } from 'node:test';

const { emptyDeclaration } = await import('@/utils/children/childrenHelpers');
const { validateDeclaration } = await import('@/utils/children/childrenValidation');

// Tiền sử hợp lệ dùng chung: cả 3 mục khai "Không"
const validHistory = () => ({
  self: { state: 'NONE_REPORTED', text: '' },
  family: { state: 'NONE_REPORTED', text: '' },
  tbContact: { state: 'NONE_REPORTED' },
});

const declaration = (mealRegistered) => ({
  ...emptyDeclaration(),
  mealRegistered,
  allergies: { state: 'REPORTED', items: [] },
  diet: { state: 'REPORTED', text: '' },
  medicalHistory: validHistory(),
});

test('khai báo trống mặc định báo ăn', () => {
  assert.equal(emptyDeclaration().mealRegistered, true);
});

test('không báo ăn: dị ứng, chế độ ăn chưa đủ vẫn hợp lệ', () => {
  assert.deepEqual(validateDeclaration(declaration(false)), {});
});

test('báo ăn: dị ứng Có mà chưa nhập chất vẫn lỗi', () => {
  const errors = validateDeclaration(declaration(true));
  assert.equal(errors.allergies, 'Nhập ít nhất một thực phẩm/chất gây dị ứng');
});

test('giá trị Báo ăn lạ báo lỗi', () => {
  const errors = validateDeclaration(declaration('Ăn trưa'));
  assert.equal(errors.mealRegistered, 'Báo ăn ghi Có hoặc Không');
});
