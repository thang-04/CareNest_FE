import assert from 'node:assert/strict';
import { test } from 'node:test';

const { themeEvaluationFile } = await import('@/utils/assessment/themeEvaluationDoc');

const ev = {
  className: 'Mẫu giáo bé A2',
  themeName: 'Bản thân bé',
  startDate: '2026-10-05',
  endDate: '2026-10-30',
  goals: [
    { goalId: 1, goalNo: 8, metChildren: 1, rate: 50 },
    { goalId: 2, goalNo: 9, metChildren: 2, rate: 100 },
  ],
  rows: [
    {
      childId: 1,
      fullName: 'Bé <A>',
      cells: [
        { goalId: 1, met: true },
        { goalId: 2, met: true },
      ],
      met: 2,
      notMet: 0,
    },
    {
      childId: 2,
      fullName: 'Bé B',
      cells: [
        { goalId: 1, met: false },
        { goalId: 2, met: true },
      ],
      met: 1,
      notMet: 1,
    },
  ],
  assessedChildren: 2,
  passedChildren: 1,
  notPassedChildren: 1,
  passPercent: 70,
  note: 'Rèn thêm',
  signers: { teachers: ['Cô Hương', 'Cô Anh'], teamLeaders: ['Cô Hân'], vicePrincipal: 'Cô Bình' },
};

test('bản in đánh giá cuối chủ đề theo mẫu giấy: tiêu đề, cột mục tiêu, Tổng số Đ/KĐ, tổng, chỗ ký GVCN và duyệt kế hoạch', () => {
  const { html, name } = themeEvaluationFile({ ...ev, confirmedAt: '2026-10-24T18:30:00Z' });
  assert.equal(name, 'Đánh giá cuối chủ đề - Bản thân bé - Mẫu giáo bé A2');
  for (const text of [
    'BẢNG ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ',
    'Chủ đề: Bản thân bé',
    '(Từ ngày 5/10/2026 đến ngày 30/10/2026)',
    'Các mục tiêu giáo dục (Đạt + chưa đạt -)',
    '<th colspan="2">Tổng số</th>',
    '<th>8</th><th>9</th><th>Đ</th><th>KĐ</th>',
    'Tổng số trẻ đạt',
    'Tỷ lệ',
    'Tổng số trẻ được đánh giá: 2',
    'Số trẻ đạt 70% trở lên: 1 trẻ',
    'Số trẻ đạt dưới 70%: 1 trẻ',
    'Rèn thêm',
    'Thượng Hồng, ngày 25 tháng 10 năm 2026',
    'GIÁO VIÊN CHỦ NHIỆM',
    'Cô Hương<br/>Cô Anh',
    'DUYỆT KẾ HOẠCH',
    'Từ ngày 5/10 đến ngày 30/10/2026',
    'Tổ trưởng chuyên môn',
    'Cô Hân',
    'Phó hiệu trưởng',
    'Cô Bình',
  ]) {
    assert.ok(html.includes(text), text);
  }
  assert.ok(html.includes('Bé &lt;A&gt;'), 'tên trẻ được escape');
  assert.ok(!html.includes('TRƯỜNG MẦM NON'), 'mẫu không có dòng tên trường');
});

test('bản in: chưa xác nhận thì để chấm ngày ký; chưa xác định người ký thì để trống cho ký tay', () => {
  const { html } = themeEvaluationFile({ ...ev, signers: undefined });
  assert.ok(html.includes('ngày ..... tháng ..... năm') && html.includes('Phó hiệu trưởng') && !html.includes('undefined'));
});
