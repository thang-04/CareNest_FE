import { childNameWithHistory } from '@/utils/childHistory';
/*
 * Bản in "Bảng đánh giá sự phát triển của trẻ" cuối chủ đề theo đúng mẫu giấy của trường (Cần chốt 04/11/2026): bảng
 * trẻ × "Các mục tiêu giáo dục", tổng số Đ / KĐ, dòng Tổng số trẻ đạt / Tỷ lệ, tổng kết 70%, lưu ý; chỗ ký Giáo viên chủ
 * nhiệm và phần "Duyệt kế hoạch" (Tổ trưởng chuyên môn, Phó hiệu trưởng) ký tay, họ tên BE trả — không duyệt trên hệ
 * thống. Một nguồn HTML cho khung xem trước, file .doc và trang in / lưu PDF, như bản xuất giáo án của module kế hoạch
 * giáo dục (bản riêng cho đánh giá trẻ, không dùng chung file của module đó).
 */
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { approveRow, defaultSigners, signerCell } from '@/utils/assessment/docSignatures';
import { contentWidth, gridOpen, pageCss, share } from '@/utils/assessment/docLayout';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Ngày như mẫu viết tay: 7/9/2026 (không số 0 đầu)
const dmy = (iso, withYear = true) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
};
const mark = (met) => (met === true ? '+' : met === false ? '-' : '');
// Nơi ký lấy tên xã trong địa chỉ mẫu in ("…, xã Thượng Hồng, …")
const place = (DEFAULT_PRINT_TEMPLATE.address.match(/xã ([^,]+)/i) || [])[1] || '';
const localDate = (instant) => (instant ? new Date(instant).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');

// Lề trang (trái 1,5cm, phải 1,2cm) và độ rộng cột tính bằng pt
const MARGIN = '1.5cm 1.2cm 1.5cm 1.5cm';
const [LEFT, RIGHT] = [42.5, 34];
const [STT, NAME, TOTAL, MIN_GOAL] = [24, 134, 22, 17];

/** Khổ dọc như mẫu giấy; nhiều mục tiêu quá không đủ chỗ thì xoay ngang để không mất cột. */
const layoutOf = (count) => {
  const fixed = STT + NAME + TOTAL * 2;
  const orientation = count && (contentWidth('portrait', LEFT, RIGHT) - fixed) / count < MIN_GOAL ? 'landscape' : 'portrait';
  const width = contentWidth(orientation, LEFT, RIGHT);
  const goals = count ? Array(count).fill(share(width - fixed, count)) : [];
  return { orientation, widths: [STT, count ? NAME : width - STT - TOTAL * 2, ...goals, TOTAL, TOTAL] };
};

const shell = (title, orientation, body) => `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
${pageCss(orientation, MARGIN)}
body { font-family: 'Times New Roman', serif; font-size: 12pt; color: black; }
p { margin: 0 0 2pt; }
.c { text-align: center; }
h1 { font-size: 13pt; text-align: center; margin: 0; }
table { border-collapse: collapse; width: 100%; }
table.grid td, table.grid th { border: 1px solid black; padding: 1pt; font-size: 10pt; }
table.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
table.grid td.n { text-align: center; }
table.grid td.rate { font-size: 9pt; }
table.plain td { border: none; vertical-align: top; }
.after { margin-top: 6pt; page-break-inside: avoid; }
.approve { margin-top: 18pt; page-break-inside: avoid; }
.small { font-size: 10pt; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
</style></head>
<body><div class="Section1">
${body}
</div></body></html>`;

/** HTML bảng đánh giá cuối chủ đề từ dữ liệu BE (GET /assessment/theme-evaluations); số liệu giữ nguyên BE trả. */
export const themeEvaluationHtml = (ev, signers = defaultSigners(ev.signers)) => {
  const goals = ev.goals || [];
  const [signHead, ...approvers] = signers;
  const head = `<tr>
<th rowspan="2">STT</th>
<th rowspan="2">Họ và tên</th>
${goals.length ? `<th colspan="${goals.length}">Các mục tiêu giáo dục (Đạt + chưa đạt -)</th>` : ''}
<th colspan="2">Tổng số</th>
</tr>
<tr>${goals.map((g) => `<th>${esc(g.goalNo ?? '')}</th>`).join('')}<th>Đ</th><th>KĐ</th></tr>`;
  const rows = (ev.rows || [])
    .map(
      (r, i) => `<tr>
<td class="n">${i + 1}</td>
<td class="name">${esc(childNameWithHistory(r.fullName, r.historyStatus))}</td>
${r.cells.map((c) => `<td class="n">${mark(c.met)}</td>`).join('')}
<td class="n">${r.met}</td>
<td class="n">${r.notMet || ''}</td>
</tr>`,
    )
    .join('');
  const foot = `<tr><th colspan="2">Tổng số trẻ đạt</th>${goals.map((g) => `<td class="n">${g.metChildren}</td>`).join('')}<td></td><td></td></tr>
<tr><th colspan="2">Tỷ lệ</th>${goals.map((g) => `<td class="n rate">${g.rate == null ? '' : g.rate}</td>`).join('')}<td></td><td></td></tr>`;
  // Ngày ký: ngày GV xác nhận; chưa xác nhận thì để chấm cho viết tay
  const signed = localDate(ev.confirmedAt);
  const [sy, sm, sd] = signed ? signed.split('-').map(Number) : [];
  const signDate = signed ? `ngày ${sd} tháng ${sm} năm ${sy}` : 'ngày ..... tháng ..... năm ..........';
  const { orientation, widths } = layoutOf(goals.length);
  const body = `<h1>BẢNG ĐÁNH GIÁ SỰ PHÁT TRIỂN CỦA TRẺ</h1>
<p class="c"><b>Chủ đề: ${esc(ev.themeName)}</b></p>
<p class="c">(Từ ngày ${dmy(ev.startDate)} đến ngày ${dmy(ev.endDate)})</p>
${gridOpen(widths)}<thead>${head}</thead><tbody>${rows}${foot}</tbody></table>
<p>&nbsp;</p>
<table class="plain after"><tr>
<td style="width:45%">
<p>Tổng số trẻ được đánh giá: ${ev.assessedChildren}</p>
<p>Số trẻ đạt ${ev.passPercent}% trở lên: ${ev.passedChildren} trẻ</p>
<p>Số trẻ đạt dưới ${ev.passPercent}%: ${ev.notPassedChildren} trẻ</p>
<p><b>Một số lưu ý:</b> ${esc(ev.note || '')}</p>
<p>......................................................................</p>
</td>
<td class="c" style="width:55%">
<p><i>${esc(place)}, ${signDate}</i></p>
${signHead ? signerCell(signHead, { upper: true }) : ''}
</td>
</tr></table>
${
  // Bỏ hết người duyệt ở hộp xem trước thì bỏ luôn phần "Duyệt kế hoạch"
  approvers.length
    ? `<div class="approve">
<p class="c small">DUYỆT KẾ HOẠCH</p>
<p class="c small">Từ ngày ${dmy(ev.startDate, false)} đến ngày ${dmy(ev.endDate)}</p>
<table class="plain small">${approveRow(approvers)}</table>
</div>`
    : ''
}`;
  return shell(`Đánh giá cuối chủ đề - ${ev.themeName} - ${ev.className}`, orientation, body);
};

const fileTitle = (text) =>
  text
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Tài liệu để xem trước rồi in / xuất: { html, name } (xem trước dùng đúng HTML sẽ in). */
export const themeEvaluationFile = (ev) => ({
  html: themeEvaluationHtml(ev),
  name: fileTitle(`Đánh giá cuối chủ đề - ${ev.themeName} - ${ev.className}`),
  // Hộp xem trước sửa / thêm người ký rồi dựng lại HTML (chỉ đổi file in)
  signers: defaultSigners(ev.signers),
  withSigners: (next) => themeEvaluationHtml(ev, next),
});

/** Tải file .doc (HTML Word mở được, không cần thư viện). */
export const downloadDoc = (html, baseName) => {
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Mở trang in cùng bố cục (in giấy hoặc "Lưu dưới dạng PDF"). Trả false khi trình duyệt chặn cửa sổ mới. */
export const printDoc = (html) => {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
};
