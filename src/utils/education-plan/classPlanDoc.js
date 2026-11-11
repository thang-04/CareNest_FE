import { branchDisplayRows, branchWeeks, calendarPlan } from '@/models/education-plan/branchCalendar.mjs';
/*
 * Xuất dự kiến chủ đề nhánh, kế hoạch chủ đề và giáo án tuần (kế hoạch tuần + 5 kế hoạch ngày) theo bố cục văn bản
 * của MN Thái Dương. Không có chữ ký trong hệ thống: bản in để trống chỗ ký tay, in sẵn họ tên người soạn / người duyệt.
 * Dùng chung khung tài liệu với kế hoạch năm (yearPlanDoc).
 */
import { commune, docShell, downloadDoc, esc, fileTitle, fmt, printDoc } from '@/utils/education-plan/yearPlanDoc';
import { domainRoman } from '@/models/education-plan/goalTable';
import { domainLabel } from '@/models/education-plan/educationPlanConstants';
import { SIGN_ROLES, getEduConfig, soleSignerName } from '@/models/education-plan/eduConfig';
import {
  DAY_REVIEW,
  DAY_SECTIONS,
  PREP_TARGETS,
  WEEKDAY_LABELS,
  addDays,
  branchNumber,
  dayDraftFromWeek,
  longDay,
  monthOf,
  normalizeDay,
  normalizeWeek,
  rowCell,
  weekRows,
  yearWeeks,
} from '@/models/education-plan/classPlan';

const text = (s) => (s?.trim() ? esc(s).replace(/\n/g, '<br/>') : '');
const domainTitle = (name) => `${domainRoman(name)}. Giáo dục ${domainLabel(name).replace(/^P/, 'p')}`;

const BLANK_DATE = 'Ngày……tháng……năm……';

const parseSnapshot = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Người ký theo chuỗi duyệt đã cấu hình hoặc snapshot đã lưu khi ban hành: chức danh và họ tên (người đã duyệt; Tổ trưởng chưa duyệt thì lấy Tổ trưởng
 * của nhóm tuổi; còn lại để trống cho viết tay).
 */
export const signersOf = (chain, approvals = [], leaderName = '', snapshotRaw = null) => {
  const snapshot = parseSnapshot(snapshotRaw);
  if (snapshot?.slots?.length) {
    return snapshot.slots
      .filter((slot) => slot.roleKey !== 'CREATOR')
      .map((s) => ({
        role: s.roleKey,
        title: s.label || SIGN_ROLES[s.roleKey] || s.roleKey,
        name: (s.names || []).join(', '),
      }));
  }
  return chain.map((r) => ({
    role: r,
    title: SIGN_ROLES[r],
    name:
      approvals.find((a) => a.roleKey === r || a.role === SIGN_ROLES[r])?.name ||
      (r === 'TEAM_LEADER' ? leaderName : soleSignerName(r)) ||
      '',
  }));
};
/** Họ tên Tổ trưởng của nhóm tuổi (staff BE trả kèm tài liệu lớp: { fullName, role, ageGroupId }). */
// staff là Tổ trưởng của năm học đang xem (đúng năm của tài liệu lớp); không có thì lấy theo cấu hình của năm schoolYear
export const leaderNameOf = (staff = [], ageGroupId, schoolYear) =>
  staff.find((s) => s.role === 'TEAM_LEADER' && s.ageGroupId === ageGroupId)?.fullName ||
  soleSignerName('TEAM_LEADER', ageGroupId, schoolYear) ||
  '';
const signCell = (x, top = '') => `<td class="c">${top}<b>${esc(x.title)}</b><br/><div class="sign"></div>${esc(x.name)}</td>`;

/**
 * Khung duyệt cuối mỗi tuần theo mẫu Thái Dương: "Duyệt giáo án từ ngày … đến ngày …", ngày ký, người duyệt theo chuỗi
 * đã cấu hình (chức danh, chỗ ký tay, họ tên).
 */
const approvalBox = (doc, week, leaderName) => {
  const snapshot = doc?.review?.printSnapshot || doc?.printSnapshot;
  const people = signersOf(getEduConfig().signers.week, doc?.approvals, leaderName, snapshot);
  const creators = (parseSnapshot(snapshot)?.slots || [])
    .filter((slot) => slot.roleKey === 'CREATOR')
    .map((slot) => signCell({ title: slot.label || 'Người soạn', name: (slot.names || []).join(', ') }))
    .join('');
  const cells = (people.length ? people : [{ title: 'Người duyệt', name: '' }])
    .map((x) => signCell(x, `<i>${BLANK_DATE}</i><br/>`))
    .join('');
  return `<p>&nbsp;</p><p><b>Duyệt giáo án từ ngày ${fmt(week.start)} đến ngày ${fmt(week.end)}</b></p>
<table class="plain sign-block"><tr>${creators || '<td style="width:50%"></td>'}${cells}</tr></table>`;
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
        // Không gộp ô ngang: đường kẻ dọc các cột liền tới cuối bảng (Tiền 03/11)
        i === 0 || blocks[i - 1].domain !== b.domain
          ? `<tr><td></td><td><b>${esc(domainTitle(b.domain))}</b></td><td></td><td></td></tr>`
          : '';
      const sub = b.sub ? `<tr><td></td><td><b><i>*${esc(b.sub)}</i></b></td><td></td><td></td></tr>` : '';
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

/** Bảng góc chi tiết của tuần (spec 005 FR-015). */
const cornerTable = (doc) =>
  doc.corners?.length
    ? `<table class="grid"><colgroup><col style="width:14%"/><col style="width:18%"/><col style="width:22%"/><col style="width:20%"/><col style="width:26%"/></colgroup>
<thead><tr><th>Góc</th><th>Nội dung</th><th>Mục đích, yêu cầu</th><th>Chuẩn bị</th><th>Cách tiến hành</th></tr></thead><tbody>${doc.corners
        .map(
          (c) =>
            `<tr><td><b>${esc(c.name || '')}</b></td><td>${text(c.content)}</td><td>${text(c.aims)}</td><td>${text(c.prep)}</td><td>${text(c.steps)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';

const prepPart = (doc) => {
  const prep = normalizeWeek(doc).prep;
  return PREP_TARGETS.map((t) => `<p><b>${esc(t.label)}</b><br/>${text(prep[t.key])}</p>`).join('');
};

/** Kế hoạch tuần: mục đích (bỏ khi trống cả 3 ô — FR-017), chuẩn bị 3 đối tượng, bảng Thứ 2–6, bảng góc. */
const weekPlanPart = ({ doc, week, branchNo, branchName }) => {
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
  const aims = doc.aims || {};
  const hasAims = ['knowledge', 'skills', 'attitude'].some((k) => aims[k]?.trim());
  const n = (k) => (hasAims ? k + 1 : k);
  const corners = cornerTable(doc);
  return `<div style="page-break-before:always"></div>
<h1>KẾ HOẠCH TUẦN</h1>
<p class="c"><b>Chủ đề nhánh ${branchNo}: ${esc(branchName || '…')}</b></p>
<p class="c">Thời gian thực hiện: 1 tuần từ ${fmt(week.start)} → ${fmt(week.end)}</p>
${
  hasAims
    ? `<h2>I. Mục đích, yêu cầu</h2>
<p><b>1. Kiến thức</b><br/>${text(aims.knowledge)}</p>
<p><b>2. Kỹ năng</b><br/>${text(aims.skills)}</p>
<p><b>3. Thái độ</b><br/>${text(aims.attitude)}</p>`
    : ''
}
<h2>${ROMAN[n(0)]}. Chuẩn bị</h2>${prepPart(doc)}
<h2>${ROMAN[n(1)]}. Tổ chức hoạt động</h2>
<table class="grid"><colgroup><col style="width:14%"/>${WEEKDAY_LABELS.map(() => '<col style="width:17.2%"/>').join('')}</colgroup>
<thead><tr><th>Thứ</th>${WEEKDAY_LABELS.map((l, i) => `<th>${l}<br/>${fmt(addDays(week.start, i))}${week.offDays?.[i] ? `<br/>Nghỉ: ${esc(week.offDays[i])}` : ''}</th>`).join('')}</tr></thead><tbody>${grid}</tbody></table>
${corners ? `<h2>${ROMAN[n(2)]}. Hoạt động góc</h2>${corners}` : ''}`;
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const BLANK_LINES = '<br/><br/>';

/** Bảng Tiến hành: dòng có tên in thành tiêu đề dòng; cột Ghi chú bỏ khi cả bảng trống (FR-017). */
const stepTable = (rows) => {
  const withNote = rows.some((r) => r.note?.trim());
  const cols = withNote ? 3 : 2;
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `${r.title?.trim() ? `<tr><td colspan="${cols}"><b>${esc(r.title)}</b></td></tr>` : ''}<tr><td>${text(r.teacher)}</td><td>${text(r.child)}</td>${withNote ? `<td>${text(r.note)}</td>` : ''}</tr>`,
        )
        .join('')
    : `<tr><td>${BLANK_LINES}</td><td>${BLANK_LINES}</td></tr>`;
  const colgroup = withNote
    ? '<col style="width:42%"/><col style="width:42%"/><col style="width:16%"/>'
    : '<col style="width:50%"/><col style="width:50%"/>';
  return `<table class="grid"><colgroup>${colgroup}</colgroup>
<thead><tr><th>Hoạt động của cô</th><th>Hoạt động của trẻ</th>${withNote ? '<th>Ghi chú</th>' : ''}</tr></thead><tbody>${body}</tbody></table>`;
};

/** 5 giáo án ngày theo mẫu chung (spec 005): I. Giáo án 4 mục a/b/c (khung in cả khi trống), II. Đánh giá trẻ trên ngày. */
const dayPlansPart = ({ doc, week }) =>
  doc.days
    .map((raw, i) => {
      const d = normalizeDay(raw);
      const heading = `<div style="page-break-before:always"></div>
${i === 0 ? '<h1>KẾ HOẠCH NGÀY</h1>' : ''}<p class="c"><b>${esc(longDay(d.date, i))}</b>${week.offDays?.[i] ? ` (Nghỉ: ${esc(week.offDays[i])})` : ''}</p>`;
      if (week.offDays?.[i]) return heading;
      const fromWeek = dayDraftFromWeek(doc, i);
      const sections = DAY_SECTIONS.map((s) => {
        const sec = d.sections[s.key];
        const name = fromWeek[s.key]?.name;
        return `<p><b>${esc(s.label)}${name ? `: ${esc(name)}` : ''}</b></p>
<p><b>a) Mục đích, yêu cầu</b><br/>${text(sec.aims) || BLANK_LINES}</p>
<p><b>b) Chuẩn bị</b><br/>${text(sec.prep) || BLANK_LINES}</p>
<p><b>c) Tiến hành</b></p>${stepTable(sec.rows)}`;
      }).join('');
      const review = DAY_REVIEW.map((r) => `<p><b>${esc(r.label)}</b><br/>${text(d.review?.[r.key]) || BLANK_LINES}</p>`).join('');
      return `${heading}
<h2>I. Giáo án</h2>${sections}
<h2>II. Đánh giá trẻ trên ngày</h2>${review}`;
    })
    .join('');

/** Giáo án một tuần trong hồ sơ chủ đề: kế hoạch tuần rồi 5 giáo án ngày, khung duyệt cả tuần ở cuối. */
const weekSection = ({ doc, week, branchNo, branchName, leaderName }) =>
  `${weekPlanPart({ doc, week, branchNo, branchName })}
${dayPlansPart({ doc, week })}
${approvalBox(doc, week, leaderName)}`;

/**
 * File của trang Giáo án ngày (FR-016): một file cả tuần theo thứ tự file "Chủ đề gia đình" — Chuẩn bị tuần, bảng góc,
 * rồi giáo án Thứ 2 → Thứ 6.
 */
export const dayPlansFileHtml = ({ doc, week, branchNo, branchName, cls, leaderName }) => {
  const corners = cornerTable(doc);
  return docShell(
    `Giáo án ngày tuần ${week.no} ${cls.name}`,
    `<h1>GIÁO ÁN TUẦN ${week.no}</h1>
<p class="c"><b>Chủ đề nhánh ${branchNo}: ${esc(branchName || '…')}</b></p>
<p class="c">Thời gian thực hiện: 1 tuần từ ${fmt(week.start)} → ${fmt(week.end)}</p>
<h2>I. Chuẩn bị</h2>${prepPart(doc)}
${corners ? `<h2>II. Hoạt động góc</h2>${corners}` : ''}
${dayPlansPart({ doc, week })}
${approvalBox(doc, week, leaderName)}`,
  );
};

/**
 * Hồ sơ chủ đề đúng thứ tự file của trường: kế hoạch giáo dục chủ đề → từng tuần nhánh (kế hoạch tuần, 5 kế hoạch ngày,
 * khung "Duyệt giáo án từ ngày … đến ngày …" để ký tay). weekDocs: [{ week, branchNo, branchName, doc }] (tuần chưa soạn bỏ qua).
 */
export const themeFileHtml = ({ themeDoc, theme, themeNo, cls, weeks, blocks, rowOf, weekDocs, leaderName }) =>
  docShell(
    `KHGD chủ đề ${themeNo} ${theme.name} ${cls.name}`,
    `${themeDoc ? themeSection({ doc: themeDoc, theme, themeNo, weeks, blocks, rowOf }) : ''}
${weekDocs.map((w) => weekSection({ ...w, leaderName })).join('')}
<p class="c"><i>KHGD - ${esc(cls.name)}</i></p>`,
  );

/** Trang Kế hoạch tuần: chỉ kế hoạch tuần (giáo án ngày xuất ở trang Giáo án ngày — FR-016). */
export const weekFileHtml = ({ cls, leaderName, ...w }) =>
  docShell(
    `Kế hoạch tuần ${w.week.no} ${cls.name}`,
    `${weekPlanPart(w).replace('<div style="page-break-before:always"></div>', '')}
${approvalBox(w.doc, w.week, leaderName)}`,
  );

/**
 * "Dự kiến các chủ đề nhánh và thời gian thực hiện" theo mẫu Thái Dương: Tháng | Chủ đề | Chủ đề nhánh | Số tuần | Ghi chú,
 * tháng và chủ đề gộp theo chủ đề, dòng nghỉ riêng; cuối trang Người duyệt kế hoạch (Phó HT) và Người xây dựng (giáo viên).
 */
// blank: file mẫu để nhập (Tiền 05/11) — giữ nguyên bảng như file xuất (tháng, chủ đề, tuần, dòng nghỉ, chỗ ký),
// bỏ dữ liệu đã có: tên nhánh, ghi chú, họ tên người ký
export const branchFileHtml = ({ doc, cls, yearPlan, teachers, leaderName, blank = false }) => {
  const allRows = yearWeeks(calendarPlan(yearPlan, doc));
  const rows = !blank && doc.schemaVersion === 2 ? branchDisplayRows(yearPlan, doc) : allRows;
  const weeks = allRows.filter((r) => r.type === 'week');
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
        // Tên đợt nghỉ thường đã có chữ "Nghỉ" ("Nghỉ Tết Nguyên đán"): không lặp "Nghỉ Nghỉ"
        return `<tr>${head}<td colspan="3"><i>Nghỉ ${esc((r.label || '').replace(/^\s*nghỉ\s*/i, ''))} từ ngày ${fmt(r.start)} đến hết ngày ${fmt(r.end)}</i></td></tr>`;
      const no =
        doc.schemaVersion === 2
          ? branchNumber(calendarPlan(yearPlan, doc), r.start, doc)
          : rows.slice(0, i + 1).filter((x) => x.type === 'week' && x.theme.id === r.theme.id).length;
      const branch =
        !blank && doc.schemaVersion === 2
          ? (doc.branches || []).find((b) => String(b.themeId) === String(r.theme.id) && r.start >= b.startDate && r.start <= b.endDate)
          : null;
      const coveredWeeks = branch ? branchWeeks(branch, yearPlan, doc) : [];
      const branchNotes = branch
        ? coveredWeeks
            .filter((week) => doc.notes?.[week.start]?.trim())
            .map((week) => `${coveredWeeks.length > 1 ? `Tuần ${week.no}: ` : ''}${text(doc.notes[week.start])}`)
            .join('<br/>')
        : esc(doc.notes?.[r.start] || '');
      const dates = branch
        ? `${fmt(branch.startDate)} – ${fmt(branch.endDate)}`
        : !blank && doc.schemaVersion === 2
          ? 'dd/mm/yyyy – dd/mm/yyyy'
          : `Tuần ${r.no}: ${fmt(r.start)}<br/>${fmt(r.end)}`;
      return `<tr>${head}<td>${no ? `- Nhánh ${no}: ` : ''}${blank ? '' : esc(doc.names?.[r.start] || '')}</td><td>${dates}</td><td>${blank ? '' : branchNotes}</td></tr>`;
    })
    .join('');
  const snapshot = doc?.review?.printSnapshot || doc?.printSnapshot;
  const approvers = signersOf(getEduConfig().signers.branch, blank ? [] : doc?.approvals, leaderName, blank ? null : snapshot).map((x) =>
    blank ? { ...x, name: '' } : x,
  );
  const frozen = !blank && parseSnapshot(snapshot);
  const people = frozen
    ? (frozen.slots || [])
        .filter((slot) => slot.roleKey === 'CREATOR')
        .flatMap((slot) => (slot.names || []).map((name) => ({ fullName: name, title: slot.label || 'Người soạn' })))
    : teachers.length && !blank
      ? teachers
      : [{ fullName: '' }];
  return docShell(
    `Dự kiến các chủ đề nhánh ${cls.name}`,
    `<h1>DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN NĂM HỌC ${esc(year)} - ${esc(cls.name.toUpperCase())}</h1>
<p class="c">Thời gian thực hiện: ${weeks.length} tuần, từ ngày ${fmt(weeks[0]?.start)}, kết thúc ngày ${fmt(weeks.at(-1)?.end)}</p>
<table class="grid"><colgroup><col style="width:9%"/><col style="width:19%"/><col style="width:38%"/><col style="width:18%"/><col style="width:16%"/></colgroup>
<thead><tr><th>Tháng</th><th>Chủ đề</th><th>Chủ đề nhánh</th><th>Số tuần</th><th>Ghi chú</th></tr></thead><tbody>${body}</tbody></table>
<table class="plain sign-block"><tr>
<td class="c" style="width:50%"><br/><b>Người duyệt kế hoạch</b>
<table class="plain"><tr>${approvers.map((x) => signCell(x)).join('')}</tr></table></td>
<td class="c" style="width:50%"><i>${esc(commune)}, ngày …… tháng …… năm ……</i><br/><b>Người xây dựng kế hoạch</b>
<table class="plain"><tr>${people.map((t) => signCell({ title: t.title || 'Giáo viên', name: t.fullName || '' })).join('')}</tr></table></td>
</tr></table>`,
  );
};

const output = (html, name, mode) => (mode === 'print' ? printDoc(html) : (downloadDoc(html, fileTitle(name)), true));

/** Tài liệu lớp để xem trước rồi xuất / in: { html, name } (xem trước dùng đúng HTML sẽ xuất). */
export const branchFile = (args) => ({
  html: branchFileHtml(args),
  name: fileTitle(`2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN - ${args.cls.name}`),
});
/** File mẫu nhập chủ đề nhánh: đúng bảng của file xuất, để trống tên nhánh và ghi chú (Tiền 05/11). */
export const branchTemplateFile = (args) => ({
  html: branchFileHtml({ ...args, doc: { names: {}, notes: {} }, blank: true }),
  name: fileTitle(`Mẫu nhập chủ đề nhánh - ${args.cls.name}`),
});
export const themeFile = (args) => ({
  html: themeFileHtml(args),
  name: fileTitle(`3. KHGD CĐ ${args.themeNo} ${args.theme.name} - ${args.cls.name}`),
});
export const weekFile = (args) => ({ html: weekFileHtml(args), name: fileTitle(`Giáo án tuần ${args.week.no} - ${args.cls.name}`) });
export const dayPlansFile = (args) => ({
  html: dayPlansFileHtml(args),
  name: fileTitle(`Giáo án ngày tuần ${args.week.no} - ${args.cls.name}`),
});

// Tên file theo bộ file mẫu của trường: "2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH…", "3. KHGD CĐ n …"
export const exportBranchFile = (args, mode) =>
  output(branchFileHtml(args), `2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN - ${args.cls.name}`, mode);

export const exportThemeFile = (args, mode) =>
  output(themeFileHtml(args), `3. KHGD CĐ ${args.themeNo} ${args.theme.name} - ${args.cls.name}`, mode);

export const exportWeekPlan = (args, mode) => output(weekFileHtml(args), `Giáo án tuần ${args.week.no} - ${args.cls.name}`, mode);
