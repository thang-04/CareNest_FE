/*
 * Xuất dự kiến chủ đề nhánh, kế hoạch chủ đề và giáo án tuần (kế hoạch tuần + 5 kế hoạch ngày) theo bố cục văn bản
 * của MN Thái Dương. Không có chữ ký trong hệ thống: bản in để trống chỗ ký tay, in sẵn họ tên người soạn / người duyệt.
 * Dùng chung khung tài liệu với kế hoạch năm (yearPlanDoc).
 */
import { commune, docShell, downloadDoc, esc, fileTitle, fmt, printDoc } from '@/utils/education-plan/yearPlanDoc';
import { domainRoman } from '@/models/education-plan/goalTable';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { SIGN_ROLES, getEduConfig } from '@/models/education-plan/eduConfig';
import {
  DAY_SECTIONS,
  WEEKDAY_LABELS,
  addDays,
  hocTitle,
  longDay,
  monthOf,
  rowCell,
  weekRows,
  yearWeeks,
} from '@/models/education-plan/classPlan';

const text = (s) => (s?.trim() ? esc(s).replace(/\n/g, '<br/>') : '');
const domainTitle = (name) => `${domainRoman(name)}. Giáo dục ${domainLabel(name).replace(/^P/, 'p')}`;

const BLANK_DATE = 'Ngày……tháng……năm……';

/**
 * Khung duyệt cuối mỗi tuần theo mẫu Thái Dương: "Duyệt giáo án từ ngày … đến ngày …", ngày ký, Người duyệt.
 * Một ô cho mỗi người duyệt (đã duyệt thì in sẵn họ tên); ngày và chữ ký để trống cho ký tay.
 */
const approvalBox = (doc, week) => {
  const approvals = doc.approvals || [];
  const people = approvals.length ? approvals : getEduConfig().signers.week.map((r) => ({ role: SIGN_ROLES[r] }));
  const cells = (people.length ? people : [{}])
    .map(
      (a) =>
        `<td class="c"><i>${BLANK_DATE}</i><br/><b>Người duyệt${a.role ? ` (${esc(a.role)})` : ''}</b><br/><div class="sign"></div><b>${esc(a.name || '')}</b></td>`,
    )
    .join('');
  return `<p>&nbsp;</p><p><b>Duyệt giáo án từ ngày ${fmt(week.start)} đến ngày ${fmt(week.end)}</b></p>
<table class="plain sign-block"><tr><td style="width:50%"></td>${cells}</tr></table>`;
};

/**
 * Phần kế hoạch giáo dục chủ đề (đầu hồ sơ chủ đề). Mẫu Thái Dương không có khung ký riêng cho phần này:
 * kế hoạch chủ đề được duyệt cùng giáo án tuần đầu. blocks: themeGoalBlocks(…); rowOf(goal) → { contents, activities }.
 */
const themeSection = ({ doc, theme, themeNo, weeks, blocks, rowOf }) => {
  // TT đánh số liên tục trong chủ đề; câu mục tiêu giữ số MT của kế hoạch năm (như file mẫu)
  let tt = 0;
  const rows = blocks
    .map((b, i) => {
      const band =
        i === 0 || blocks[i - 1].domain !== b.domain ? `<tr><td></td><td colspan="3"><b>${esc(domainTitle(b.domain))}</b></td></tr>` : '';
      const sub = b.sub ? `<tr><td></td><td colspan="3"><b><i>*${esc(b.sub)}</i></b></td></tr>` : '';
      const goals = b.goals
        .map((g) => {
          const r = rowOf(g);
          return `<tr><td class="c">${(tt += 1)}</td><td>${g.no}. ${esc(g.text)}</td><td>${text(r.contents)}</td><td>${text(r.activities)}</td></tr>`;
        })
        .join('');
      return band + sub + goals;
    })
    .join('');
  return `<h1>KẾ HOẠCH GIÁO DỤC CHỦ ĐỀ ${themeNo}: ${esc(theme.name.toUpperCase())}</h1>
<p class="c">Thời gian thực hiện: ${String(weeks.length).padStart(2, '0')} tuần (từ ngày ${fmt(theme.start)} đến ngày ${fmt(theme.end)})</p>
<h2>I. MỤC TIÊU, NỘI DUNG VÀ HOẠT ĐỘNG GIÁO DỤC</h2>
<table class="grid"><colgroup><col style="width:5%"/><col style="width:27%"/><col style="width:34%"/><col style="width:34%"/></colgroup>
<thead><tr><th>TT</th><th>Mục tiêu giáo dục</th><th>Nội dung giáo dục</th><th>Hoạt động giáo dục</th></tr></thead><tbody>${rows}</tbody></table>
<h2>II. MÔI TRƯỜNG GIÁO DỤC</h2>
<p><b>1. Trong lớp</b><br/>${text(doc.envIn)}</p>
<p><b>2. Ngoài lớp</b><br/>${text(doc.envOut)}</p>`;
};

/** Giáo án một tuần: kế hoạch tuần (bảng hoạt động × Thứ 2–6) rồi 5 kế hoạch ngày, khung duyệt cả tuần ở cuối. */
const weekSection = ({ doc, week, branchNo, branchName }) => {
  const grid = weekRows()
    .map((r) => {
      const g = rowCell(doc, r);
      if (r.canMerge && g.allWeek) return `<tr><td><b>${esc(r.label)}</b></td><td colspan="5">${text(g.common)}</td></tr>`;
      const cells = g.days.map((v) =>
        r.key === 'hoc' ? `<td>${v.subject ? `<b>${esc(v.subject)}</b><br/>` : ''}${text(v.topic)}</td>` : `<td>${text(v)}</td>`,
      );
      // Phần chung cả tuần của dòng (Chơi tự do, Chơi tự chọn…) thành hàng gộp ngay dưới, như file mẫu
      const extra = r.extraLabel && g.extra?.trim() ? `<tr><td><b>${esc(r.label)}</b></td><td colspan="5">${text(g.extra)}</td></tr>` : '';
      return `<tr><td><b>${esc(r.label)}</b></td>${cells.join('')}</tr>${extra}`;
    })
    .join('');
  const days = doc.days
    .map((d, i) => {
      const hoc = doc.grid.hoc.days[i] || {};
      const steps = DAY_SECTIONS.map((s) => {
        const head = `<tr><td colspan="3"><b>${esc(s.label)}${s.key === 'hoc' && hocTitle(hoc) ? `: ${esc(hocTitle(hoc))}` : ''}</b></td></tr>`;
        return (
          head +
          s.parts
            .map((p) => {
              const st = d.steps[`${s.key}.${p.key}`] || {};
              return `${p.label ? `<tr><td colspan="3"><i>${esc(p.label)}</i></td></tr>` : ''}<tr><td>${text(st.teacher)}</td><td>${text(st.child)}</td><td>${text(st.note)}</td></tr>`;
            })
            .join('')
        );
      }).join('');
      return `<div style="page-break-before:always"></div>
${i === 0 ? '<h1>KẾ HOẠCH NGÀY</h1>' : ''}<p class="c"><b>${esc(longDay(d.date, i))}</b></p>
<h2>I. Mục đích, yêu cầu</h2><p>${text(d.aims)}</p>
<h2>II. Chuẩn bị</h2><p>${text(d.prep)}</p>
<h2>III. Tiến trình hoạt động</h2>
<table class="grid"><colgroup><col style="width:42%"/><col style="width:42%"/><col style="width:16%"/></colgroup>
<thead><tr><th>Hoạt động của cô</th><th>Hoạt động của trẻ</th><th>Ghi chú</th></tr></thead><tbody>${steps}</tbody></table>
<p><b>*Đánh giá trẻ trong ngày:</b><br/><br/><br/></p>
<p><b>*Kế hoạch điều chỉnh và bổ sung:</b><br/><br/><br/></p>`;
    })
    .join('');
  return `<div style="page-break-before:always"></div>
<h1>KẾ HOẠCH TUẦN</h1>
<p class="c"><b>Chủ đề nhánh ${branchNo}: ${esc(branchName || '…')}</b></p>
<p class="c">Thời gian thực hiện: 1 tuần từ ${fmt(week.start)} → ${fmt(week.end)}</p>
<h2>I. Mục đích, yêu cầu</h2>
<p><b>1. Kiến thức</b><br/>${text(doc.aims.knowledge)}</p>
<p><b>2. Kỹ năng</b><br/>${text(doc.aims.skills)}</p>
<p><b>3. Thái độ</b><br/>${text(doc.aims.attitude)}</p>
<h2>II. Chuẩn bị</h2><p>${text(doc.prep)}</p>
<h2>III. Tổ chức hoạt động</h2>
<table class="grid"><colgroup><col style="width:14%"/>${WEEKDAY_LABELS.map(() => '<col style="width:17.2%"/>').join('')}</colgroup>
<thead><tr><th>Thứ</th>${WEEKDAY_LABELS.map((l, i) => `<th>${l}<br/>${fmt(addDays(week.start, i))}</th>`).join('')}</tr></thead><tbody>${grid}</tbody></table>
${days}
${approvalBox(doc, week)}`;
};

/**
 * Hồ sơ chủ đề đúng thứ tự file của trường: kế hoạch giáo dục chủ đề → từng tuần nhánh (kế hoạch tuần, 5 kế hoạch ngày,
 * khung "Duyệt giáo án từ ngày … đến ngày …" để ký tay). weekDocs: [{ week, branchNo, branchName, doc }] (tuần chưa soạn bỏ qua).
 */
export const themeFileHtml = ({ themeDoc, theme, themeNo, cls, weeks, blocks, rowOf, weekDocs }) =>
  docShell(
    `KHGD chủ đề ${themeNo} ${theme.name} ${cls.name}`,
    `${themeDoc ? themeSection({ doc: themeDoc, theme, themeNo, weeks, blocks, rowOf }) : ''}
${weekDocs.map((w) => weekSection(w)).join('')}
<p class="c"><i>KHGD - ${esc(cls.name)}</i></p>`,
  );

/** Một tuần riêng (in / gửi duyệt hằng tuần). */
export const weekFileHtml = ({ cls, ...w }) =>
  docShell(`Giáo án tuần ${w.week.no} ${cls.name}`, `${weekSection(w).replace('<div style="page-break-before:always"></div>', '')}`);

/**
 * "Dự kiến các chủ đề nhánh và thời gian thực hiện" theo mẫu Thái Dương: Tháng | Chủ đề | Chủ đề nhánh | Số tuần | Ghi chú,
 * tháng và chủ đề gộp theo chủ đề, dòng nghỉ riêng; cuối trang Người duyệt kế hoạch (Phó HT) và Người xây dựng (giáo viên).
 */
export const branchFileHtml = ({ doc, cls, yearPlan, teachers }) => {
  const rows = yearWeeks(yearPlan);
  const weeks = rows.filter((r) => r.type === 'week');
  const year = (yearPlan.schoolYear || '').replace(/\s*[-–]\s*/, ' - ');
  const span = (i) => {
    let n = 1;
    while (i + n < rows.length && rows[i + n].theme.id === rows[i].theme.id) n += 1;
    return n;
  };
  const months = (t) => {
    const a = monthOf(t.start);
    const b = monthOf(t.end);
    return a === b ? `${a}` : `${a} - ${b}`;
  };
  const body = rows
    .map((r, i) => {
      const head =
        i === 0 || rows[i - 1].theme.id !== r.theme.id
          ? `<td class="c" rowspan="${span(i)}">${months(r.theme)}</td><td class="c" rowspan="${span(i)}"><b>${esc(r.theme.name.toUpperCase())}</b></td>`
          : '';
      if (r.type === 'break')
        return `<tr>${head}<td colspan="3"><i>Nghỉ ${esc(r.label || '')} từ ngày ${fmt(r.start)} đến hết ngày ${fmt(r.end)}</i></td></tr>`;
      const no = rows.slice(0, i + 1).filter((x) => x.type === 'week' && x.theme.id === r.theme.id).length;
      return `<tr>${head}<td>- Nhánh ${no}: ${esc(doc.names?.[r.start] || '')}</td><td>Tuần ${r.no}: ${fmt(r.start)}<br/>${fmt(r.end)}</td><td>${esc(doc.notes?.[r.start] || '')}</td></tr>`;
    })
    .join('');
  const approver = (doc.approvals || []).at(-1);
  const people = teachers.length ? teachers : [{ fullName: '' }];
  return docShell(
    `Dự kiến các chủ đề nhánh ${cls.name}`,
    `<h1>DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN NĂM HỌC ${esc(year)} - ${esc(cls.name.toUpperCase())}</h1>
<p class="c">Thời gian thực hiện: ${weeks.length} tuần, từ ngày ${fmt(weeks[0]?.start)}, kết thúc ngày ${fmt(weeks.at(-1)?.end)}</p>
<table class="grid"><colgroup><col style="width:9%"/><col style="width:19%"/><col style="width:38%"/><col style="width:18%"/><col style="width:16%"/></colgroup>
<thead><tr><th>Tháng</th><th>Chủ đề</th><th>Chủ đề nhánh</th><th>Số tuần</th><th>Ghi chú</th></tr></thead><tbody>${body}</tbody></table>
<table class="plain sign-block"><tr>
<td class="c" style="width:40%"><br/><b>Người duyệt kế hoạch</b><br/><div class="sign"></div><b>${esc(approver?.name || '')}</b></td>
<td class="c" style="width:60%"><i>${esc(commune)}, ngày …… tháng …… năm ……</i><br/><b>Người xây dựng kế hoạch</b>
<table class="plain"><tr>${people.map((t) => `<td class="c"><b>Giáo viên</b><br/><div class="sign"></div><b>${esc(t.fullName || '')}</b></td>`).join('')}</tr></table></td>
</tr></table>`,
  );
};

const output = (html, name, mode) => (mode === 'print' ? printDoc(html) : (downloadDoc(html, fileTitle(name)), true));

// Tên file theo bộ file mẫu của trường: "2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH…", "3. KHGD CĐ n …"
export const exportBranchFile = (args, mode) =>
  output(branchFileHtml(args), `2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN - ${args.cls.name}`, mode);

export const exportThemeFile = (args, mode) =>
  output(themeFileHtml(args), `3. KHGD CĐ ${args.themeNo} ${args.theme.name} - ${args.cls.name}`, mode);

export const exportWeekPlan = (args, mode) => output(weekFileHtml(args), `Giáo án tuần ${args.week.no} - ${args.cls.name}`, mode);
