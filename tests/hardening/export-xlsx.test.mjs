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


test('workbook exports separate full daily and child tables without turning text into formulas', async () => {
  const { buildWorkbookXlsx } = await import('@/utils/exportXlsx');
  const rows = Array.from({ length: 45 }, (_, i) => [`${i + 1}/10/2026`, i]);
  const blob = buildWorkbookXlsx([
    { sheetName: 'Theo ngày', rows: [['Ngày', 'Có mặt'], ...rows], headerRow: 0 },
    { sheetName: 'Theo trẻ', rows: [['Trẻ', 'Có mặt'], ['=1+1', 12]], headerRow: 0 },
  ]);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const result = await readXlsxFile(buffer);
  assert.deepEqual(result.map((s) => s.sheet), ['Theo ngày', 'Theo trẻ']);
  const daily = result[0].data;
  assert.equal(daily.length, 46);
  assert.deepEqual(daily.at(-1), ['45/10/2026', 44]);
  assert.deepEqual(result[1].data[1], ['=1+1', 12]);
});

// Excel đọc ZIP theo central directory (read-excel-file thì không), nên kích thước/vị trí trong EOCD phải khớp từng byte
test('xlsx zip end record points exactly at the central directory', async () => {
  const { buildWorkbookXlsx } = await import('@/utils/exportXlsx');
  const blobs = [
    buildXlsx([['Tiêu đề'], ['A', 'B'], [1, 'x']], { headerRow: 1 }),
    buildWorkbookXlsx([
      { sheetName: 'M1', rows: [['A'], [1]] },
      { sheetName: 'M2', rows: [['B'], [2]] },
    ]),
  ];
  for (const blob of blobs) {
    const bytes = Buffer.from(await blob.arrayBuffer());
    const eocd = bytes.length - 22;
    assert.equal(bytes.readUInt32LE(eocd), 0x06054b50);
    const entries = bytes.readUInt16LE(eocd + 10);
    const cdSize = bytes.readUInt32LE(eocd + 12);
    const cdOffset = bytes.readUInt32LE(eocd + 16);
    assert.equal(cdOffset + cdSize, eocd);
    let pos = cdOffset;
    for (let i = 0; i < entries; i += 1) {
      assert.equal(bytes.readUInt32LE(pos), 0x02014b50);
      pos += 46 + bytes.readUInt16LE(pos + 28) + bytes.readUInt16LE(pos + 30) + bytes.readUInt16LE(pos + 32);
    }
    assert.equal(pos, eocd);
  }
});
