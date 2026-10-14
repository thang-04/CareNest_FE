/*
 * Tài liệu kế hoạch của lớp theo mẫu MN Thái Dương, dựa trên kế hoạch năm (mục tiêu năm) đã ban hành của khối:
 * dự kiến chủ đề nhánh từng tuần, kế hoạch chủ đề, kế hoạch tuần + 5 kế hoạch ngày (duyệt cả tuần một lần).
 */
import { DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { getEduConfig } from '@/models/education-plan/eduConfig';

/** Loại tài liệu của lớp (khóa collection trong service). */
export const CLASS_DOC = { BRANCH: 'branch', THEME: 'theme', WEEK: 'week' };

export const CLASS_DOC_LABELS = {
  year: 'Kế hoạch năm học',
  branch: 'Chủ đề nhánh và thời gian',
  theme: 'Kế hoạch chủ đề',
  week: 'Giáo án tuần',
};

/** Các dòng của bảng tổ chức hoạt động trong tuần theo cấu hình của trường; canMerge = được gộp một ô cả tuần, allWeek = mặc định gộp. */
export const weekRows = () => getEduConfig().weekRows;

/** Các phần của bảng tiến trình kế hoạch ngày (Hoạt động của cô | Hoạt động của trẻ | Ghi chú). */
export const DAY_SECTIONS = [
  {
    key: 'hoc',
    label: '1. Hoạt động học',
    parts: [
      { key: 'a', label: 'a) Ổn định tổ chức, gây hứng thú' },
      { key: 'b', label: 'b) Nội dung trọng tâm' },
      { key: 'c', label: 'c) Kết thúc' },
    ],
  },
  { key: 'ngoai_troi', label: '2. Chơi, hoạt động ngoài trời', parts: [{ key: 'x', label: '' }] },
  { key: 'chieu', label: '3. Chơi, hoạt động theo ý thích buổi chiều', parts: [{ key: 'x', label: '' }] },
];

export const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

/* ---------- Ngày tháng (yyyy-mm-dd, tính theo UTC để không lệch múi giờ) ---------- */

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
export const addDays = (iso, n) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const mondayOf = (iso) => {
  const day = toDate(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
};
export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
export const monthOf = (iso) => Number(iso.slice(5, 7));
export const todayIso = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
/** "Thứ 2, ngày 07 tháng 9 năm 2026". */
export const longDay = (iso, i) => `${WEEKDAY_LABELS[i]}, ngày ${iso.slice(8, 10)} tháng ${Number(iso.slice(5, 7))} năm ${iso.slice(0, 4)}`;

/* ---------- Đọc kế hoạch năm (dạng hàng của bảng mục tiêu) ---------- */

/**
 * Lịch tuần cả năm: tuần học đánh số liên tục 1..n theo các chủ đề, xen dòng đợt nghỉ đúng vị trí.
 * Mỗi phần tử: { type: 'week', no, start, end, theme } | { type: 'break', start, end, label, theme }.
 */
export const yearWeeks = (plan) => {
  if (!plan) return [];
  const breaks = plan.breaks || [];
  const themes = [...(plan.themes || [])].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const rows = [];
  let no = 0;
  themes.forEach((t) => {
    for (let m = mondayOf(t.start); m <= t.end; m = addDays(m, 7)) {
      const br = breaks.find((b) => b.start && m <= (b.end || b.start) && addDays(m, 4) >= b.start);
      if (br) {
        if (!rows.some((r) => r.type === 'break' && r.start === br.start))
          rows.push({ type: 'break', start: br.start, end: br.end, label: br.label, theme: t });
      } else rows.push({ type: 'week', no: (no += 1), start: m, end: addDays(m, 4), theme: t });
    }
  });
  return rows;
};

/**
 * Mục tiêu của một chủ đề, nhóm theo lĩnh vực và lĩnh vực con như bảng mục tiêu năm:
 * [{ domain, sub, goals: [{ id, no, text, contents: [text] }] }]; chỉ mục tiêu có nội dung được tích vào chủ đề.
 */
export const themeGoalBlocks = (domains, numbers, themeId) => {
  const blocks = [];
  DOMAINS.map((name) => domains.find((d) => d.name === name))
    .filter(Boolean)
    .forEach((d) => {
      let sub = null;
      d.rows.forEach((r) => {
        if (r.kind === 'sub') sub = r.text;
        if (r.kind !== 'goal' || !numbers[r.id]) return;
        const contents = r.contents.filter((c) => c.text.trim() && c.themes.includes(themeId)).map((c) => c.text);
        if (!contents.length) return;
        let block = blocks.at(-1);
        if (!block || block.domain !== d.name || block.sub !== sub) blocks.push((block = { domain: d.name, sub, goals: [] }));
        block.goals.push({ id: r.id, no: numbers[r.id], text: r.text, contents });
      });
    });
  return blocks;
};

/* ---------- Bản ghi rỗng ---------- */

export const emptyBranchPlan = ({ classId, yearPlanId }) => ({
  id: `bp_${classId}_${yearPlanId}`,
  kind: CLASS_DOC.BRANCH,
  classId,
  yearPlanId,
  names: {},
  notes: {},
  status: 'DRAFT',
  builders: [],
  approvals: [],
  history: [],
});

export const emptyThemePlan = ({ classId, yearPlanId, themeId }) => ({
  id: `tp_${classId}_${themeId}`,
  kind: CLASS_DOC.THEME,
  classId,
  yearPlanId,
  themeId,
  rows: {},
  envIn: '',
  envOut: '',
  status: 'DRAFT',
  builders: [],
  approvals: [],
  history: [],
});

const emptyGrid = () =>
  Object.fromEntries(
    weekRows().map((r) => [
      r.key,
      {
        allWeek: r.allWeek,
        common: '',
        days: r.key === 'hoc' ? [0, 1, 2, 3, 4].map(() => ({ subject: '', topic: '' })) : ['', '', '', '', ''],
      },
    ]),
  );

const emptyDay = (date) => ({
  date,
  aims: '',
  prep: '',
  steps: Object.fromEntries(DAY_SECTIONS.flatMap((s) => s.parts.map((p) => [`${s.key}.${p.key}`, { teacher: '', child: '', note: '' }]))),
  evaluation: '',
  adjustment: '',
});

/** Ô của một dòng trong bảng tuần; dòng thêm vào cấu hình sau khi soạn giáo án thì trả ô trống. */
export const rowCell = (doc, r) =>
  doc.grid[r.key] || {
    allWeek: r.allWeek,
    common: '',
    days: r.key === 'hoc' ? [0, 1, 2, 3, 4].map(() => ({ subject: '', topic: '' })) : ['', '', '', '', ''],
  };

/** Giáo án tuần rỗng: kế hoạch tuần + 5 kế hoạch ngày Thứ 2–6. */
export const emptyWeekPlan = ({ classId, yearPlanId, weekStart, weekNo, themeId }) => ({
  id: `wp_${classId}_${weekStart}`,
  kind: CLASS_DOC.WEEK,
  classId,
  yearPlanId,
  weekStart,
  weekNo,
  themeId,
  aims: { knowledge: '', skills: '', attitude: '' },
  prep: '',
  grid: emptyGrid(),
  days: [0, 1, 2, 3, 4].map((i) => emptyDay(addDays(weekStart, i))),
  status: 'DRAFT',
  builders: [],
  approvals: [],
  history: [],
});

/** Còn sửa được nội dung (đánh giá cuối ngày vẫn ghi được sau khi duyệt). */
export const isEditableStatus = (status) => !status || status === 'DRAFT' || status === 'REJECTED';
