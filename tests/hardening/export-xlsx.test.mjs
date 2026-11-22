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

// File tải từ hộp xem trước phải kẻ bảng giống màn xem trước: tiêu đề không viền, tiêu đề cột 'head', dữ liệu đủ ô có viền
test('rowsToSheet styles title, header and data rows like the export preview', async () => {
  const { rowsToSheet } = await import('@/utils/exportXlsx');
  const sheet = rowsToSheet(
    [['Báo cáo tháng 10'], ['Trẻ', 'Số ngày', 'Ghi chú'], ['Lớp A1'], ['Bé A', 2], ['Bé B', 0, { v: 'x', s: 'note' }]],
    { headerRow: 1 },
  );
  assert.deepEqual(sheet.rows[0], [{ v: 'Báo cáo tháng 10', s: 'title' }]);
  assert.deepEqual(sheet.rows[1].map((c) => c.s), ['head', 'head', 'head']);
  assert.deepEqual(sheet.rows[2], [{ v: 'Lớp A1', s: 'bold' }]);
  assert.deepEqual(sheet.rows[3], [{ v: 'Bé A', s: 'cell' }, { v: 2, s: 'num' }, { v: null, s: 'cell' }]);
  assert.deepEqual(sheet.rows[4][2], { v: 'x', s: 'note' });
  assert.ok(sheet.cols[0] < 'Báo cáo tháng 10'.length + 2);
});

// Tên file tải về: bỏ phần ngày/tháng dữ liệu, chỉ gắn dấu thời gian yyyyMMddHHmmss giờ Việt Nam để mỗi lần tải một tên
test('stampFileName replaces data dates with a Vietnam-time yyyyMMddHHmmss stamp', async () => {
  const { stampFileName } = await import('@/utils/exportXlsx');
  const now = new Date('2026-11-15T02:45:00Z'); // 09:45:00 giờ Việt Nam
  assert.equal(stampFileName('so-suat-an-2026-11-15.xlsx', now), 'so-suat-an-20261115094500.xlsx');
  assert.equal(stampFileName('don-nghi-2026-11-01-2026-11-15.xlsx', now), 'don-nghi-20261115094500.xlsx');
  assert.equal(stampFileName('phieu-be-ngoan-Lop-A-2026-11.xlsx', now), 'phieu-be-ngoan-Lop-A-20261115094500.xlsx');
  assert.equal(stampFileName('chat-luong-thang-.xlsx', now), 'chat-luong-thang-20261115094500.xlsx');
  assert.equal(stampFileName('Dinh_luong_di_cho_2026-11-15.xlsx', now), 'Dinh_luong_di_cho-20261115094500.xlsx');
  assert.equal(stampFileName('tre-den-lop-hang-thang.csv', now), 'tre-den-lop-hang-thang-20261115094500.xlsx');
  // Nửa đêm giờ Việt Nam đã sang ngày mới theo UTC+7
  assert.equal(stampFileName('a.xlsx', new Date('2026-11-14T17:00:05Z')), 'a-20261115000005.xlsx');
  // Đã có dấu thời gian thì không gắn lần hai; năm học 2026-2027 không bị coi là ngày
  assert.equal(stampFileName('a-20261115094500.xlsx', now), 'a-20261115094500.xlsx');
  assert.equal(stampFileName('ke-hoach-2026-2027.xlsx', now), 'ke-hoach-2026-2027-20261115094500.xlsx');
});
