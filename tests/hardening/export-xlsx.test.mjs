import assert from 'node:assert/strict';
import { test } from 'node:test';

const { buildXlsx } = await import('@/utils/exportXlsx');
const { default: readXlsxFile } = await import('read-excel-file/node');

// File .xlsx tự tạo phải đọc lại được đúng chữ tiếng Việt, số và không chạy công thức trong dữ liệu
test('xlsx export round-trips Vietnamese text, numbers and formula-like strings', async () => {
  const rows = [
    ['Đơn nghỉ của phụ huynh 01/10/2026 – 31/10/2026'],
    ['Trẻ', 'Lớp', 'Số ngày'],
    ['Huỳnh Đức Lâm', 'Nhà trẻ A1', 2],
    ['=1+1', '<b>&"', 0],
  ];
  const blob = buildXlsx(rows, { sheetName: 'Đơn nghỉ', headerRow: 1 });
  const buffer = Buffer.from(await blob.arrayBuffer());
  const sheets = await readXlsxFile(buffer);
  const data = Array.isArray(sheets[0]?.data) ? sheets[0].data : sheets;
  assert.equal(data[0][0], 'Đơn nghỉ của phụ huynh 01/10/2026 – 31/10/2026');
  assert.deepEqual(data[1], ['Trẻ', 'Lớp', 'Số ngày']);
  assert.deepEqual(data[2], ['Huỳnh Đức Lâm', 'Nhà trẻ A1', 2]);
  assert.equal(data[3][0], '=1+1');
  assert.equal(data[3][1], '<b>&"');
});
