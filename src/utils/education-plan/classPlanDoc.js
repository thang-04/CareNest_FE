import { branchDisplayRows, branchWeeks, calendarPlan } from '@/models/education-plan/branchCalendar.mjs';
/*
 * Xuất dự kiến chủ đề nhánh, kế hoạch chủ đề và giáo án tuần (kế hoạch tuần + 5 kế hoạch ngày) theo bố cục văn bản
 * của MN Thái Dương. Không có chữ ký trong hệ thống: bản in để trống chỗ ký tay, in sẵn họ tên người soạn / người duyệt.
 * Dùng chung khung tài liệu với kế hoạch năm (yearPlanDoc).
 */
import { commune, docShell, downloadDoc, esc, fileTitle, fmt, printDoc } from '@/utils/education-plan/yearPlanDoc';
import { AGE_GROUPS, domainLabel } from '@/models/education-plan/educationPlanConstants';
import { SIGN_ROLES, getEduConfig, soleSignerName } from '@/models/education-plan/eduConfig';
import {
  DAY_REVIEW,
  DAY_SECTIONS,
  PREP_TARGETS,
  partsOff,
  WEEKDAY_LABELS,
  addDays,
  branchNumber,
  contentLinesOf,
  coverageOf,
  dayDraftFromWeek,
  ddmm,
  normalizeTheme,
  themeActivities,
  longDay,
  monthOf,
  normalizeDay,
  normalizeWeek,
  rowCell,
  weekRows,
  yearWeeks,
} from '@/models/education-plan/classPlan';

const text = (s) => (s?.trim() ? esc(s).replace(/\n/g, '<br/>') : '');

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
 * Khung duyệt cuối mỗi tuần theo mẫu Thái Dương: "Duyệt kế hoạch giáo dục ngày từ ngày … đến ngày …", ngày ký, người duyệt theo chuỗi
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
  return `<p>&nbsp;</p><p><b>Duyệt kế hoạch giáo dục ngày từ ngày ${fmt(week.start)} đến ngày ${fmt(week.end)}</b></p>
<table class="plain sign-block"><tr>${creators || '<td style="width:50%"></td>'}${cells}</tr></table>`;
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

/**
 * Bảng Tiến hành như file "Chủ đề gia đình": cột đầu là nội dung hoạt động (tên bước) khi có dòng đặt tên; cột Ghi chú bỏ khi
 * cả bảng trống (FR-017).
 */
const stepTable = (rows, labels = {}) => {
  const L = { name: 'Nội dung hoạt động', teacher: 'Hoạt động của cô', child: 'Hoạt động của trẻ', ...labels };
  const withName = rows.some((r) => r.title?.trim());
  const withNote = rows.some((r) => r.note?.trim());
  const cols = [withName && L.name, L.teacher, L.child, withNote && 'Ghi chú'].filter(Boolean);
  const cell = (r) =>
    `${withName ? `<td><b>${esc(r.title || '')}</b></td>` : ''}<td>${text(r.teacher)}</td><td>${text(r.child)}</td>${withNote ? `<td>${text(r.note)}</td>` : ''}`;
  const body = rows.length
    ? rows.map((r) => `<tr>${cell(r)}</tr>`).join('')
    : `<tr>${cols.map(() => `<td>${BLANK_LINES}</td>`).join('')}</tr>`;
  const width = { [L.name]: 18, 'Ghi chú': 14 };
  const flex = (100 - (withName ? 18 : 0) - (withNote ? 14 : 0)) / 2;
  return `<table class="grid"><colgroup>${cols.map((c) => `<col style="width:${width[c] || flex}%"/>`).join('')}</colgroup>
<thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
};

/* ---------- Mẫu "Mục tiêu Giao Thông" (Tiền 13/11/2026, EDU-21): file kế hoạch giáo dục chủ đề ---------- */

const DOTS = '…………………………………………………………………………………………………………';
const lines = (list) =>
  list
    .filter(Boolean)
    .map((l) => esc(l))
    .join('<br/>');
const uniq = (list) => [...new Set(list.map((s) => s.trim()).filter(Boolean))];
const tgth = (start, end, weeks) => `TGTH: ${String(weeks).padStart(2, '0')} tuần từ ngày ${ddmm(start)} - ${fmt(end)}`;
const ageOf = (cls) => AGE_GROUPS.find((a) => a.id === cls?.ageGroupId)?.name || cls?.ageGroupName || '';

/** Đầu mỗi phần của file mẫu 1: tên phần, "CHỦ ĐỀ: …", độ tuổi, thời gian thực hiện. */
const themeHead = (title, { theme, cls, weeks }) => `<h1>${title}</h1>
<p class="c"><b>CHỦ ĐỀ: ${esc(theme.name.toUpperCase())}</b></p>
<p class="c">${ageOf(cls) ? `Độ tuổi: ${esc(ageOf(cls))}. ` : ''}${tgth(theme.start, theme.end, weeks.length)}</p>`;

/**
 * Sơ đồ (mạng nội dung / mạng hoạt động) dựng bằng bảng: ô giữa là tên chủ đề, các ô xung quanh; ô trống không kẻ khung để
 * mở bằng Word vẫn sửa được (Tiền 13/11/2026 chọn bảng thay hình vẽ).
 */
const webTable = (center, cells) => {
  const box = (html) => `<td style="width:33%;vertical-align:top">${html}</td>`;
  const blank = '<td style="width:33%;border:none"></td>';
  const mid = `<td class="c" style="width:33%;vertical-align:middle"><b>${esc(center.toUpperCase())}</b></td>`;
  if (cells.length <= 8) {
    // Nhánh đặt quanh ô giữa: trái, phải, trên, dưới rồi bốn góc; bỏ hàng không có ô nào
    const grid = Array(9).fill(blank);
    grid[4] = mid;
    [3, 5, 1, 7, 0, 2, 6, 8].slice(0, cells.length).forEach((pos, k) => (grid[pos] = box(cells[k])));
    const rows = [0, 3, 6]
      .filter((i) => i === 3 || grid.slice(i, i + 3).some((c) => c !== blank))
      .map((i) => `<tr>${grid.slice(i, i + 3).join('')}</tr>`);
    return `<table class="grid web">${rows.join('')}</table>`;
  }
  const rows = [];
  for (let i = 0; i < cells.length; i += 3)
    rows.push(
      `<tr>${cells
        .slice(i, i + 3)
        .map(box)
        .join('')}</tr>`,
    );
  return `<table class="grid web"><tr><td class="c" colspan="3"><b>${esc(center.toUpperCase())}</b></td></tr>${rows.join('')}</table>`;
};

/** Người ký cuối mỗi kế hoạch tuần của mẫu 1: P. Hiệu trưởng · Tổ trưởng CM · Người lập kế hoạch (để trống chỗ ký tay). */
const weekSigners = (doc, leaderName) => {
  const snapshot = doc?.review?.printSnapshot || doc?.printSnapshot;
  const people = signersOf(getEduConfig().signers.week, doc?.approvals, leaderName, snapshot);
  const nameOf = (role) => people.find((p) => p.role === role)?.name || soleSignerName(role) || '';
  const creator = (parseSnapshot(snapshot)?.slots || []).filter((s) => s.roleKey === 'CREATOR').flatMap((s) => s.names || []);
  const cell = (title, name) => `<td class="c"><b>${title}</b><br/><div class="sign"></div>${esc(name)}</td>`;
  return `<table class="plain sign-block"><tr>${cell('P. Hiệu trưởng', nameOf('VICE_PRINCIPAL'))}${cell(
    'Tổ trưởng CM',
    nameOf('TEAM_LEADER') || leaderName || '',
  )}${cell('Người lập kế hoạch', creator.join(', '))}</tr></table>`;
};

/** Bảng "KẾ HOẠCH TUẦN n" của mẫu 1: Thời điểm × Thứ 2–6, dòng cả tuần gộp ô. */
const themeWeekTable = ({ doc, week, branchNo, branchName, theme, leaderName }) => {
  const rows = weekRows()
    .map((r) => {
      const g = rowCell(doc, r);
      if (r.canMerge && g.allWeek) return `<tr><td><b>${esc(r.label)}</b></td><td colspan="5">${text(g.common)}</td></tr>`;
      const cells = g.days.map((v, i) =>
        week.offDays?.[i]
          ? `<td class="c"><i>Nghỉ: ${esc(week.offDays[i])}</i></td>`
          : r.key === 'hoc'
            ? `<td>${v.subject ? `<b>${esc(v.subject)}:</b><br/>` : ''}${text(v.topic)}</td>`
            : `<td>${text(v)}</td>`,
      );
      const extra = r.extraLabel && g.extra?.trim() ? `<tr><td><b>${esc(r.label)}</b></td><td colspan="5">${text(g.extra)}</td></tr>` : '';
      return `<tr><td><b>${esc(r.label)}</b></td>${cells.join('')}</tr>${extra}`;
    })
    .join('');
  return `<div style="page-break-before:always"></div>
<h1>KẾ HOẠCH TUẦN ${week.no}</h1>
<p class="c"><b>Chủ đề: ${esc(theme.name)}${branchName ? ` – Nhánh ${branchNo}: ${esc(branchName)}` : ''}</b></p>
<p class="c">TGTH: 01 tuần từ ngày ${ddmm(week.start)} đến ngày ${fmt(week.end)}</p>
<table class="grid"><colgroup><col style="width:15%"/>${WEEKDAY_LABELS.map(() => '<col style="width:17%"/>').join('')}</colgroup>
<thead><tr><th>Thời điểm</th>${WEEKDAY_LABELS.map((l) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
${weekSigners(doc, leaderName)}`;
};

/**
 * File kế hoạch giáo dục chủ đề theo mẫu "Mục tiêu Giao Thông": MỤC TIÊU (bảng lĩnh vực | mục tiêu, giữ số MT năm) → MẠNG NỘI DUNG
 * (mỗi chủ đề nhánh: nội dung của các MT đã xếp dạy trong tuần của nhánh) → MẠNG HOẠT ĐỘNG (mỗi lĩnh vực: hoạt động của MT thuộc lĩnh
 * vực) → KẾ HOẠCH TUẦN từng tuần đã soạn. Không kèm giáo án ngày (file riêng ở trang Kế hoạch giáo dục ngày).
 */
export const themeFileHtml = ({ themeDoc, theme, cls, weeks, blocks, rowOf, weekDocs, leaderName }) => {
  const doc = themeDoc || { rows: {}, activities: [] };
  const goals = blocks.flatMap((b) => b.goals);
  const domains = [...new Set(blocks.map((b) => b.domain))];
  // MỤC TIÊU: mỗi lĩnh vực một dòng; lĩnh vực con là dòng "* tên:" như file mẫu
  const goalRows = domains
    .map((domain) => {
      const parts = blocks
        .filter((b) => b.domain === domain && b.goals.length)
        .map(
          (b) => `${b.sub ? `<b><i>* ${esc(b.sub)}:</i></b><br/>` : ''}${b.goals.map((g) => `MT${g.no}. ${esc(g.text)}`).join('<br/>')}`,
        );
      return parts.length ? `<tr><td><b>${esc(domainLabel(domain))}</b></td><td>${parts.join('<br/>')}</td></tr>` : '';
    })
    .join('');
  // Bản cũ chỉ có ô chữ hoạt động (FR-006): in nguyên ô chữ; bản có thẻ in "Loại giờ: tên"
  const legacyOnly =
    !Array.isArray(doc.activities) ||
    (doc.activities.every((c) => c.legacy) && Object.values(doc.rows || {}).some((r) => r?.activities?.trim()));
  const acts = legacyOnly ? null : themeActivities(blocks, doc);
  const activitiesOf = (g) =>
    acts ? acts.filter((a) => a.goalIds.includes(String(g.id))).map((a) => a.text) : (rowOf(g).activities || '').split('\n');
  const activityCells = domains.map((domain) => {
    const list = uniq(blocks.filter((b) => b.domain === domain).flatMap((b) => b.goals.flatMap(activitiesOf)));
    return `<b>${esc(domainLabel(domain))}</b><br/>${list.length ? lines(list.map((a) => (/^[-+]/.test(a) ? a : `- ${a}`))) : ''}`;
  });
  // MẠNG NỘI DUNG: nhánh gộp các tuần liền nhau cùng tên; nội dung = nội dung của MT đã xếp dạy trong các tuần đó
  const cards = normalizeTheme(
    doc,
    goals.map((g) => g.id),
  );
  const cov = coverageOf(
    goals,
    cards,
    weekDocs.map((w) => ({ start: w.week.start, offDays: w.week.offDays, doc: w.doc })),
  );
  const branches = [];
  weekDocs.forEach((w) => {
    const last = branches.at(-1);
    if (last && w.branchName && last.name === w.branchName) last.starts.push(w.week.start);
    else branches.push({ no: w.branchNo, name: w.branchName, starts: [w.week.start] });
  });
  const contentCells = branches.map((b) => {
    const taught = cov.rows.filter((r) => b.starts.some((s) => (r.weeks[s] || []).length)).map((r) => r.goal);
    const list = uniq(taught.flatMap((g) => contentLinesOf(rowOf(g).contents)));
    return `<b>${esc(b.name || `Nhánh ${b.no}`)}</b><br/>${lines(list.map((c) => `- ${c}`))}`;
  });
  return docShell(
    `KHGD chủ đề ${theme.name} ${cls.name}`,
    `${themeHead('MỤC TIÊU', { theme, cls, weeks })}
<table class="grid"><colgroup><col style="width:22%"/><col style="width:78%"/></colgroup>
<thead><tr><th>Các lĩnh vực PT</th><th>Mục tiêu</th></tr></thead><tbody>${goalRows}</tbody></table>
<div style="page-break-before:always"></div>
${themeHead('MẠNG NỘI DUNG', { theme, cls, weeks })}
${contentCells.length ? webTable(theme.name, contentCells) : `<p class="c"><i>Chưa có kế hoạch tuần để lập mạng nội dung.</i></p>`}
<div style="page-break-before:always"></div>
${themeHead('MẠNG HOẠT ĐỘNG', { theme, cls, weeks })}
${webTable(theme.name, activityCells)}
${weekDocs.map((w) => themeWeekTable({ ...w, theme, leaderName })).join('')}`,
  );
};

/* ---------- Mẫu "Chủ đề gia đình ký số" (Tiền 13/11/2026, EDU-21): file giáo án ngày cả tuần ---------- */

const DAY_HEADS = {
  hoc: 'I. Hoạt động có chủ định',
  ngoai_troi: 'II. Hoạt động ngoài trời',
  goc: 'III. Hoạt động góc',
  chieu: 'IV. Hoạt động chiều',
};
const PART_LABELS = {
  hoc: ['1. Mục đích - yêu cầu', '2. Chuẩn bị', '3. Tiến hành'],
  ngoai_troi: ['1. Mục đích', '2. Chuẩn bị', '3. Hướng dẫn'],
  goc: ['1. Mục đích', '2. Chuẩn bị', '3. Hướng dẫn'],
  chieu: ['1. Mục đích', '2. Chuẩn bị', '3. Hướng dẫn'],
};

/** Ô dòng "cả tuần" của kế hoạch tuần thành chữ (Đón trẻ, Thể dục sáng): chung cả tuần, hoặc từng thứ có nội dung. */
const weekRowText = (doc, key) => {
  const row = weekRows().find((r) => r.key === key);
  if (!row) return '';
  const g = rowCell(doc, row);
  if (g.allWeek) return text(g.common);
  return g.days
    .map((v, i) => (String(v || '').trim() ? `<b>${WEEKDAY_LABELS[i]}:</b> ${text(v)}` : ''))
    .filter(Boolean)
    .join('<br/>');
};

const filledCorners = (doc) => (doc.corners || []).filter((c) => ['name', 'content', 'aims', 'prep', 'steps'].some((f) => c[f]?.trim()));

export const dayPlansFileHtml = ({ doc, week, branchNo, branchName, cls, leaderName, theme }) => {
  const prep = normalizeWeek(doc).prep;
  const corners = filledCorners(doc);
  const cornerHtml = corners.length
    ? `<table class="grid"><colgroup><col style="width:14%"/><col style="width:20%"/><col style="width:24%"/><col style="width:18%"/><col style="width:24%"/></colgroup>
<thead><tr><th>HĐ</th><th>Nội dung</th><th>Mục đích - yêu cầu</th><th>Chuẩn bị</th><th>Cách tiến hành</th></tr></thead><tbody>${corners
        .map(
          (c, i) =>
            `<tr><td><b>${i + 1}. ${esc(c.name || '')}</b></td><td>${text(c.content)}</td><td>${text(c.aims)}</td><td>${text(c.prep)}</td><td>${text(c.steps)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : `<p>${DOTS}</p>`;
  const morning = [weekRowText(doc, 'don'), weekRowText(doc, 'tro_chuyen')].filter(Boolean).join('<br/>');
  const days = doc.days
    .map((raw, i) => {
      const d = normalizeDay(raw);
      const head = `<p class="c" style="page-break-before:always"><b>${esc(longDay(d.date, i))}</b></p>`;
      if (week.offDays?.[i]) return `${head}<p class="c"><i>Nghỉ: ${esc(week.offDays[i])}</i></p>`;
      const fromWeek = dayDraftFromWeek(doc, i);
      const subject = doc.grid?.hoc?.days?.[i]?.subject || '';
      const sections = DAY_SECTIONS.map((s) => {
        const sec = d.sections[s.key];
        const off = partsOff(sec);
        const fw = fromWeek[s.key] || {};
        const [aimsLabel, prepLabel, stepsLabel] = PART_LABELS[s.key];
        const title =
          s.key === 'hoc'
            ? `${DAY_HEADS.hoc}${subject ? `: ${esc(subject)}` : ''}${fw.main ? `<br/>* Hoạt động chính: ${esc(fw.main)}` : ''}${
                fw.combined ? `<br/>* Hoạt động kết hợp: ${esc(fw.combined)}` : ''
              }`
            : `${DAY_HEADS[s.key]}${fw.name ? `: ${esc(uniq(fw.name.split(/;\s*/)).join('; '))}` : ''}`;
        return `<h3>${title}</h3>
${off.includes('aims') ? '' : `<p><b>${aimsLabel}</b><br/>${text(sec.aims) || DOTS}</p>`}
${off.includes('prep') ? '' : `<p><b>${prepLabel}</b><br/>${text(sec.prep) || DOTS}</p>`}
${off.includes('rows') ? '' : `<p><b>${stepsLabel}</b></p>${stepTable(sec.rows, { name: 'NDHĐ', teacher: 'HĐ của cô', child: 'HĐ của trẻ' })}`}`;
      }).join('');
      const review = DAY_REVIEW.map((r) => `<p>${esc(r.label.replace(/^\d+\.\s*/, ''))}:<br/>${text(d.review?.[r.key]) || DOTS}</p>`).join(
        '',
      );
      return `${head}${sections}<h3>V. Đánh giá trẻ trên ngày</h3>${review}<p class="c">*****************************************</p>`;
    })
    .join('');
  return docShell(
    `Kế hoạch giáo dục ngày tuần ${week.no} ${cls.name}`,
    `<p class="c"><b>Chủ đề: ${esc(theme?.name || week.theme?.name || '')}${branchName ? ` – Nhánh ${branchNo}: ${esc(branchName)}` : ''}</b></p>
<p class="c">TGTH 1 tuần từ ngày ${ddmm(week.start)} đến ngày ${fmt(week.end)}</p>
<h2>I. Chuẩn bị:</h2>${PREP_TARGETS.map((t) => `<p><b>${esc(t.label)}.</b><br/>${text(prep[t.key]) || DOTS}</p>`).join('')}
<h2>II. Tiến hành:</h2>
<p><b>1. Đón trẻ - trò chuyện sáng:</b><br/>${morning || DOTS}</p>
<p><b>2. Thể dục sáng:</b><br/>${weekRowText(doc, 'the_duc') || DOTS}</p>
<p><b>3. Hoạt động góc:</b></p>${cornerHtml}
${days}
${approvalBox(doc, week, leaderName)}`,
  );
};

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
export const weekFile = (args) => ({ html: weekFileHtml(args), name: fileTitle(`Kế hoạch tuần ${args.week.no} - ${args.cls.name}`) });
export const dayPlansFile = (args) => ({
  html: dayPlansFileHtml(args),
  name: fileTitle(`Kế hoạch giáo dục ngày tuần ${args.week.no} - ${args.cls.name}`),
});

// Tên file theo bộ file mẫu của trường: "2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH…", "3. KHGD CĐ n …"
export const exportBranchFile = (args, mode) =>
  output(branchFileHtml(args), `2. DỰ KIẾN CÁC CHỦ ĐỀ NHÁNH VÀ THỜI GIAN THỰC HIỆN - ${args.cls.name}`, mode);

export const exportThemeFile = (args, mode) =>
  output(themeFileHtml(args), `3. KHGD CĐ ${args.themeNo} ${args.theme.name} - ${args.cls.name}`, mode);

export const exportWeekPlan = (args, mode) => output(weekFileHtml(args), `Kế hoạch tuần ${args.week.no} - ${args.cls.name}`, mode);
