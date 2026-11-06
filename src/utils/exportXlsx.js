import { downloadBlob } from './file';

/*
 * Writer .xlsx tối giản, không thêm thư viện (package chỉ có read-excel-file, chỉ đọc): 1 sheet, chuỗi inline, số, ô gộp, độ rộng
 * cột, chiều cao dòng, cố định dòng/cột, một bộ kiểu ô cố định, in ngang vừa khổ A4. ZIP lưu không nén (method 0) + CRC32.
 *
 * sheet = {
 *   name,                                   // tên sheet (≤ 31 ký tự, bỏ ký tự cấm)
 *   rows: [[cell]],                         // cell: null | string | number | { v, s } — s là khóa của XLSX_STYLES
 *   merges: [{ row, col, rowSpan, colSpan }], // chỉ số 0
 *   cols: [width],                          // độ rộng theo ký tự
 *   rowHeights: { [rowIndex]: points },
 *   freeze: { rows, cols },
 * }
 * Ô bị gộp (trừ ô đầu) tự nhận kiểu của ô đầu để Excel vẽ đủ viền.
 */

const FONT = { normal: 0, bold: 1, title: 2, italic: 3, warn: 4, boldWarn: 5, band: 6 };
const FILL = { none: 0, head: 2, total: 3, band: 4 };
const BORDER = { none: 0, thin: 1 };
const PCT_FMT = 164;

// [font, fill, border, numFmt, horizontal, wrap]
const XF = {
  default: [FONT.normal, FILL.none, BORDER.none, 0, null, false],
  title: [FONT.title, FILL.none, BORDER.none, 0, null, false],
  subtitle: [FONT.normal, FILL.none, BORDER.none, 0, null, false],
  head: [FONT.bold, FILL.head, BORDER.thin, 0, 'center', true],
  cell: [FONT.normal, FILL.none, BORDER.thin, 0, null, false],
  num: [FONT.normal, FILL.none, BORDER.thin, 0, 'center', false],
  pct: [FONT.normal, FILL.none, BORDER.thin, PCT_FMT, 'center', false],
  warnNum: [FONT.warn, FILL.none, BORDER.thin, 0, 'center', false],
  band: [FONT.band, FILL.band, BORDER.thin, 0, null, false],
  totalCell: [FONT.bold, FILL.total, BORDER.thin, 0, null, false],
  totalNum: [FONT.bold, FILL.total, BORDER.thin, 0, 'center', false],
  totalPct: [FONT.bold, FILL.total, BORDER.thin, PCT_FMT, 'center', false],
  totalWarnNum: [FONT.boldWarn, FILL.total, BORDER.thin, 0, 'center', false],
  note: [FONT.italic, FILL.none, BORDER.none, 0, null, true],
};

/** Kiểu ô dùng được trong sheet.rows ({ v, s }). pct: số hiển thị 1 chữ số thập phân (Excel đổi dấu thập phân theo máy). */
export const XLSX_STYLES = Object.freeze(Object.keys(XF));
const XF_INDEX = Object.fromEntries(XLSX_STYLES.map((k, i) => [k, i]));

const STYLES_XML = (() => {
  const font = (attrs) => `<font>${attrs}<sz val="11"/><name val="Times New Roman"/><family val="1"/></font>`;
  const fonts = [
    font(''),
    font('<b/>'),
    font('<b/>').replace('<sz val="11"/>', '<sz val="13"/>'),
    font('<i/>').replace('<sz val="11"/>', '<sz val="10"/>'),
    font('<color rgb="FFB45309"/>'),
    font('<b/><color rgb="FFB45309"/>'),
    font('<b/><color rgb="FFFFFFFF"/>'),
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
  const xfs = Object.values(XF).map(([fontId, fillId, borderId, numFmtId, horizontal, wrap]) => {
    const align = `<alignment vertical="center"${horizontal ? ` horizontal="${horizontal}"` : ''}${wrap ? ' wrapText="1"' : ''}/>`;
    return (
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0"` +
      `${numFmtId ? ' applyNumberFormat="1"' : ''} applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`
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
  const grid = rows.map((r) => [...r]);
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

const legacySheet = (rows, { sheetName = 'Sheet1', headerRow = -1 } = {}) => {
  const width = Math.max(1, ...rows.map((row) => row.length));
  const cols = Array.from({ length: width }, (_, col) =>
    Math.min(60, Math.max(8, ...rows.map((row) => String(row[col] ?? '').length + 2))),
  );
  return {
    name: sheetName,
    rows: rows.map((row, index) => (index === headerRow ? row.map((value) => ({ v: value, s: 'head' })) : row)),
    cols,
  };
};

export const sheetXml = (input, headerRow = -1) => {
  const { rows = [], merges = [], cols = [], rowHeights = {}, freeze } = Array.isArray(input) ? legacySheet(input, { headerRow }) : input;
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
  return (
    `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `${colsXml}<sheetData>${rowsXml}</sheetData>${mergeXml}` +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>' +
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

/** Nội dung file .xlsx (Uint8Array) của một sheet. Hàm thuần (now chỉ là ngày giờ ghi trong ZIP). */
export const buildXlsx = (sheet, options = {}) => {
  const bytes = zipStored(packageFiles(Array.isArray(sheet) ? legacySheet(sheet, options) : sheet), options.now ?? new Date());
  return Array.isArray(sheet) ? new Blob([bytes], { type: XLSX_MIME }) : bytes;
};

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Tải file .xlsx về máy. */
export const downloadXlsx = (sheet, filename, options = {}) => {
  const effectiveOptions = Array.isArray(sheet)
    ? { ...options, headerRow: options.headerRow ?? (sheet[0]?.length === 1 && sheet.length > 1 ? 1 : 0) }
    : options;
  const result = buildXlsx(sheet, effectiveOptions);
  downloadBlob(result instanceof Blob ? result : new Blob([result], { type: XLSX_MIME }), filename.replace(/\.csv$/i, '.xlsx'));
};
