/*
 * Xuất kế hoạch giáo dục năm học theo bố cục bản Word mẫu (MN Thái Dương): quốc hiệu, tên kế hoạch,
 * A. Mục tiêu – nội dung (cột chủ đề thực hiện), B. Dự kiến chủ đề – sự kiện, chữ ký người xây dựng.
 * Một nguồn HTML dùng cho cả file .doc (Word mở được) và trang in / lưu PDF.
 */
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { AGE_GROUPS, DOMAINS, domainLabel } from '@/models/education-plan/educationPlanConstants';
import { domainRoman, themeAbbr, themeGoalIds, weekCount } from '@/models/education-plan/goalTable';
import { SIGN_ROLES, getEduConfig, soleSignerName } from '@/models/education-plan/eduConfig';

export const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const fmt = (iso) => (iso ? iso.split('-').reverse().join('/') : '');
// Tên xã của trường lấy từ địa chỉ mẫu in ("…, xã Thượng Hồng, …") cho dòng cơ quan chủ quản và nơi ký
export const commune = (DEFAULT_PRINT_TEMPLATE.address.match(/xã ([^,]+)/i) || [])[1] || '';

/** Khung tài liệu Word / trang in chung: A4 ngang, Times New Roman, bảng viền đen. */
export const docShell = (title, body) => `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/><title>${esc(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
@page Section1 { size: 841.9pt 595.3pt; mso-page-orientation: landscape; margin: 1.5cm 1.5cm 1.5cm 2cm; }
@page { size: A4 landscape; margin: 1.5cm 1.5cm 1.5cm 2cm; }
div.Section1 { page: Section1; }
body { font-family: 'Times New Roman', serif; font-size: 13pt; color: #000; }
p { margin: 0 0 6pt; }
.c { text-align: center; }
h1 { font-size: 14pt; text-align: center; margin: 0; }
h2 { font-size: 13pt; margin: 12pt 0 6pt; }
table { border-collapse: collapse; width: 100%; }
table.grid td, table.grid th { border: 1px solid #000; padding: 2pt 4pt; font-size: 12pt; vertical-align: top; }
table.grid th { font-weight: bold; text-align: center; vertical-align: middle; }
table.grid th.abbr, table.grid td.tick { font-size: 10pt; text-align: center; font-weight: bold; padding: 2pt 1pt; }
table.plain td { border: none; vertical-align: top; }
.sign { height: 64px; }
.sign-block { margin-top: 12pt; page-break-inside: avoid; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
</style></head>
<body><div class="Section1">
${body}
</div></body></html>`;

/** Quốc hiệu 2 cột không viền như văn bản của trường. */
export const docHeader = () => `<table class="plain"><tr>
<td class="c" style="width:45%">${commune ? `<b>UBND XÃ ${esc(commune.toUpperCase())}</b><br/>` : ''}<b>${esc(DEFAULT_PRINT_TEMPLATE.schoolName)}</b></td>
<td class="c" style="width:55%"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br/><b>Độc lập - Tự do - Hạnh phúc</b></td>
</tr></table>`;

/**
 * Người xây dựng kế hoạch năm theo cấu hình (mặc định Phó HT, Tổ trưởng) để in họ tên dưới chỗ ký tay:
 * [{ role, title, name }]. Tên lấy từ người soạn, người gửi và người ban hành; Tổ trưởng chưa thao tác thì lấy Tổ trưởng
 * của nhóm tuổi (staff BE trả); không có thì để trống cho viết tay.
 */
export const yearSigners = (plan, staff = []) =>
  getEduConfig().signers.year.map((role) => {
    // Người gửi duyệt luôn là Tổ trưởng, người ban hành luôn là Phó HT (EDU-04/05); người soạn suy từ chức danh BE trả
    const roleOfTitle = (t = '') => (/tổ trưởng/i.test(t) ? 'TEAM_LEADER' : /phó hiệu trưởng/i.test(t) ? 'VICE_PRINCIPAL' : null);
    const people = [
      plan.owner && { ...plan.owner, role: plan.owner.role || roleOfTitle(plan.owner.title) },
      plan.sentBy && { ...plan.sentBy, role: plan.sentBy.role || 'TEAM_LEADER' },
      plan.issued && { ...plan.issued, role: plan.issued.role || 'VICE_PRINCIPAL' },
    ].filter(Boolean);
    const leader = role === 'TEAM_LEADER' ? staff.find((s) => s.role === 'TEAM_LEADER' && s.ageGroupId === plan.ageGroupId) : null;
    const name =
      people.find((p) => p.role === role)?.name || soleSignerName(role, plan.ageGroupId, plan.schoolYear) || leader?.fullName || '';
    return { role, title: SIGN_ROLES[role], name };
  });

const domainTitle = (name) => `${domainRoman(name)}. Giáo dục ${domainLabel(name).replace(/^P/, 'p')}`;

/** Bảng A: STT | Mục tiêu giáo dục năm | Nội dung giáo dục năm | Chủ đề thực hiện (mỗi chủ đề một cột). */
const partA = (domains, themes, numbers) => {
  const n = themes.length;
  const ticks = (c) => themes.map((t) => `<td class="tick">${c && c.themes.includes(t.id) ? esc(themeAbbr(t)) : ''}</td>`).join('');
  const band = (html) => `<tr><td></td><td colspan="2">${html}</td>${ticks(null)}</tr>`;
  const body = DOMAINS.map((name) => domains.find((d) => d.name === name))
    .filter(Boolean)
    .map((d) => {
      const rows = [band(`<b>${esc(domainTitle(d.name))}</b>`)];
      d.rows.forEach((r) => {
        if (!r.text.trim() && !(r.kind === 'goal' && r.contents.some((c) => c.text.trim()))) return;
        if (r.kind === 'sub') rows.push(band(`<b><i>*${esc(r.text)}</i></b>`));
        else if (r.kind === 'group') rows.push(band(`<b>- ${esc(r.text)}</b>`));
        else {
          const contents = r.contents.filter((c) => c.text.trim());
          const span = Math.max(contents.length, 1);
          const no = numbers[r.id] || '';
          const head = `<td rowspan="${span}" class="c">${no}</td><td rowspan="${span}">${no ? `${no}. ` : ''}${esc(r.text)}</td>`;
          if (!contents.length) rows.push(`<tr>${head}<td></td>${ticks(null)}</tr>`);
          contents.forEach((c, k) => rows.push(`<tr>${k === 0 ? head : ''}<td>- ${esc(c.text)}</td>${ticks(c)}</tr>`));
        }
      });
      return rows.join('');
    })
    .join('');
  const themeHead = n
    ? `<th colspan="${n}">Chủ đề thực hiện</th></tr><tr>${themes.map((t) => `<th class="abbr" title="${esc(t.name)}">${esc(themeAbbr(t))}</th>`).join('')}`
    : '';
  const rs = n ? ' rowspan="2"' : '';
  return `<table class="grid">
<colgroup><col style="width:5%"/><col style="width:${n ? 27 : 40}%"/><col style="width:${n ? 38 : 55}%"/>${themes.map(() => `<col style="width:${(30 / n).toFixed(2)}%"/>`).join('')}</colgroup>
<thead><tr><th${rs}>STT</th><th${rs}>Mục tiêu giáo dục năm</th><th${rs}>Nội dung giáo dục năm</th>${themeHead}</tr></thead>
<tbody>${body}</tbody></table>`;
};

/** Bảng B: chủ đề, sự kiện; đợt nghỉ ghi vào Ghi chú của chủ đề có tuần nghỉ, đợt nghỉ ngoài mọi chủ đề thành dòng riêng. */
const partB = (domains, themes, breaks, numbers) => {
  const overlaps = (t, b) => t.start && t.end && b.start && b.end && b.start <= t.end && t.start <= b.end;
  const breakText = (b) => `Nghỉ: ${esc(b.label || 'Đợt nghỉ')} (${fmt(b.start)} – ${fmt(b.end || b.start)})`;
  const rows = themes.map((t, i) => {
    const nos = themeGoalIds(domains, t)
      .map((id) => numbers[id])
      .filter(Boolean)
      .sort((a, b) => a - b);
    const festivals = (t.festivals || '')
      .split(/[\n;,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `- ${esc(s)}`)
      .join('<br/>');
    const weeks = weekCount(t, breaks);
    const time = t.start ? `${weeks ? `${weeks} tuần<br/>` : ''}Từ ${fmt(t.start)}${t.end ? `<br/>đến ${fmt(t.end)}` : ''}` : '';
    const notes = [t.note ? esc(t.note) : '', ...breaks.filter((b) => overlaps(t, b)).map(breakText)].filter(Boolean).join('<br/>');
    return `<tr><td class="c">${i + 1}</td><td><b>${esc(t.name)}</b></td><td class="c">${nos.length ? `${nos.join(',')} (${nos.length}MT)` : ''}</td><td>${festivals}</td><td>${time}</td><td>${notes}</td></tr>`;
  });
  const lone = breaks.filter((b) => (b.label || b.start) && !themes.some((t) => overlaps(t, b)));
  lone.forEach((b) =>
    rows.push(
      `<tr><td></td><td><i>${esc(b.label || 'Đợt nghỉ')}</i></td><td></td><td></td><td>Từ ${fmt(b.start)}${b.end ? `<br/>đến ${fmt(b.end)}` : ''}</td><td>Đợt nghỉ</td></tr>`,
    ),
  );
  return `<table class="grid">
<colgroup><col style="width:5%"/><col style="width:20%"/><col style="width:14%"/><col style="width:25%"/><col style="width:16%"/><col style="width:20%"/></colgroup>
<thead><tr><th>STT</th><th>Tên chủ đề</th><th>Mục tiêu giáo dục</th><th>Ngày lễ hội</th><th>Thời gian</th><th>Ghi chú</th></tr></thead>
<tbody>${rows.join('')}</tbody></table>`;
};

// Chỗ ký tay: ngày ban hành (chưa có thì để trống), chức danh, khoảng trống ký, họ tên
const signBlock = (plan, staff) => {
  const list = yearSigners(plan, staff);
  const date = plan.issued?.at;
  const [y, m, d] = date ? date.slice(0, 10).split('-') : ['……', '……', '……'];
  const width = Math.floor(100 / Math.max(list.length, 1));
  const col = (x) => `<td class="c" style="width:${width}%"><b>${esc(x.title)}</b><br/><div class="sign"></div>${esc(x.name)}</td>`;
  return `<table class="plain sign-block"><tr><td style="width:30%"></td><td style="width:70%" class="c">
<i>${esc(commune)}, ngày ${d} tháng ${m} năm ${y}</i><br/><b>Người xây dựng kế hoạch</b>
<table class="plain"><tr>${list.map(col).join('')}</tr></table>
</td></tr></table>`;
};

/**
 * HTML đầy đủ của kế hoạch năm học. plan: { schoolYear, ageGroupId, domains (dạng hàng), themes, breaks, owner, sentBy, issued };
 * numbers: số MT theo id mục tiêu.
 */
export const yearPlanHtml = (plan, numbers, staff = []) => {
  const ageName = (AGE_GROUPS.find((a) => a.id === plan.ageGroupId)?.name || '').replace(/[–—]/g, ' - ');
  const year = (plan.schoolYear || '').replace(/\s*[-–]\s*/, ' - ');
  return docShell(
    `Kế hoạch giáo dục năm học ${year}`,
    `${docHeader()}
<p>&nbsp;</p>
<h1>KẾ HOẠCH GIÁO DỤC NĂM HỌC ${esc(year)}</h1>
<h1>KHỐI ${esc(ageName.toUpperCase())}</h1>
<h2>A. MỤC TIÊU GIÁO DỤC, NỘI DUNG GIÁO DỤC</h2>
${partA(plan.domains, plan.themes, numbers)}
<h2>B. DỰ KIẾN KẾ HOẠCH CHỦ ĐỀ, SỰ KIỆN NĂM HỌC</h2>
${partB(plan.domains, plan.themes, plan.breaks || [], numbers)}
${signBlock(plan, staff)}`,
  );
};

/** Chuỗi không dấu cho tên file. */
export const asciiName = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w-]+/g, '_');

/** Tên file theo bộ file mẫu MN Thái Dương: "1. KẾ HOẠCH GIÁO DỤC NĂM HỌC 2026 - 2027 KHỐI MẪU GIÁO NHỠ". */
export const yearPlanFileName = (plan) => {
  const age = (AGE_GROUPS.find((a) => a.id === plan.ageGroupId)?.name || '').split(' (')[0];
  return fileTitle(`1. KẾ HOẠCH GIÁO DỤC NĂM HỌC ${(plan.schoolYear || '').replace(/\s*[-–]\s*/, ' - ')} KHỐI ${age.toUpperCase()}`);
};

/** Tên file có dấu như file của trường, bỏ ký tự hệ điều hành không cho dùng. */
export const fileTitle = (text) =>
  text
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Tải file .doc (HTML Word mở được, không cần thư viện). */
export const downloadDoc = (html, baseName) => {
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Mở trang in cùng bố cục (in giấy hoặc chọn "Lưu dưới dạng PDF"). Trả false khi trình duyệt chặn cửa sổ mới. */
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

/** Tài liệu kế hoạch năm để xem trước rồi xuất / in: { html, name } (xem trước dùng đúng HTML sẽ xuất). */
export const yearPlanFile = (plan, numbers, staff) => ({ html: yearPlanHtml(plan, numbers, staff), name: yearPlanFileName(plan) });
export const downloadYearPlanDoc = (plan, numbers, staff) => downloadDoc(yearPlanHtml(plan, numbers, staff), yearPlanFileName(plan));
export const printYearPlan = (plan, numbers, staff) => printDoc(yearPlanHtml(plan, numbers, staff));
