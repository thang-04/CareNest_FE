/*
 * Xuất kế hoạch chủ đề và giáo án tuần (kế hoạch tuần + 5 kế hoạch ngày) theo bố cục văn bản của MN Thái Dương.
 * Dùng chung khung tài liệu với kế hoạch năm (yearPlanDoc).
 */
import { asciiName, docHeader, docShell, downloadDoc, esc, fmt, printDoc, sigImg } from '@/utils/education-plan/yearPlanDoc';
import { domainRoman } from '@/models/education-plan/goalTable';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { DAY_SECTIONS, WEEKDAY_LABELS, addDays, longDay, rowCell, weekRows } from '@/models/education-plan/classPlan';

const text = (s) => (s?.trim() ? esc(s).replace(/\n/g, '<br/>') : '');
const domainTitle = (name) => `${domainRoman(name)}. Giáo dục ${domainLabel(name).replace(/^P/, 'p')}`;

/** Ký cuối tài liệu: Người xây dựng (giáo viên) bên trái, Người duyệt bên phải. */
const signTable = (doc, teachers, approveTitle = 'Người duyệt') => {
  const person = (title, s, name) =>
    `<td class="c" style="width:25%"><b>${esc(title)}</b><br/><div class="sign">${sigImg(s)}</div><b>${esc(s?.name || name || '')}</b>${
      s?.note ? `<br/><i>${esc(s.note)}</i>` : ''
    }</td>`;
  const builders = (teachers.length ? teachers : [{ id: '-', fullName: '' }]).map((t) =>
    person(
      'Giáo viên',
      (doc.builders || []).find((b) => b.userId === t.id),
      t.fullName,
    ),
  );
  const approvals = (doc.approvals || []).map((a) => person(a.role, a));
  return `<table class="plain sign-block"><tr><td class="c"><b>Người xây dựng</b></td><td class="c"><b>${esc(approveTitle)}</b></td></tr>
<tr><td><table class="plain"><tr>${builders.join('')}</tr></table></td><td><table class="plain"><tr>${approvals.join('') || '<td></td>'}</tr></table></td></tr></table>`;
};

/** Kế hoạch giáo dục chủ đề của lớp. blocks: themeGoalBlocks(…); rowOf(goal) → { contents, activities }. */
export const themePlanHtml = ({ doc, theme, cls, weeks, branchNames, blocks, rowOf, teachers }) => {
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
  const branches = weeks.map((w) => `Tuần ${w.no}: ${esc(branchNames[w.start] || '…')} (${fmt(w.start)} – ${fmt(w.end)})`).join('<br/>');
  return docShell(
    `Kế hoạch chủ đề ${theme.name}`,
    `${docHeader()}
<p>&nbsp;</p>
<h1>KẾ HOẠCH GIÁO DỤC CHỦ ĐỀ: ${esc(theme.name.toUpperCase())}</h1>
<p class="c">${esc(cls.name)} · Thời gian thực hiện: ${weeks.length} tuần (Từ ${fmt(theme.start)} đến ${fmt(theme.end)})</p>
<p><b>Chủ đề nhánh:</b><br/>${branches}</p>
<h2>I. MỤC TIÊU, NỘI DUNG, HOẠT ĐỘNG GIÁO DỤC</h2>
<table class="grid"><colgroup><col style="width:5%"/><col style="width:27%"/><col style="width:34%"/><col style="width:34%"/></colgroup>
<thead><tr><th>TT</th><th>Mục tiêu giáo dục</th><th>Nội dung giáo dục</th><th>Hoạt động giáo dục</th></tr></thead><tbody>${rows}</tbody></table>
<h2>II. MÔI TRƯỜNG GIÁO DỤC</h2>
<p><b>1. Trong lớp</b><br/>${text(doc.envIn)}</p>
<p><b>2. Ngoài lớp</b><br/>${text(doc.envOut)}</p>
${signTable(doc, teachers)}`,
  );
};

/** Giáo án tuần: kế hoạch tuần (bảng 8 hoạt động × Thứ 2–6) rồi 5 kế hoạch ngày, khung duyệt cả tuần ở cuối. */
export const weekPlanHtml = ({ doc, week, cls, theme, branchName, teachers }) => {
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
<h1>KẾ HOẠCH NGÀY</h1><p class="c"><i>${esc(longDay(d.date, i))}</i></p>
<h2>I. Mục đích yêu cầu</h2><p>${text(d.aims)}</p>
<h2>II. Chuẩn bị</h2><p>${text(d.prep)}</p>
<h2>III. Tiến trình hoạt động</h2>
<table class="grid"><colgroup><col style="width:42%"/><col style="width:42%"/><col style="width:16%"/></colgroup>
<thead><tr><th>Hoạt động của cô</th><th>Hoạt động của trẻ</th><th>Ghi chú</th></tr></thead><tbody>${steps}</tbody></table>
<p><b>Đánh giá trẻ trong ngày:</b><br/>${text(d.evaluation)}</p>
<p><b>Kế hoạch điều chỉnh và bổ sung:</b><br/>${text(d.adjustment)}</p>`;
    })
    .join('');
  return docShell(
    `Giáo án tuần ${week.no}`,
    `${docHeader()}
<p>&nbsp;</p>
<h1>KẾ HOẠCH GIÁO DỤC TUẦN ${week.no}: ${esc((branchName || '').toUpperCase())}</h1>
<p class="c">${esc(cls.name)} · Chủ đề: ${esc(theme.name)} · Thời gian: Từ ${fmt(week.start)} đến ${fmt(week.end)}</p>
<h2>I. Mục đích yêu cầu</h2>
<p><b>1. Kiến thức</b><br/>${text(doc.aims.knowledge)}</p>
<p><b>2. Kỹ năng</b><br/>${text(doc.aims.skills)}</p>
<p><b>3. Thái độ</b><br/>${text(doc.aims.attitude)}</p>
<h2>II. Chuẩn bị</h2><p>${text(doc.prep)}</p>
<h2>III. Tổ chức hoạt động</h2>
<table class="grid"><colgroup><col style="width:14%"/>${WEEKDAY_LABELS.map(() => '<col style="width:17.2%"/>').join('')}</colgroup>
<thead><tr><th>Tên hoạt động</th>${WEEKDAY_LABELS.map((l, i) => `<th>${l}<br/>${fmt(addDays(week.start, i))}</th>`).join('')}</tr></thead><tbody>${grid}</tbody></table>
${days}
<p>&nbsp;</p>
<p class="c"><b>Duyệt giáo án từ ngày ${fmt(week.start)} đến ngày ${fmt(week.end)}</b></p>
${signTable(doc, teachers)}`,
  );
};

export const exportThemePlan = (args, mode) => {
  const html = themePlanHtml(args);
  return mode === 'print' ? printDoc(html) : (downloadDoc(html, asciiName(`Ke_hoach_chu_de_${args.theme.name}_${args.cls.name}`)), true);
};

export const exportWeekPlan = (args, mode) => {
  const html = weekPlanHtml(args);
  return mode === 'print' ? printDoc(html) : (downloadDoc(html, asciiName(`Giao_an_tuan_${args.week.no}_${args.cls.name}`)), true);
};
