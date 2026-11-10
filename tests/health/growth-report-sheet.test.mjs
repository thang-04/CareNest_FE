import assert from 'node:assert/strict';
import { test } from 'node:test';

const { readSheet } = await import('read-excel-file/node');
const { buildXlsx, columnName, crc32, XLSX_STYLES } = await import('@/utils/exportXlsx');
const { buildGrowthReportSheet, GROWTH_SHEET_HEAD_ROW, growthReportFileName } = await import('@/utils/children/growthReportSheet');
const { formatPct, growthReportRowsOf, monthLabelOf, pctOf } = await import('@/utils/children/growthReport');

const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

/*
 * File Excel của báo cáo tổng hợp cân đo mẫu 5.1 (plan docs/plans/active/2026-11-04-health-growth-report.md): bố cục giống bảng
 * trên trang, ghi bằng writer .xlsx tối giản (utils/exportXlsx) và đọc lại bằng read-excel-file. Dữ liệu giả.
 */
const counts = (fields = {}) => ({
  enrolled: 0,
  measured: 0,
  weightNormal: 0,
  underweight: 0,
  heightNormal: 0,
  stunted: 0,
  bmiNormal: 0,
  wasted: 0,
  overweight: 0,
  obese: 0,
  unclassified: 0,
  ...fields,
});
const LA = counts({ enrolled: 7, measured: 6, weightNormal: 5, underweight: 1, heightNormal: 6, bmiNormal: 4, wasted: 1, obese: 1 });
const NT = counts({ enrolled: 4, measured: 0 });
const REPORT = {
  month: '2026-11',
  campuses: [
    {
      campusId: 'c1',
      campusName: 'Campus 1 - Trường Mầm Non (giả)',
      campaigns: [
        {
          id: 'k1',
          name: 'Cân đo tháng 11 (giả)',
          kind: 'MEASUREMENT',
          status: 'IN_PROGRESS',
          startDate: '2026-11-02',
          endDate: '2026-11-09',
        },
      ],
      classes: [
        { classId: 'la', className: 'Lớp Lá (giả)', ageGroupName: 'Mẫu giáo lớn (5–6 tuổi)', level: 'PRESCHOOL', counts: LA },
        { classId: 'nt', className: 'Lớp Nhà trẻ (giả)', ageGroupName: 'Nhà trẻ (24–36 tháng)', level: 'NURSERY', counts: NT },
      ],
      preschool: LA,
      nursery: NT,
      total: counts({ ...LA, enrolled: 11 }),
    },
    {
      campusId: 'c2',
      campusName: 'Campus 2 - Trường Mầm Non (giả)',
      campaigns: [],
      classes: [],
      preschool: counts(),
      nursery: counts(),
      total: counts(),
    },
  ],
  preschool: LA,
  nursery: NT,
  total: counts({ ...LA, enrolled: 11 }),
};

test('Tỉ lệ một chữ số thập phân kiểu Việt Nam; mẫu số 0 ⇒ "–"', () => {
  assert.equal(pctOf(6, 7), 85.7);
  assert.equal(pctOf(1, 8), 12.5);
  assert.equal(pctOf(0, 0), null);
  assert.equal(formatPct(85.7), '85,7');
  assert.equal(formatPct(100), '100,0');
  assert.equal(formatPct(null), '–');
  assert.equal(monthLabelOf('2026-03'), 'Tháng 3/2026');
});

test('Dòng của bảng: dải điểm trường, lớp (TT theo điểm trường), Tổng MG, Tổng NT, tổng điểm trường, điểm trường trống, toàn trường', () => {
  const rows = growthReportRowsOf(REPORT);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.label, r.tt ?? null]),
    [
      ['band', 'Campus 1 - Trường Mầm Non (giả)', null],
      ['class', 'Lớp Lá (giả)', 1],
      ['class', 'Lớp Nhà trẻ (giả)', 2],
      ['subtotal', 'Tổng MG', null],
      ['subtotal', 'Tổng NT', null],
      ['campusTotal', 'Tổng Campus 1', null],
      ['band', 'Campus 2 - Trường Mầm Non (giả)', null],
      ['empty', 'Chưa có kỳ cân đo hoặc đợt khám trong tháng này', null],
      ['grandTotal', 'Tổng toàn trường', null],
    ],
  );
  assert.equal(rows[0].provisional, true, 'kỳ đang diễn ra ⇒ số liệu chưa chốt');
  assert.equal(rows[6].provisional, false);
  const one = growthReportRowsOf({ ...REPORT, campuses: [REPORT.campuses[0]] });
  assert.ok(!one.some((r) => r.kind === 'grandTotal'), '1 điểm trường: không có Tổng toàn trường');
});

test('Sheet: tiêu đề mẫu, tháng, phạm vi, 4 dòng tiêu đề gộp, cố định tiêu đề và 2 cột đầu', () => {
  const sheet = buildGrowthReportSheet(REPORT, { scopeLabel: 'Tất cả điểm trường' });
  const h = GROWTH_SHEET_HEAD_ROW;
  assert.equal(sheet.rows[0][0].v, '5.1. Kết quả theo dõi cân nặng - chiều cao - cân nặng/chiều cao (BMI)');
  assert.equal(sheet.rows[1][0].v, 'Tháng 11/2026');
  assert.equal(sheet.rows[2][0].v, 'Điểm trường: Tất cả điểm trường');
  assert.deepEqual(
    sheet.rows[h].slice(0, 6).map((c) => c.v),
    ['TT', 'Tên lớp', 'TS trẻ của lớp', 'TS trẻ được cân đo', 'Tỉ lệ %', 'Tháng 11/2026'],
  );
  const has = (m) =>
    sheet.merges.some((x) => JSON.stringify({ rowSpan: 1, colSpan: 1, ...x }) === JSON.stringify({ rowSpan: 1, colSpan: 1, ...m }));
  [0, 1, 2, 3, 4].forEach((col) => assert.ok(has({ row: h, col, rowSpan: 4 }), `cột ${col} gộp 4 dòng`));
  assert.ok(has({ row: h, col: 5, colSpan: 16 }), 'Tháng gộp 16 cột chỉ số');
  assert.ok(has({ row: h + 1, col: 5, colSpan: 4 }) && has({ row: h + 1, col: 9, colSpan: 4 }) && has({ row: h + 1, col: 13, colSpan: 8 }));
  assert.deepEqual(
    [5, 9, 13].map((c) => sheet.rows[h + 1][c].v),
    ['Theo dõi cân nặng', 'Theo dõi chiều cao', 'Theo dõi cân nặng/chiều cao (BMI)'],
  );
  assert.deepEqual(
    [5, 7, 9, 11, 13, 15, 17, 19].map((c) => sheet.rows[h + 2][c].v),
    ['PTBT', 'SDDNC', 'PTBT', 'SDDTC', 'TS trẻ BT', 'SDD thể GC', 'Thừa cân', 'Béo phì'],
  );
  assert.deepEqual([sheet.rows[h + 3][5].v, sheet.rows[h + 3][6].v, sheet.rows[h + 3][20].v], ['Tổng số', 'Tỷ lệ %', 'Tỷ lệ %']);
  assert.deepEqual(sheet.freeze, { rows: h + 4, cols: 2 });
  assert.equal(sheet.cols.length, 21);
});

test('Sheet: số trẻ, tỉ lệ, ô cảnh báo, dòng tổng, điểm trường trống, ghi chú', () => {
  const sheet = buildGrowthReportSheet(REPORT, { scopeLabel: 'Tất cả điểm trường' });
  const body = sheet.rows.slice(GROWTH_SHEET_HEAD_ROW + 4);
  assert.equal(body[0][0].v, 'Campus 1 - Trường Mầm Non (giả) · Cân đo tháng 11 (giả) · Số liệu chưa chốt');
  assert.equal(body[0][0].s, 'band');
  const la = body[1];
  assert.deepEqual(
    la.map((c) => c.v),
    [1, 'Lớp Lá (giả)', 7, 6, 85.7, 5, 83.3, 1, 16.7, 6, 100, 0, 0, 4, 66.7, 1, 16.7, 0, 0, 1, 16.7],
  );
  assert.deepEqual([la[7].s, la[11].s, la[19].s], ['warnNum', 'num', 'warnNum'], 'SDD, béo phì khác 0 tô cảnh báo');
  // Lớp chưa cân đo: tỉ lệ cân đo 0; tỉ lệ nhóm "–" (mẫu số là số trẻ được cân đo = 0)
  assert.deepEqual(
    body[2].slice(2, 7).map((c) => c.v),
    [4, 0, 0, 0, '–'],
  );
  assert.deepEqual([body[3][1].v, body[3][1].s, body[3][2].s], ['Tổng MG', 'totalCell', 'totalNum']);
  assert.equal(body[5][1].v, 'Tổng Campus 1');
  assert.equal(body[6][0].v, 'Campus 2 - Trường Mầm Non (giả)');
  assert.equal(body[7][1].v, 'Chưa có kỳ cân đo hoặc đợt khám trong tháng này');
  assert.equal(body[8][1].v, 'Tổng toàn trường');
  const texts = sheet.rows.map((r) => r[0]?.v).filter((v) => typeof v === 'string');
  assert.ok(texts.some((t) => t.startsWith('Viết tắt:')));
  assert.ok(texts.includes('Nguy cơ thừa cân (trẻ ≤ 5 tuổi) tính vào BT.'));
  assert.ok(
    texts.some((t) => t.startsWith('Kỳ/đợt dùng ở Campus 1: Kỳ cân đo: Cân đo tháng 11 (giả) (02/11/2026 – 09/11/2026, đang diễn ra)')),
  );
  assert.equal(growthReportFileName('2026-11'), 'tong-hop-can-do-2026-11.xlsx');
});

test('File .xlsx mở lại được (read-excel-file): đúng ô, ô gộp có giá trị ở ô đầu', async () => {
  const sheet = buildGrowthReportSheet(REPORT, { scopeLabel: 'Campus 1' });
  const bytes = await bytesOf(buildXlsx(sheet, { now: new Date(2026, 10, 4, 9, 30) }));
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'chữ ký ZIP');
  const rows = await readSheet(Buffer.from(bytes));
  const h = GROWTH_SHEET_HEAD_ROW;
  assert.equal(rows[0][0], '5.1. Kết quả theo dõi cân nặng - chiều cao - cân nặng/chiều cao (BMI)');
  assert.equal(rows[2][0], 'Điểm trường: Campus 1');
  assert.deepEqual(rows[h].slice(0, 6), ['TT', 'Tên lớp', 'TS trẻ của lớp', 'TS trẻ được cân đo', 'Tỉ lệ %', 'Tháng 11/2026']);
  assert.equal(rows[h + 2][13], 'TS trẻ BT');
  assert.deepEqual(rows[h + 5].slice(0, 7), [1, 'Lớp Lá (giả)', 7, 6, 85.7, 5, 83.3]);
  assert.equal(rows[h + 6][5], 0);
  assert.equal(rows[h + 6][6], '–');
  assert.equal(rows.length >= h + 13, true);
});

test('Writer: chữ cột, CRC32, ký tự đặc biệt được thoát', async () => {
  assert.deepEqual([0, 25, 26, 27, 51, 52, 701, 702].map(columnName), ['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const bytes = await bytesOf(buildXlsx({ name: 'Thử [1]/2', rows: [['<b> & "x"', 3.5, null, 'Tiếng Việt có dấu']] }));
  const rows = await readSheet(Buffer.from(bytes));
  assert.deepEqual(rows[0], ['<b> & "x"', 3.5, null, 'Tiếng Việt có dấu']);
});

// Một writer cho cả bảng thường (điểm danh, đánh giá…: rows[]) và báo cáo theo mẫu (sheet): hai bản cùng tên từng đè nhau khi merge.
test('Writer chung: bảng thường giữ kiểu cũ (tiêu đề cột đậm, cột tự rộng, không đặt khổ in); báo cáo theo mẫu có ô gộp, in ngang', async () => {
  const xmlOf = async (blob) => new TextDecoder().decode(await bytesOf(blob));
  const table = await xmlOf(buildXlsx([['Báo cáo'], ['Trẻ', 'Lớp'], ['An', 'Lá 1']], { sheetName: 'Điểm danh', headerRow: 1 }));
  assert.ok(table.includes(`<c r="A2" s="${XLSX_STYLES.indexOf('plainHead')}" t="inlineStr">`), 'tiêu đề cột in đậm');
  assert.ok(table.includes(`<c r="A3" s="${XLSX_STYLES.indexOf('plain')}" t="inlineStr">`), 'dòng dữ liệu chữ thường');
  assert.ok(table.includes('<col min="1" max="1" width="9" customWidth="1"/>'), 'cột rộng theo nội dung');
  assert.match(table, /<sheet name="Điểm danh"/);
  assert.doesNotMatch(table, /<pageSetup |<mergeCells/);
  const report = await xmlOf(buildXlsx(buildGrowthReportSheet(REPORT, { scopeLabel: 'Campus 1' })));
  assert.match(report, /<mergeCells count="\d+">/);
  assert.match(report, /<pageSetup paperSize="9" orientation="landscape"/);
  assert.match(report, /<sheet name="Mẫu 5.1"/);
});
