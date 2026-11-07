import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.window = new EventTarget();
const docs = await import('@/utils/education-plan/classPlanDoc');

// Tháng 9/2098: Thứ 2 là 08, 15, 22, 29
const yearPlan = {
  schoolYear: '2098-2099',
  themes: [
    { id: 't1', name: 'Trường mầm non', start: '2098-09-08', end: '2098-10-03' },
    { id: 't2', name: 'Bản thân', start: '2098-10-06', end: '2098-10-10' },
  ],
  breaks: [{ label: 'Nghỉ Ôn tập', start: '2098-09-22', end: '2098-09-26' }],
};
const doc = { names: { '2098-09-08': 'Lớp học của bé' }, notes: { '2098-09-08': 'ghi chú cũ' }, approvals: [] };
const args = { doc, cls: { name: 'Lớp Chồi 2' }, yearPlan, teachers: [{ fullName: 'Trần Thị Mai' }], leaderName: 'Nguyễn Thị Lan' };

test('mẫu nhập chủ đề nhánh giữ đúng bảng của file xuất, bỏ tên nhánh, ghi chú, họ tên (Tiền 05/11)', () => {
  const file = docs.branchTemplateFile(args);
  const exported = docs.branchFile(args).html;
  assert.equal(file.name, 'Mẫu nhập chủ đề nhánh - Lớp Chồi 2');
  for (const html of [file.html, exported]) {
    assert.match(html, /DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN NĂM HỌC 2098 - 2099 - LỚP CHỒI 2/);
    assert.match(html, /<th>Tháng<\/th><th>Chủ đề<\/th><th>Chủ đề nhánh<\/th><th>Số tuần<\/th><th>Ghi chú<\/th>/);
    assert.match(html, /<b>TRƯỜNG MẦM NON<\/b>/);
    assert.match(html, /Tuần 1: 08\/09\/2098/);
    assert.match(html, /<i>Nghỉ Ôn tập từ ngày 22\/09\/2098/);
    assert.doesNotMatch(html, /Nghỉ Nghỉ/);
  }
  assert.match(exported, /- Nhánh 1: Lớp học của bé/);
  assert.match(file.html, /<td>- Nhánh 1: <\/td>/);
  assert.doesNotMatch(file.html, /Lớp học của bé|ghi chú cũ|Trần Thị Mai|Nguyễn Thị Lan/);
  assert.deepEqual(doc.names, { '2098-09-08': 'Lớp học của bé' });
});
