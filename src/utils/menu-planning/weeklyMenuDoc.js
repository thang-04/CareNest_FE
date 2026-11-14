/*
 * Văn bản thực đơn tuần đã công bố (Word / In-PDF): mỗi khối một bảng bữa × thứ, lấy đúng món BE trả trong kế hoạch tuần.
 * Chỉ sắp xếp và định dạng, không tính nghiệp vụ. Một nguồn HTML cho cả bản xem trước, file .doc và trang in.
 */
import { escapeHtml as esc, fileTitle } from '@/components/print/docFile';
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { MEAL_BLOCK_LABELS, MEAL_SESSION_LABELS, WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { blockSessions, dayBlockItems, planBlocks } from '@/utils/menu-planning/mealPlanGrid';
import { formatDateTime } from '@/utils/format';

const dmy = (iso, sep = '/') => (iso ? iso.split('-').reverse().join(sep) : '');
const weekdayOf = (iso) => WEEKDAY_LABELS[new Date(`${iso}T00:00:00`).getDay() - 1] || '';

const shell = (title, body) => `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm; }
@page { size: A4 landscape; margin: 1.5cm; }
div.Section1 { page: Section1; }
body { font-family: 'Times New Roman', serif; font-size: 13pt; color: black; }
p { margin: 0 0 6pt; }
.school { font-weight: bold; }
h1 { font-size: 15pt; text-align: center; margin: 12pt 0 4pt; }
.sub { text-align: center; margin-bottom: 10pt; }
h2 { font-size: 13pt; margin: 12pt 0 6pt; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
td, th { border: 1px solid black; padding: 4pt; font-size: 12pt; vertical-align: top; }
th { text-align: center; vertical-align: middle; }
th.session { width: 14%; text-align: left; }
td.off { text-align: center; vertical-align: middle; font-style: italic; }
.block { page-break-inside: avoid; }
.foot { margin-top: 10pt; font-style: italic; }
table.sign { width: 40%; margin: 14pt 0 0 auto; table-layout: auto; page-break-inside: avoid; }
table.sign td { border: none; text-align: center; padding: 0; }
.sign-space { height: 60pt; }
</style></head>
<body><div class="Section1">
${body}
</div></body></html>`;

const blockTable = (plan, block) => {
  const sessions = blockSessions(plan, block);
  const days = plan.days || [];
  const head = `<tr><th class="session">Bữa</th>${days
    .map((d) => `<th>${esc(weekdayOf(d.date))}<br/>${esc(dmy(d.date).slice(0, 5))}</th>`)
    .join('')}</tr>`;
  const rows = sessions.map((session, i) => {
    const cells = days.map((day) => {
      // Ngày nghỉ gộp dọc mọi bữa thành một ô "Nghỉ" kèm ghi chú
      if (day.off) {
        if (i > 0) return '';
        const note = day.note ? `<br/>${esc(day.note)}` : '';
        return `<td class="off" rowspan="${sessions.length}">Nghỉ${note}</td>`;
      }
      const names = dayBlockItems(day, block)
        .filter((item) => item.session === session)
        .map((item) => esc(item.dishName || 'Món đã xóa'));
      return `<td>${names.length ? names.join('<br/>') : '—'}</td>`;
    });
    return `<tr><th class="session">${esc(MEAL_SESSION_LABELS[session] || session)}</th>${cells.join('')}</tr>`;
  });
  return `<div class="block"><h2>Khối ${esc(MEAL_BLOCK_LABELS[block] || block)}</h2>
<table><thead>${head}</thead><tbody>${rows.join('')}</tbody></table></div>`;
};

// Tên xã lấy từ địa chỉ mẫu in ("…, xã Thượng Hồng, …") cho dòng nơi, ngày ký
const commune = (DEFAULT_PRINT_TEMPLATE.address.match(/xã ([^,]+)/i) || [])[1] || '';

/** Chỗ ký người lập: ngày theo thời điểm công bố; không có họ tên thì để trống cho ký tay. */
const signBlock = (publishedAt, preparerName) => {
  const [y, m, d] = (publishedAt || '').slice(0, 10).split('-');
  const date = y ? `ngày ${d} tháng ${m} năm ${y}` : 'ngày …… tháng …… năm ……';
  return `<table class="sign"><tr><td><i>${esc(commune ? `${commune}, ${date}` : date)}</i></td></tr>
<tr><td><b>NGƯỜI LẬP</b><br/><i>(Ký, ghi rõ họ tên)</i></td></tr>
<tr><td class="sign-space"></td></tr>
<tr><td><b>${esc(preparerName)}</b></td></tr></table>`;
};

/** Thực đơn tuần đã công bố -> { html, name } để xem trước rồi xuất Word / in. `weekStart` là thứ Hai của tuần. */
export const weeklyMenuFile = (plan, weekStart, { preparerName = '' } = {}) => {
  const days = plan?.days || [];
  const from = days[0]?.date || weekStart;
  const to = days[days.length - 1]?.date || weekStart;
  const title = `Thực đơn tuần ${dmy(from)} – ${dmy(to)}`;
  const body = [
    `<p class="school">${esc(DEFAULT_PRINT_TEMPLATE.schoolName)}</p>`,
    `<h1>THỰC ĐƠN TUẦN</h1>`,
    `<p class="sub">Từ ${esc(weekdayOf(from).toLowerCase())} ${esc(dmy(from))} đến ${esc(weekdayOf(to).toLowerCase())} ${esc(dmy(to))}</p>`,
    ...planBlocks(plan).map((block) => blockTable(plan, block)),
    plan?.publishedAt ? `<p class="foot">Công bố lúc ${esc(formatDateTime(plan.publishedAt))}</p>` : '',
    signBlock(plan?.publishedAt, preparerName.trim()),
  ].join('\n');
  return { html: shell(title, body), name: fileTitle(`Thực đơn tuần ${dmy(from, '-')}`) };
};
