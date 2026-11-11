import assert from 'node:assert/strict';
import { test } from 'node:test';
import { semesterAssessmentFile, semesterAssessmentRows } from '@/utils/assessment/semesterAssessmentDoc';
import { createAssessmentBeApi } from '@/services/assessment/api/assessmentApi';
const board = {
  classId: 1,
  className: 'TEST <A>',
  yearName: '2026-2027',
  semester: 2,
  startDate: '2027-01-15',
  endDate: '2027-05-31',
  status: 'DRAFT',
  note: '<script>alert(1)</script>',
  domains: [
    { domainId: 4, name: 'Thể chất' },
    { domainId: 5, name: 'Ngôn ngữ' },
  ],
  rows: [
    {
      childId: 7,
      fullName: 'TEST & CHILD',
      domains: [
        { domainId: 4, met: true },
        { domainId: 5, met: null },
      ],
    },
    {
      childId: 8,
      fullName: 'TEST B',
      domains: [
        { domainId: 4, met: false },
        { domainId: 5, met: true },
      ],
    },
  ],
};
test('semester print uses configured dates, paired columns and escapes child/note; missing stays blank', () => {
  const file = semesterAssessmentFile(board);
  assert.match(file.html, /15\/01\/2027/);
  assert.match(file.html, /31\/05\/2027/);
  assert.match(file.html, /Học kỳ II/);
  assert.match(file.html, /TEST &amp; CHILD/);
  assert.match(file.html, /&lt;script&gt;/);
  assert.ok(!file.html.includes('<script>'));
  assert.match(file.html, /<td>x<\/td><td><\/td><td><\/td><td><\/td>/);
  assert.match(file.html, /ngày \.{5} tháng \.{5} năm \.{10}/);
  assert.match(
    file.html,
    /GIÁO VIÊN CHỦ NHIỆM[\s\S]*DUYỆT KẾ HOẠCH[\s\S]*Từ ngày 15\/01\/2027 đến ngày 31\/05\/2027[\s\S]*Tổ trưởng chuyên môn[\s\S]*Phó hiệu trưởng/,
  );
  assert.equal(file.html.match(/class="sign"/g)?.length, 3);
  // Chỗ ký sửa / thêm được ở hộp xem trước (Cần 10/11/2026): người đầu ký trên, còn lại ở Duyệt kế hoạch
  const edited = file.withSigners([...file.signers, { title: 'Hiệu trưởng', name: 'Cô Lan' }]);
  assert.equal(edited.match(/class="sign"/g)?.length, 4);
  assert.ok(edited.includes('Hiệu trưởng') && edited.includes('Cô Lan'));
  const confirmed = semesterAssessmentFile({ ...board, status: 'CONFIRMED', confirmedAt: '2027-05-31T18:00:00Z' });
  assert.match(confirmed.html, /ngày 1 tháng 6 năm 2027/);
  const rows = semesterAssessmentRows(board);
  assert.deepEqual(rows[4], [1, 'TEST & CHILD', 'x', '', '', '']);
  assert.deepEqual(rows[5], [2, 'TEST B', '', 'x', 'x', '']);
});
test('semester facade calls dedicated read/save/confirm endpoints without computing results', async () => {
  const calls = [];
  const api = createAssessmentBeApi({
    get: (...args) => calls.push(['GET', ...args]),
    put: (...args) => calls.push(['PUT', ...args]),
    post: (...args) => calls.push(['POST', ...args]),
  });
  const params = { classId: 1, semester: 2 };
  const body = { ...params, note: 'TEST' };
  await api.getSemesterAssessment(params);
  await api.saveSemesterAssessment(body);
  await api.confirmSemesterAssessment(body);
  assert.deepEqual(calls, [
    ['GET', '/assessment/semester-evaluations', { params }],
    ['PUT', '/assessment/semester-evaluations', body],
    ['POST', '/assessment/semester-evaluations/confirm', body],
  ]);
});
