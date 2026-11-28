/*
 * Khuôn chung "Văn bản trường" cho mọi bản in, PDF và Word: đầu trang quốc hiệu 2 cột, khối ký luôn ở cuối văn bản
 * (dòng nơi, ngày ký trên cột người ký chính bên phải). Bản Word dùng chuỗi HTML ở đây; tờ in JSX dùng cùng dữ liệu qua
 * PrintHeader / PrintSignRow.
 */
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { escapeHtml as esc } from '@/components/print/docFile';
import { localDateOf } from '@/utils/format';

const communeOf = (address = '') => (address.match(/xã ([^,]+)/i) || [])[1]?.trim() || '';

/** Hai cột đầu trang: trái là cơ quan chủ quản + tên trường, phải là quốc hiệu, tiêu ngữ. */
export const docHeaderLines = (template = DEFAULT_PRINT_TEMPLATE) => {
  const commune = communeOf(template.address);
  return {
    left: [commune ? `UBND XÃ ${commune.toUpperCase()}` : '', template.schoolName].filter(Boolean),
    right: ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc'],
  };
};

/** "Thượng Hồng, ngày 18 tháng 11 năm 2026"; không có ngày thì để chấm cho ghi tay. `date`: yyyy-mm-dd hoặc thời điểm ISO. */
export const signDateText = (date, template = DEFAULT_PRINT_TEMPLATE) => {
  const place = communeOf(template.address);
  // Thời điểm ISO (Instant UTC) đổi sang ngày địa phương, cắt chuỗi sẽ lùi một ngày khi trước 7 giờ sáng
  const iso = date ? (String(date).length > 10 ? localDateOf(date) : String(date)) : '';
  const [y, m, d] = iso ? iso.split('-').map(Number) : [];
  const text = y ? `ngày ${d} tháng ${m} năm ${y}` : 'ngày …… tháng …… năm ……';
  return place ? `${place}, ${text}` : text;
};

/**
 * Danh sách ô ký theo thứ tự trái → phải; người ký chính (`lead`, mặc định ô cuối) có dòng nơi, ngày ký phía trên.
 * signers = [{ title, name }]; name trống thì để trống chỗ họ tên cho ký tay.
 */
export const signCells = (signers = [], { date, lead = signers.length - 1, template } = {}) =>
  signers.map((s, i) => ({
    title: String(s.title || '').toUpperCase(),
    name: String(s.name || '').trim(),
    dateLine: i === lead ? signDateText(date, template) : '',
  }));

/** CSS cho bản Word / trang in: đặt vào <style> của khung văn bản cùng docHeaderHtml, signRowHtml. */
export const DOC_TEMPLATE_CSS = `
table.doc-head, table.doc-sign { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.doc-head td, table.doc-sign td { border: none; padding: 0 4pt; text-align: center; vertical-align: top; }
table.doc-head td { font-weight: bold; }
table.doc-head .doc-head__rule { width: 35%; margin: 2pt auto 0; border-top: 1px solid black; height: 0; }
table.doc-sign { margin-top: 14pt; page-break-inside: avoid; }
table.doc-sign p { margin: 0 0 2pt; }
table.doc-sign .doc-sign__space { height: 60pt; }`;

/** Quốc hiệu 2 cột, bảng không viền, không lồng bảng (Word đọc lại được). */
export const docHeaderHtml = (template) => {
  const { left, right } = docHeaderLines(template);
  const col = (lines, width) => `<td style="width:${width}%">${lines.map(esc).join('<br/>')}<div class="doc-head__rule"></div></td>`;
  return `<table class="doc-head"><tr>${col(left, 45)}${col(right, 55)}</tr></table>`;
};

/** Hàng ô ký cuối văn bản; không có người ký thì trả chuỗi rỗng. */
export const signRowHtml = (signers, options) => {
  const cells = signCells(signers, options);
  if (!cells.length) return '';
  // Một người ký thì ô ký nằm nửa phải như văn bản hành chính, cột trái để trống
  const single = cells.length === 1;
  const width = single ? 45 : Math.floor(100 / cells.length);
  const cell = (c) => `<td style="width:${width}%">
<p><i>${c.dateLine ? esc(c.dateLine) : '&nbsp;'}</i></p>
<p><b>${esc(c.title)}</b></p>
<p><i>(Ký, ghi rõ họ tên)</i></p>
<div class="doc-sign__space"></div>
<p><b>${esc(c.name)}</b></p></td>`;
  return `<table class="doc-sign"><tr>${single ? '<td style="width:55%"></td>' : ''}${cells.map(cell).join('')}</tr></table>`;
};
