import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { examSheetFileName, examSheetPageSlices } from '@/utils/children/examSheetPdf';

// G94-399 (BUG-26): phiếu kiểm tra sức khỏe xuất được file PDF khổ A4, giữ bố cục phiếu, không cắt ngang dòng của bảng.

test('tên file theo mã trẻ và ngày khám', () => {
  assert.equal(examSheetFileName({ code: 'HS26157' }, '2026-09-23'), 'PhieuKham_HS26157_2026-09-23.pdf');
  // Ký tự không hợp lệ trong tên file bị bỏ
  assert.equal(examSheetFileName({ code: 'HS 26/157' }, '2026-09-23'), 'PhieuKham_HS26157_2026-09-23.pdf');
});

test('ngắt trang ở ranh giới dòng, không cắt ngang một dòng', () => {
  const rows = [40, 80, 120, 160, 200, 240];
  assert.deepEqual(examSheetPageSlices(rows, 100, 240), [
    [0, 80],
    [80, 160],
    [160, 240],
  ]);
});

test('phần sau dòng cuối (lề thẻ) vào trang cuối; dòng cao hơn một trang thì cắt theo trang', () => {
  assert.deepEqual(examSheetPageSlices([40, 90], 100, 120), [
    [0, 90],
    [90, 120],
  ]);
  assert.deepEqual(examSheetPageSlices([250], 100, 250), [
    [0, 100],
    [100, 200],
    [200, 250],
  ]);
});

test('phiếu chỉ đọc có nút Xuất file cạnh tiêu đề, nút không lọt vào file', () => {
  const src = readFileSync('src/components/children/exam/ExamSummary.jsx', 'utf8');
  assert.match(src, /exportExamSheetPdf\(sheetRef\.current, examSheetFileName\(child, m\.date\)\)/);
  assert.match(src, /data-html2canvas-ignore/);
  assert.match(src, /Xuất file/);
});
