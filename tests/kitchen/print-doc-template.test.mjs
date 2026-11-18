import assert from 'node:assert/strict';
import { test } from 'node:test';
import { docHeaderHtml, docHeaderLines, signCells, signDateText, signRowHtml } from '../../src/components/print/docTemplate.js';

const TPL = { schoolName: 'TRƯỜNG MẦM NON A', address: 'Thôn B, xã Thượng Hồng, tỉnh Hưng Yên' };

test('đầu trang: cơ quan chủ quản + tên trường bên trái, quốc hiệu bên phải', () => {
  assert.deepEqual(docHeaderLines(TPL), {
    left: ['UBND XÃ THƯỢNG HỒNG', 'TRƯỜNG MẦM NON A'],
    right: ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc'],
  });
  assert.deepEqual(docHeaderLines({ ...TPL, address: 'Hà Nội' }).left, ['TRƯỜNG MẦM NON A']);
  assert.match(docHeaderHtml(TPL), /UBND XÃ THƯỢNG HỒNG<br\/>TRƯỜNG MẦM NON A/);
});

test('dòng nơi, ngày ký: có ngày thì ghi số, không có thì để chấm', () => {
  assert.equal(signDateText('2026-11-08', TPL), 'Thượng Hồng, ngày 8 tháng 11 năm 2026');
  assert.equal(signDateText('', TPL), 'Thượng Hồng, ngày …… tháng …… năm ……');
  assert.equal(signDateText(null, { ...TPL, address: '' }), 'ngày …… tháng …… năm ……');
});

test('dòng ngày ký chỉ nằm trên ô người ký chính (mặc định ô cuối), chức danh in hoa', () => {
  const cells = signCells([{ title: 'Người lập' }, { title: 'Hiệu trưởng', name: ' Lan ' }], { date: '2026-11-18', template: TPL });
  assert.deepEqual(cells, [
    { title: 'NGƯỜI LẬP', name: '', dateLine: '' },
    { title: 'HIỆU TRƯỞNG', name: 'Lan', dateLine: 'Thượng Hồng, ngày 18 tháng 11 năm 2026' },
  ]);
  assert.equal(signCells([{ title: 'A' }, { title: 'B' }], { lead: 0, template: TPL })[0].dateLine.startsWith('Thượng Hồng'), true);
});

test('hàng ký HTML: chia đều cột, escape họ tên, rỗng khi không có người ký', () => {
  const html = signRowHtml([{ title: 'Người lập', name: '<b>x</b>' }, { title: 'Hiệu trưởng' }, { title: 'Bếp' }], {
    template: TPL,
  });
  assert.equal((html.match(/width:33%/g) || []).length, 3);
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /\(Ký, ghi rõ họ tên\)/);
  assert.equal(signRowHtml([]), '');
});
