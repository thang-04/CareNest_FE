/*
 * Xuất kế hoạch chủ đề và giáo án tuần (kế hoạch tuần + 5 kế hoạch ngày) theo bố cục văn bản của MN Thái Dương.
 * Dùng chung khung tài liệu với kế hoạch năm (yearPlanDoc).
 */
import { asciiName, docShell, downloadDoc, esc, fmt, printDoc, sigImg } from '@/utils/education-plan/yearPlanDoc';
import { domainRoman } from '@/models/education-plan/goalTable';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { SIGN_ROLES, getEduConfig } from '@/models/education-plan/eduConfig';
import { DAY_SECTIONS, WEEKDAY_LABELS, addDays, longDay, rowCell, weekRows } from '@/models/education-plan/classPlan';

const text = (s) => (s?.trim() ? esc(s).replace(/\n/g, '<br/>') : '');
const domainTitle = (name) => `${domainRoman(name)}. Giáo dục ${domainLabel(name).replace(/^P/, 'p')}`;

// "Ngày … tháng … năm …" của lần ký; chưa ký thì để chấm như mẫu in
const signDate = (iso, fallbackIso) => {
  const d = iso ? iso.slice(0, 10) : '';
  if (!d) return `Ngày……tháng ${Number(fallbackIso.slice(5, 7))} năm ${fallbackIso.slice(0, 4)}`;
  return `Ngày ${Number(d.slice(8, 10))} tháng ${Number(d.slice(5, 7))} năm ${d.slice(0, 4)}`;
};

/** Khung duyệt cuối mỗi tuần theo mẫu Thái Dương: "Duyệt giáo án từ ngày … đến ngày …", ngày ký, Người duyệt. */
const approvalBox = (doc, week) => {
  // Chưa duyệt: để ô trống theo chuỗi người duyệt của trường (Tổ trưởng → Phó HT)
  const chain = getEduConfig().signers.week;
  const approvals = doc.approvals || [];
  const people =
    doc.status === 'APPROVED' || !chain.length
      ? approvals.length
        ? approvals
        : [null]
      : chain.map((r) => approvals.find((a) => a.roleKey === r) || { role: SIGN_ROLES[r] });
  const cells = people
    .map(
      (a) =>
        `<td class="c"><i>${esc(signDate(a?.at, week.start))}</i><br/><b>Người duyệt${a?.role ? ` (${esc(a.role)})` : ''}</b><br/><div class="sign">${sigImg(a)}</div><b>${esc(
          a?.name || '',
        )}</b>${a?.note ? `<br/><i>${esc(a.note)}</i>` : ''}</td>`,
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
  const rows = blocks
    .map((b, i) => {
      const band =
        i === 0 || blocks[i - 1].domain !== b.domain ? `<tr><td></td><td colspan="3"><b>${esc(domainTitle(b.domain))}</b></td></tr>` : '';
      const sub = b.sub ? `<tr><td></td><td colspan="3"><b><i>*${esc(b.sub)}</i></b></td></tr>` : '';
      const goals = b.goals
        .map((g) => {
          const r = rowOf(g);
          return `<tr><td class="c">${g.no}</td><td>${g.no}. ${esc(g.text)}</td><td>${text(r.contents)}</td><td>${text(r.activities)}</td></tr>`;
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
      return `<tr><td><b>${esc(r.label)}</b></td>${cells.join('')}</tr>`;
    })
    .join('');
  const days = doc.days
    .map((d, i) => {
      const hoc = doc.grid.hoc.days[i] || {};
      const steps = DAY_SECTIONS.map((s) => {
        const head = `<tr><td colspan="3"><b>${esc(s.label)}${s.key === 'hoc' && (hoc.subject || hoc.topic) ? `: ${esc([hoc.subject, hoc.topic].filter(Boolean).join(' – '))}` : ''}</b></td></tr>`;
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
<p><b>Đánh giá trẻ trong ngày:</b><br/>${text(d.evaluation)}</p>
<p><b>Kế hoạch điều chỉnh và bổ sung:</b><br/>${text(d.adjustment)}</p>`;
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
 * khung "Duyệt giáo án từ ngày … đến ngày …"). weekDocs: [{ week, branchNo, branchName, doc }] (tuần chưa soạn bỏ qua).
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

const output = (html, name, mode) => (mode === 'print' ? printDoc(html) : (downloadDoc(html, asciiName(name)), true));

export const exportThemeFile = (args, mode) =>
  output(themeFileHtml(args), `KHGD_chu_de_${args.themeNo}_${args.theme.name}_${args.cls.name}`, mode);

export const exportWeekPlan = (args, mode) => output(weekFileHtml(args), `Giao_an_tuan_${args.week.no}_${args.cls.name}`, mode);
