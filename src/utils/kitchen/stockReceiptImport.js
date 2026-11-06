import { normalizeText } from '@/utils/format';
import { emptyLine } from '@/utils/kitchen/stockReceiptForm';

/*
 * Nhập dòng thực phẩm cho phiếu nhập kho từ file Excel (.xlsx) hoặc CSV. Chỉ điền vào form phiếu nháp trên màn;
 * người nhập xem lại rồi Lưu nháp — BE kiểm số lượng, lô, hạn, giá khi lưu và xác nhận (NUT-11).
 */
export const RECEIPT_IMPORT_COLUMNS = ['Mã TP', 'Tên thực phẩm', 'Số lượng (đơn vị mua)', 'Số lô', 'Hạn dùng (dd/mm/yyyy)', 'Đơn giá'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Ô ngày: Date của Excel, chuỗi dd/mm/yyyy, d/m/yyyy hoặc yyyy-mm-dd ⇒ yyyy-mm-dd; không đọc được ⇒ ''. */
export const parseDateCell = (v) => {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return isoOf(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const s = String(v ?? '').trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return isoOf(m[3], m[2], m[1]);
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  return m ? isoOf(m[1], m[2], m[3]) : '';
};

/** Ô số kiểu Việt Nam: "12.500" hoặc "1,5" ⇒ số dạng chuỗi; trống ⇒ ''. */
export const parseNumberCell = (v) => {
  if (typeof v === 'number') return String(v);
  const s = String(v ?? '')
    .trim()
    .replace(/\s/g, '');
  if (!s) return '';
  // Có cả dấu chấm và phẩy: chấm là hàng nghìn. Chỉ dấu chấm theo nhóm 3 số: cũng là hàng nghìn.
  const t = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  return Number.isFinite(Number(t)) ? t : '';
};

const BOM = new RegExp('^' + String.fromCharCode(0xfeff));

/** Tách CSV đơn giản (dấu phẩy hoặc chấm phẩy, có ngoặc kép). */
export const parseCsv = (text) => {
  const sep = (text.split(/\r?\n/)[0].match(/;/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.map((r) => r.map((x) => x.replace(BOM, '')));
};

/**
 * Hàng (đã bỏ dòng tiêu đề) ⇒ { lines, problems }. Thực phẩm khớp theo mã, không có mã thì theo tên (không dấu).
 * Dòng không khớp thực phẩm kho khô ⇒ ghi vào problems, không thêm dòng.
 */
export const rowsToLines = (rows, foods) => {
  const byCode = new Map(foods.filter((f) => f.code).map((f) => [normalizeText(f.code), f]));
  const byName = new Map(foods.map((f) => [normalizeText(f.name), f]));
  const lines = [];
  const problems = [];
  rows.forEach((r, i) => {
    const [code, name, qty, lotNo, expiry, price] = r.map((c) => (c instanceof Date ? c : String(c ?? '').trim()));
    if (!code && !name && !qty) return;
    const food = (code && byCode.get(normalizeText(code))) || (name && byName.get(normalizeText(name)));
    if (!food) {
      problems.push(`Dòng ${i + 2}: không tìm thấy thực phẩm kho khô "${name || code}"`);
      return;
    }
    lines.push(
      emptyLine({
        foodId: String(food.id),
        purchaseQty: parseNumberCell(qty),
        lotNo: String(lotNo || ''),
        expiryDate: parseDateCell(expiry),
        unitPrice: parseNumberCell(price) || (food.unitPrice == null ? '' : String(food.unitPrice)),
      }),
    );
  });
  return { lines, problems };
};

/** Đọc file người dùng chọn (.xlsx hoặc .csv) ⇒ { lines, problems }. */
export async function readReceiptFile(file, foods) {
  let rows;
  if (/\.csv$/i.test(file.name)) rows = parseCsv(await file.text());
  else {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const res = await readXlsxFile(file);
    // Bản thư viện trả danh sách sheet [{ sheet, data }]; lấy sheet đầu
    rows = Array.isArray(res?.[0]?.data) ? res[0].data : res;
  }
  return rowsToLines(rows.slice(1), foods);
}
