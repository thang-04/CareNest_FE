/*
 * Bản in "Phiếu đánh giá sự phát triển của trẻ" cuối năm theo mẫu giấy của trường (BE OBS-28): MT theo lĩnh vực, ô
 * Đạt / Chưa đạt, cân nặng – chiều cao, Nhận xét, 4 lưu ý; chỗ "Xác nhận của BGH nhà trường" và "Giáo viên" ký tay.
 * Dữ liệu giữ nguyên BE trả; một nguồn HTML cho khung xem trước, file .doc và trang in.
 */
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const dmy = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}/${m}/${y}`;
};
const num = (v) => (v == null ? '' : String(v).replace('.', ','));
const place = (DEFAULT_PRINT_TEMPLATE.address.match(/xã ([^,]+)/i) || [])[1] || '';
const localDate = (instant) => (instant ? new Date(instant).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const dots = '..........................................................................................................';

// "Mẫu giáo lớn (5–6 tuổi)" ⇒ "5 – 6 TUỔI"; không có ngoặc thì dùng nguyên tên nhóm tuổi
export const ageTitle = (ageGroupName = '') => {
  const inner = (ageGroupName.match(/\(([^)]+)\)/) || [])[1];
  return (inner || ageGroupName).replace(/\s*[–-]\s*/g, ' – ').toUpperCase();
};

const tick = (on) => (on ? 'x' : '');

/** HTML phiếu cuối năm: sheet = GET /assessment/evaluations/{id}/year-sheet, ev = đánh giá, child = trẻ, comment = Nhận xét. */
export const yearEndSheetHtml = ({ sheet, ev, child, comment }) => {
  const yearText = `${(ev.periodStart || '').slice(0, 4)} - ${(ev.periodEnd || '').slice(0, 4)}`;
  const m = sheet.measurement;
  const rows = [];
  let measured = false;
  (sheet.domains || []).forEach((d, di) => {
    rows.push(`<tr class="dom"><td></td><td colspan="3"><b>${esc((d.name || 'Mục tiêu khác').toUpperCase())}</b></td></tr>`);
    let no = 1;
    // Như mẫu giấy: Cân nặng, Chiều cao là mục 1 của lĩnh vực thể chất (không có lĩnh vực thể chất thì lĩnh vực đầu)
    const physical = /thể chất/i.test(d.name || '') || (di === 0 && !(sheet.domains || []).some((x) => /thể chất/i.test(x.name || '')));
    if (physical && !measured) {
      measured = true;
      rows.push(`<tr><td class="n" rowspan="2">${no}</td><td>- Cân nặng: ${m?.weightKg != null ? `${num(m.weightKg)} kg` : '..........'}</td><td></td><td></td></tr>
<tr><td>- Chiều cao: ${m?.heightCm != null ? `${num(m.heightCm)} cm` : '..........'}</td><td></td><td></td></tr>`);
      no += 1;
    }
    d.goals.forEach((g) => {
      rows.push(
        `<tr><td class="n">${no}</td><td>- ${esc(g.text)}</td><td class="n">${tick(g.met === true)}</td><td class="n">${tick(g.met === false)}</td></tr>`,
      );
      no += 1;
    });
  });
  const signed = localDate(sheet.confirmedAt);
  const [sy, sm, sd] = signed ? signed.split('-').map(Number) : [];
  const signDate = signed ? `ngày ${sd} tháng ${sm} năm ${sy}` : 'ngày ..... tháng ..... năm ..........';
  const notes = sheet.notes || {};
  const note = (label, text) => `<p>- ${label}: ${text ? esc(text) : dots}</p>`;
  const body = `<table class="plain"><tr>
<td style="width:60%"><b>${esc(DEFAULT_PRINT_TEMPLATE.schoolName)}</b></td>
<td style="width:40%; text-align:right">Năm học: ${esc(yearText)}</td>
</tr></table>
<table class="plain head"><tr>
<td style="width:78%"><h1>PHIẾU ĐÁNH GIÁ SỰ PHÁT TRIỂN<br/>CỦA TRẺ ${esc(ageTitle(sheet.ageGroupName))}</h1></td>
<td style="width:22%"><div class="photo">Ảnh của trẻ</div></td>
</tr></table>
<p>Họ và tên trẻ: <b>${esc(child?.fullName || ev.childName || '')}</b> &nbsp; Ngày, tháng, năm sinh: ${esc(dmy(child?.dateOfBirth))} &nbsp; Lớp: ${esc(ev.className || '')}</p>
<p>Giáo viên: ${esc((sheet.teachers || []).join(', '))}</p>
<table class="grid"><thead><tr><th style="width:6%">TT</th><th>Mục tiêu giáo dục</th><th style="width:9%">Đạt</th><th style="width:11%">Chưa đạt</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>
<div class="after">
<p><b>Nhận xét:</b> ${comment ? esc(comment) : dots}</p>
<p><b>Một số lưu ý để điều chỉnh kế hoạch giáo dục năm học / độ tuổi tiếp theo:</b></p>
${note('Đối với trẻ', notes.forChild)}
${note('Đối với giáo viên', notes.forTeacher)}
${note('Đối với nhà trường', notes.forSchool)}
${note('Đối với cha mẹ / người chăm sóc trẻ', notes.forParent)}
</div>
<table class="plain sign-row"><tr>
<td class="c" style="width:50%"><p><b>Xác nhận của BGH nhà trường</b></p><p><i>(Kí tên và đóng dấu)</i></p></td>
<td class="c" style="width:50%"><p><i>${esc(place)}, ${signDate}</i></p><p><b>Giáo viên</b></p><p><i>(Kí và ghi rõ họ tên)</i></p>
<div class="sign"></div><p><b>${(sheet.teachers || []).map(esc).join('<br/>')}</b></p></td>
</tr></table>`;
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${esc(`Phiếu đánh giá - ${child?.fullName || ev.childName || ''}`)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page Section1 { size: 595.3pt 841.9pt; margin: 1.5cm 1.5cm 1.5cm 2cm; }
@page { size: A4 portrait; margin: 1.5cm 1.5cm 1.5cm 2cm; }
div.Section1 { page: Section1; }
body { font-family: 'Times New Roman', serif; font-size: 13pt; color: black; }
p { margin: 0 0 3pt; }
.c { text-align: center; }
h1 { font-size: 15pt; text-align: center; margin: 6pt 0; }
table { border-collapse: collapse; width: 100%; }
table.grid td, table.grid th { border: 1px solid black; padding: 2pt 4pt; font-size: 12pt; vertical-align: middle; }
table.grid th { font-weight: bold; text-align: center; }
table.grid td.n { text-align: center; }
table.grid tr.dom td { background: whitesmoke; }
table.plain td { border: none; vertical-align: top; }
.photo { border: 1px solid black; height: 90px; text-align: center; padding-top: 34px; font-size: 11pt; }
.head { margin: 6pt 0; }
.after { margin-top: 8pt; page-break-inside: avoid; }
.sign-row { margin-top: 10pt; page-break-inside: avoid; }
.sign { height: 60px; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
</style></head>
<body><div class="Section1">
${body}
</div></body></html>`;
};

const fileTitle = (text) =>
  text
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Tài liệu để xem trước rồi in / xuất: { html, name }. */
export const yearEndSheetFile = (args) => ({
  html: yearEndSheetHtml(args),
  name: fileTitle(`Phiếu đánh giá sự phát triển - ${args.child?.fullName || args.ev.childName || ''} - ${args.ev.className || ''}`),
});
