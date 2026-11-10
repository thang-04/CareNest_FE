import { downloadBlob } from './file';

/*
 * Xuất .xlsx không cần thư viện (package chỉ có read-excel-file, chỉ đọc): 1 sheet, chữ ghi inlineStr nên Excel không chạy công
 * thức trong dữ liệu (=, +, -, @), số là số; ZIP lưu không nén + CRC32. Nhận một trong hai kiểu đầu vào:
 * - rows: mảng các mảng giá trị (bảng thường: điểm danh, đánh giá, bếp…). Chữ Calibri, dòng headerRow in đậm, cột rộng theo nội dung.
 * - sheet: báo cáo theo mẫu giấy (vd. Tổng hợp cân đo 5.1). Chữ Times New Roman, in ngang vừa khổ A4.
 *   {
 *     name,                                     // tên sheet (≤ 31 ký tự, bỏ ký tự cấm)
 *     rows: [[cell]],                           // cell: null | string | number | { v, s } — s là khóa của XLSX_STYLES
 *     merges: [{ row, col, rowSpan, colSpan }], // chỉ số 0
 *     cols: [width],                            // độ rộng theo ký tự
 *     rowHeights: { [rowIndex]: points },
 *     freeze: { rows, cols },
 *   }
 *   Ô bị gộp (trừ ô đầu) tự nhận kiểu của ô đầu để Excel vẽ đủ viền.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const FONT = { normal: 0, bold: 1, title: 2, italic: 3, warn: 4, boldWarn: 5, band: 6, plain: 7, plainBold: 8 };
const FILL = { none: 0, head: 2, total: 3, band: 4 };
const BORDER = { none: 0, thin: 1 };
const PCT_FMT = 164;

// [font, fill, border, numFmt, horizontal, wrap, vertical]
const XF = {
  default: [FONT.normal, FILL.none, BORDER.none, 0, null, false, 'center'],
  title: [FONT.title, FILL.none, BORDER.none, 0, null, false, 'center'],
  subtitle: [FONT.normal, FILL.none, BORDER.none, 0, null, false, 'center'],
  head: [FONT.bold, FILL.head, BORDER.thin, 0, 'center', true, 'center'],
  cell: [FONT.normal, FILL.none, BORDER.thin, 0, null, false, 'center'],
  num: [FONT.normal, FILL.none, BORDER.thin, 0, 'center', false, 'center'],
  pct: [FONT.normal, FILL.none, BORDER.thin, PCT_FMT, 'center', false, 'center'],
  warnNum: [FONT.warn, FILL.none, BORDER.thin, 0, 'center', false, 'center'],
  band: [FONT.band, FILL.band, BORDER.thin, 0, null, false, 'center'],
  totalCell: [FONT.bold, FILL.total, BORDER.thin, 0, null, false, 'center'],
  totalNum: [FONT.bold, FILL.total, BORDER.thin, 0, 'center', false, 'center'],
  totalPct: [FONT.bold, FILL.total, BORDER.thin, PCT_FMT, 'center', false, 'center'],
  totalWarnNum: [FONT.boldWarn, FILL.total, BORDER.thin, 0, 'center', false, 'center'],
  note: [FONT.italic, FILL.none, BORDER.none, 0, null, true, 'center'],
  // Bảng thường (đầu vào rows): Calibri, không viền, căn mặc định của Excel
  plain: [FONT.plain, FILL.none, BORDER.none, 0, null, false, null],
  plainHead: [FONT.plainBold, FILL.none, BORDER.none, 0, null, false, null],
};

/** Kiểu ô dùng được trong sheet.rows ({ v, s }). pct: số hiển thị 1 chữ số thập phân (Excel đổi dấu thập phân theo máy). */
export const XLSX_STYLES = Object.freeze(Object.keys(XF));
const XF_INDEX = Object.fromEntries(XLSX_STYLES.map((k, i) => [k, i]));

const STYLES_XML = (() => {
  const font = ({ b = false, i = false, sz = 11, color = '', name = 'Times New Roman', family = 1 } = {}) =>
    `<font>${b ? '<b/>' : ''}${i ? '<i/>' : ''}<sz val="${sz}"/>${color ? `<color rgb="${color}"/>` : ''}` +
    `<name val="${name}"/><family val="${family}"/></font>`;
  const fonts = [
    font(),
    font({ b: true }),
    font({ b: true, sz: 13 }),
    font({ i: true, sz: 10 }),
    font({ color: 'FFB45309' }),
    font({ b: true, color: 'FFB45309' }),
    font({ b: true, color: 'FFFFFFFF' }),
    font({ name: 'Calibri', family: 2 }),
    font({ b: true, name: 'Calibri', family: 2 }),
  ];
  const solid = (rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fills = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    solid('FFF1F5F9'),
    solid('FFE8F0FE'),
    solid('FF1E3A8A'),
  ];
  const side = (tag) => `<${tag} style="thin"><color rgb="FF94A3B8"/></${tag}>`;
  const borders = [
    '<border><left/><right/><top/><bottom/><diagonal/></border>',
    `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`,
  ];
  const xfs = Object.values(XF).map(([fontId, fillId, borderId, numFmtId, horizontal, wrap, vertical]) => {
    const attrs = `${vertical ? ` vertical="${vertical}"` : ''}${horizontal ? ` horizontal="${horizontal}"` : ''}${wrap ? ' wrapText="1"' : ''}`;
    const align = attrs ? `<alignment${attrs}/>` : '';
    return (
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      `${numFmtId ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1"' : ''}>${align}</xf>`
    );
  });
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<numFmts count="1"><numFmt numFmtId="${PCT_FMT}" formatCode="0.0"/></numFmts>` +
    `<fonts count="${fonts.length}">${fonts.join('')}</fonts>` +
    `<fills count="${fills.length}">${fills.join('')}</fills>` +
    `<borders count="${borders.length}">${borders.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
})();

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const escapeXml = (text) =>
  String(text)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Chữ cột Excel của chỉ số 0: 0 ⇒ A, 25 ⇒ Z, 26 ⇒ AA. */
export const columnName = (index) => {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
};
const ref = (row, col) => `${columnName(col)}${row + 1}`;

const safeSheetName = (name) =>
  String(name || 'Sheet1')
    .replace(/[[\]:*?/\\]/g, ' ')
    .slice(0, 31) || 'Sheet1';

const cellOf = (raw) => (raw != null && typeof raw === 'object' ? raw : { v: raw });

const cellXml = (row, col, raw) => {
  const { v, s } = cellOf(raw);
  const style = s && XF_INDEX[s] ? ` s="${XF_INDEX[s]}"` : '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref(row, col)}"${style}><v>${v}</v></c>`;
  if (v == null || v === '') return style ? `<c r="${ref(row, col)}"${style}/>` : '';
  return `<c r="${ref(row, col)}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
};

/** Ô bị gộp nhận kiểu của ô đầu (viền của vùng gộp vẽ theo từng ô). */
const withMergedStyles = (rows, merges) => {
  const grid = rows.map((r) => [...(r || [])]);
  merges.forEach(({ row, col, rowSpan = 1, colSpan = 1 }) => {
    const { s } = cellOf(grid[row]?.[col]);
    if (!s) return;
    for (let r = row; r < row + rowSpan; r += 1)
      for (let c = col; c < col + colSpan; c += 1) {
        if (r === row && c === col) continue;
        grid[r] = grid[r] || [];
        if (grid[r][c] == null) grid[r][c] = { v: null, s };
      }
  });
  return grid;
};

/** Bảng thường ⇒ sheet: dòng headerRow in đậm, cột rộng theo nội dung (8–60 ký tự), không đặt khổ in. */
const tableSheet = (rows, { sheetName, headerRow }) => {
  const width = Math.max(1, ...rows.map((r) => r.length));
  const cols = Array.from({ length: width }, (_, c) => Math.min(60, Math.max(8, ...rows.map((r) => String(r[c] ?? '').length + 2))));
  const style = (ri) => (ri === headerRow ? 'plainHead' : 'plain');
  return {
    name: sheetName,
    cols,
    pageSetup: false,
    rows: rows.map((r, ri) => r.map((v) => (v == null || v === '' ? null : { v, s: style(ri) }))),
  };
};

const sheetXml = ({ rows = [], merges = [], cols = [], rowHeights = {}, freeze, pageSetup = true }) => {
  const grid = withMergedStyles(rows, merges);
  const freezeRows = freeze?.rows || 0;
  const freezeCols = freeze?.cols || 0;
  const pane =
    freezeRows || freezeCols
      ? `<pane${freezeCols ? ` xSplit="${freezeCols}"` : ''}${freezeRows ? ` ySplit="${freezeRows}"` : ''} topLeftCell="${ref(freezeRows, freezeCols)}" activePane="${
          freezeRows && freezeCols ? 'bottomRight' : freezeRows ? 'bottomLeft' : 'topRight'
        }" state="frozen"/>`
      : '';
  const colsXml = cols.length
    ? `<cols>${cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : '';
  const rowsXml = grid
    .map((cells, r) => {
      const height = rowHeights[r] ? ` ht="${rowHeights[r]}" customHeight="1"` : '';
      return `<row r="${r + 1}"${height}>${(cells || []).map((cell, c) => cellXml(r, c, cell)).join('')}</row>`;
    })
    .join('');
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges
        .map(({ row, col, rowSpan = 1, colSpan = 1 }) => `<mergeCell ref="${ref(row, col)}:${ref(row + rowSpan - 1, col + colSpan - 1)}"/>`)
        .join('')}</mergeCells>`
    : '';
  // Báo cáo theo mẫu: in ngang khổ A4, vừa bề ngang trang
  const page = pageSetup
    ? '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    : '';
  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    (pageSetup ? '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' : '') +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `${colsXml}<sheetData>${rowsXml}</sheetData>${mergeXml}${page}` +
    '</worksheet>'
  );
};

const packageFiles = (sheet) => ({
  '[Content_Types].xml':
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>',
  '_rels/.rels': `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheets><sheet name="${escapeXml(safeSheetName(sheet.name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':
    `${XML_HEAD}<Relationships xmlns="${NS_PKG_REL}">` +
    `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`,
  'xl/styles.xml': STYLES_XML,
  'xl/worksheets/sheet1.xml': sheetXml(sheet),
});

// --- ZIP (lưu không nén) ---
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const dosDateTime = (date) => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
});

const zipStored = (files, now) => {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const entries = Object.entries(files).map(([name, text]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    return { nameBytes, data, crc: crc32(data) };
  });
  const localSize = entries.reduce((n, e) => n + 30 + e.nameBytes.length + e.data.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.nameBytes.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let pos = 0;
  const u16 = (v) => {
    view.setUint16(pos, v, true);
    pos += 2;
  };
  const u32 = (v) => {
    view.setUint32(pos, v, true);
    pos += 4;
  };
  const bytes = (b) => {
    out.set(b, pos);
    pos += b.length;
  };
  const offsets = entries.map((e) => {
    const offset = pos;
    // Local file header; cờ bit 11: tên UTF-8.
    [0x04034b50].forEach(u32);
    [20, 0x0800, 0, time, date].forEach(u16);
    [e.crc, e.data.length, e.data.length].forEach(u32);
    [e.nameBytes.length, 0].forEach(u16);
    bytes(e.nameBytes);
    bytes(e.data);
    return offset;
  });
  const centralStart = pos;
  entries.forEach((e, i) => {
    [0x02014b50].forEach(u32);
    [20, 20, 0x0800, 0, time, date].forEach(u16);
    [e.crc, e.data.length, e.data.length].forEach(u32);
    [e.nameBytes.length, 0, 0, 0, 0].forEach(u16);
    [0, offsets[i]].forEach(u32);
    bytes(e.nameBytes);
  });
  [0x06054b50].forEach(u32);
  [0, 0, entries.length, entries.length].forEach(u16);
  [pos - centralStart, centralStart].forEach(u32);
  u16(0);
  return out;
};

/**
 * Blob .xlsx một sheet. input: rows (bảng thường, dùng sheetName, headerRow) hoặc sheet (báo cáo theo mẫu, tên lấy sheet.name).
 * now: ngày giờ ghi trong ZIP.
 */
export const buildXlsx = (input, { sheetName = 'Sheet1', headerRow = -1, now = new Date() } = {}) => {
  const sheet = Array.isArray(input) ? tableSheet(input, { sheetName, headerRow }) : input;
  return new Blob([zipStored(packageFiles(sheet), now)], { type: XLSX_MIME });
};

/**
 * Tải file .xlsx về máy. Bảng thường: `headerRow` là dòng tiêu đề cột (in đậm); mặc định dòng 1 nếu dòng 0 là tiêu đề báo cáo
 * một ô, ngược lại dòng 0.
 */
export const downloadXlsx = (input, filename, { sheetName, headerRow } = {}) => {
  const header = Array.isArray(input) ? (headerRow ?? (input[0]?.length === 1 && input.length > 1 ? 1 : 0)) : undefined;
  downloadBlob(buildXlsx(input, { sheetName, headerRow: header }), filename.replace(/\.csv$/i, '.xlsx'));
};
