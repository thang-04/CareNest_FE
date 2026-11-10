import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { signerCell } from '@/utils/assessment/docSignatures';

const esc = (v = '') =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Cột STT, tên lớp, ghi chú rộng hơn; các cột xếp loại chia đều phần còn lại
const colgroup = (n) =>
  `<colgroup><col style="width:4%"/><col style="width:18%"/>${'<col/>'.repeat(Math.max(n - 3, 0))}<col style="width:16%"/></colgroup>`;
const place = (DEFAULT_PRINT_TEMPLATE.address.match(/xã ([^,]+)/i) || [])[1] || '';

// Mọi người ký cùng một hàng (Cần yêu cầu 10/11/2026): người ký thêm bên trái, Hiệu trưởng (người ký đầu) bên phải dưới dòng ngày
const signRow = (lead, rest) => {
  const list = [...rest, lead].filter(Boolean);
  if (!list.length) return '';
  const width = Math.floor(100 / list.length);
  const cells = list
    .map((s, i) => {
      const date = i === list.length - 1 ? `<p><i>${esc(place)}, ngày ..... tháng ..... năm ..........</i></p>` : '<p>&nbsp;</p>';
      return `<td style="width:${width}%">${date}${signerCell(s, { upper: true })}</td>`;
    })
    .join('');
  return `<table class="plain"><tr>${cells}</tr></table>`;
};

/**
 * Bản in Xếp loại nhóm lớp (OBS-24, sổ chỉ đạo chuyên môn) có chỗ ký Ban giám hiệu (Cần yêu cầu 10/11/2026).
 * table = { title, headers, rows } đúng như bảng đang thấy; signers = [{ title, name }] sửa / thêm được ở hộp xem trước.
 */
export function classRatingHtml({ title, headers, rows }, signers) {
  const [lead, ...rest] = signers;
  const head = headers.map((h) => `<th>${esc(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((v, i) => `<td${i === 1 ? ' class="name"' : ' class="n"'}>${esc(v)}</td>`).join('')}</tr>`)
    .join('');
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
@page { size: A4 landscape; margin: 1.5cm 1.2cm; }
body { font-family: 'Times New Roman', serif; font-size: 12pt; color: black; }
p { margin: 0 0 2pt; }
.c { text-align: center; }
h1 { font-size: 13pt; text-align: center; margin: 0 0 6pt; }
table { border-collapse: collapse; width: 100%; }
table.grid td, table.grid th { border: 1px solid black; padding: 2pt 3pt; font-size: 11pt; }
table.grid th { text-align: center; vertical-align: middle; }
table.grid td.n { text-align: center; }
table.plain td { border: none; vertical-align: top; text-align: center; }
.approve { margin-top: 12pt; page-break-inside: avoid; }
.sign { height: 56px; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
</style></head>
<body>
<h1>${esc(title.toUpperCase())}</h1>
<table class="grid">${colgroup(headers.length)}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<div class="approve">${signRow(lead, rest)}</div>
</body></html>`;
}

/** Tài liệu cho hộp xem trước: người ký mặc định Hiệu trưởng (ký trên) và Phó hiệu trưởng; tên người đang đăng nhập điền sẵn đúng vai trò. */
export function classRatingFile(table, defaults) {
  return {
    html: classRatingHtml(table, defaults),
    name: table.title,
    signers: defaults,
    withSigners: (next) => classRatingHtml(table, next),
  };
}
