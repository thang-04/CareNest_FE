import {
  GROWTH_COLUMN_COUNT,
  GROWTH_GROUPS,
  GROWTH_ITEMS,
  GROWTH_SHEET_TITLE,
  growthReportNotesOf,
  growthReportRowsOf,
  growthReportSourcesOf,
  monthLabelOf,
  rowValuesOf,
} from './growthReport';

/*
 * Sheet Excel của báo cáo tổng hợp cân đo mẫu 5.1 (hàm thuần, ghi file bằng utils/exportXlsx): dòng tiêu đề mẫu, tháng, phạm vi,
 * 4 dòng tiêu đề gộp như bảng trên trang, rồi từng điểm trường (dải tên, các lớp, Tổng MG, Tổng NT, tổng điểm trường), Tổng toàn
 * trường khi có hơn 1 điểm trường, cuối cùng là ghi chú và kỳ/đợt dùng cho từng điểm trường.
 */

export const GROWTH_SHEET_NAME = 'Mẫu 5.1';
/** Dòng (chỉ số 0) bắt đầu 4 dòng tiêu đề bảng; dữ liệu bắt đầu ở GROWTH_SHEET_HEAD_ROW + 4. */
export const GROWTH_SHEET_HEAD_ROW = 4;

const N = GROWTH_COLUMN_COUNT;
const COL_WIDTHS = [5, 24, 9, 10, 8, ...GROWTH_ITEMS.flatMap(() => [8, 8])];
// Ước lượng số ký tự một dòng ghi chú gộp hết bề ngang bảng (để đặt chiều cao dòng khi xuống dòng).
const NOTE_LINE_CHARS = Math.floor(COL_WIDTHS.reduce((a, b) => a + b, 0) * 1.1);

const TOTAL_KINDS = new Set(['subtotal', 'campusTotal', 'grandTotal']);

const valueCells = (counts, total) => {
  const v = rowValuesOf(counts);
  const num = total ? 'totalNum' : 'num';
  const pct = (value) => (value == null ? { v: '–', s: num } : { v: value, s: total ? 'totalPct' : 'pct' });
  return [
    { v: v.enrolled, s: num },
    { v: v.measured, s: num },
    pct(v.coverage),
    ...v.items.flatMap((it) => [{ v: it.count, s: it.warn ? (total ? 'totalWarnNum' : 'warnNum') : num }, pct(it.pct)]),
  ];
};

const bandText = (row) => {
  const names = row.campaigns.map((c) => c.name).join('; ');
  return [row.label, names, row.provisional ? 'Số liệu chưa chốt' : ''].filter(Boolean).join(' · ');
};

/**
 * report: kết quả GET /health-checks/growth-report; scopeLabel: 'Tất cả điểm trường' hoặc tên điểm trường đang xem.
 * Trả sheet cho buildXlsx/downloadXlsx: { name, rows, merges, cols, rowHeights, freeze }.
 */
export const buildGrowthReportSheet = (report, { scopeLabel = '' } = {}) => {
  const rows = [];
  const merges = [];
  const rowHeights = {};
  const month = monthLabelOf(report.month);
  const fullRow = (cell, style) => {
    merges.push({ row: rows.length, col: 0, colSpan: N });
    rows.push([{ v: cell, s: style }]);
  };

  fullRow(GROWTH_SHEET_TITLE, 'title');
  rowHeights[0] = 22;
  fullRow(month, 'subtitle');
  fullRow(`Điểm trường: ${scopeLabel}`, 'subtitle');
  rows.push([]);

  // 4 dòng tiêu đề: 5 cột đầu gộp dọc; "Tháng m/yyyy" gộp ngang trên các nhóm chỉ số.
  const h = GROWTH_SHEET_HEAD_ROW;
  const head = (v) => ({ v, s: 'head' });
  const r0 = ['TT', 'Tên lớp', 'TS trẻ của lớp', 'TS trẻ được cân đo', 'Tỉ lệ %'].map(head);
  r0.forEach((_, col) => merges.push({ row: h, col, rowSpan: 4 }));
  r0[5] = head(month);
  merges.push({ row: h, col: 5, colSpan: N - 5 });
  const r1 = [];
  const r2 = [];
  const r3 = [];
  let col = 5;
  GROWTH_GROUPS.forEach((group) => {
    r1[col] = head(group.label);
    merges.push({ row: h + 1, col, colSpan: group.items.length * 2 });
    group.items.forEach((item) => {
      r2[col] = head(item.label);
      merges.push({ row: h + 2, col, colSpan: 2 });
      r3[col] = head('Tổng số');
      r3[col + 1] = head('Tỷ lệ %');
      col += 2;
    });
  });
  rows.push(r0, r1, r2, r3);
  [h, h + 1, h + 2, h + 3].forEach((r) => (rowHeights[r] = 30));

  growthReportRowsOf(report).forEach((row) => {
    if (row.kind === 'band') return fullRow(bandText(row), 'band');
    if (row.kind === 'empty') {
      merges.push({ row: rows.length, col: 1, colSpan: N - 1 });
      return rows.push([
        { v: null, s: 'cell' },
        { v: row.label, s: 'cell' },
      ]);
    }
    const total = TOTAL_KINDS.has(row.kind);
    rows.push([
      total ? { v: null, s: 'totalCell' } : { v: row.tt, s: 'num' },
      { v: row.label, s: total ? 'totalCell' : 'cell' },
      ...valueCells(row.counts, total),
    ]);
  });

  rows.push([]);
  const note = (text) => {
    rowHeights[rows.length] = 15 * Math.max(1, Math.ceil(text.length / NOTE_LINE_CHARS));
    fullRow(text, 'note');
  };
  growthReportNotesOf(report).forEach(note);
  growthReportSourcesOf(report).forEach((s) => note(`Kỳ/đợt dùng ở ${s.campus}: ${s.lines.join('; ')}.`));

  return {
    name: GROWTH_SHEET_NAME,
    rows,
    merges,
    cols: COL_WIDTHS,
    rowHeights,
    freeze: { rows: h + 4, cols: 2 },
  };
};

/** Tên file: tong-hop-can-do-2026-11.xlsx. */
export const growthReportFileName = (month) => `tong-hop-can-do-${month}.xlsx`;
