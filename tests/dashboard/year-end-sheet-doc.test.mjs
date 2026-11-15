import assert from 'node:assert/strict';
import { test } from 'node:test';

const { yearEndSheetFile } = await import('@/utils/assessment/yearEndSheetDoc');

const args = {
  sheet: { teachers: ['Cô Hương', 'Cô Anh'], domains: [], notes: {} },
  ev: { periodStart: '2026-09-01', periodEnd: '2027-05-31', childName: 'Bé A', className: 'Lớp A1' },
  child: { fullName: 'Bé A' },
  comment: '',
};

test('phiếu cuối năm: chỗ ký mặc định GV + BGH, sửa / thêm người ký ở hộp xem trước (Cần 10/11/2026)', () => {
  const file = yearEndSheetFile(args);
  assert.deepEqual(
    file.signers.map((s) => s.title),
    ['Giáo viên', 'Xác nhận của BGH nhà trường'],
  );
  assert.ok(file.html.includes('Cô Hương, Cô Anh'));
  assert.ok(file.html.includes('(Kí tên và đóng dấu)'));
  const edited = file.withSigners([...file.signers, { title: 'Hiệu trưởng', name: 'Cô Lan' }]);
  assert.equal(edited.match(/class="sign"/g)?.length, 3);
  assert.ok(edited.includes('Hiệu trưởng') && edited.includes('Cô Lan'));
});
