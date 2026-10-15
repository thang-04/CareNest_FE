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
  week: 'Giáo án tuần (hồ sơ chủ đề)',
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
/** "Thứ hai, ngày 07 tháng 9 năm 2026" như đầu kế hoạch ngày của trường. */
const WEEKDAY_LONG = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu'];
export const longDay = (iso, i) => `${WEEKDAY_LONG[i]}, ngày ${iso.slice(8, 10)} tháng ${Number(iso.slice(5, 7))} năm ${iso.slice(0, 4)}`;

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

/** Các tuần học (chủ đề nhánh) của một chủ đề theo thứ tự. */
export const themeWeeksOf = (plan, themeId) => yearWeeks(plan).filter((w) => w.type === 'week' && w.theme.id === themeId);

/** Tuần học đầu tiên của chủ đề. */
export const firstWeekOfTheme = (plan, themeId) => themeWeeksOf(plan, themeId)[0] || null;

/** Giáo án các tuần của hồ sơ chủ đề (tuần chưa soạn là null). */
export const dossierWeekDocs = (themeDoc, plan, weekPlans = []) =>
  themeWeeksOf(plan, themeDoc.themeId).map((w) => ({
    week: w,
    doc: weekPlans.find((x) => x.classId === themeDoc.classId && x.yearPlanId === themeDoc.yearPlanId && x.weekStart === w.start) || null,
  }));

/*
 * Hồ sơ chủ đề theo file MN Thái Dương: giáo viên soạn kế hoạch chủ đề + giáo án tất cả các nhánh rồi gửi MỘT lần.
 * Mỗi tuần được duyệt riêng (ký khung "Duyệt giáo án từ ngày … đến ngày …"); kế hoạch chủ đề đi cùng khung tuần 1.
 * Tuần bị trả lại thì giáo viên sửa và gửi lại riêng tuần đó. Chủ đề nhánh (cả năm) phải được duyệt trước.
 * Dùng chung cho màn hình (UX) và mock service (BE thật phải tự kiểm).
 */
export function submitBlocker(kind, doc, { branchPlans = [], weekPlans = [], classThemePlans = [], yearPlan }) {
  if (!doc || kind === CLASS_DOC.BRANCH) return null;
  const branch = branchPlans.find((b) => b.classId === doc.classId && b.yearPlanId === doc.yearPlanId);
  if (branch?.status !== 'APPROVED') return 'Dự kiến chủ đề nhánh của lớp chưa được duyệt, nên chưa gửi được.';
  if (kind === CLASS_DOC.WEEK) {
    const theme = classThemePlans.find((t) => t.classId === doc.classId && t.yearPlanId === doc.yearPlanId && t.themeId === doc.themeId);
    if (!theme || theme.status === 'DRAFT') return 'Giáo án tuần gửi lần đầu trong hồ sơ chủ đề (kế hoạch chủ đề + giáo án các nhánh).';
    return null;
  }
  const missing = dossierWeekDocs(doc, yearPlan, weekPlans)
    .map((x, i) => (x.doc ? null : `nhánh ${i + 1}`))
    .filter(Boolean);
  if (missing.length) return `Còn thiếu giáo án ${missing.join(', ')}. Soạn và lưu đủ giáo án các nhánh rồi mới gửi hồ sơ chủ đề.`;
  return null;
}

/**
 * Trình tự lập kế hoạch lớp: chủ đề nhánh cả năm được duyệt → kế hoạch chủ đề → giáo án các tuần nhánh của chủ đề đó.
 * Chỉ chặn tạo mới; các nhánh trong một chủ đề soạn song song. Trả { need: 'branch' | 'theme', message } hoặc null.
 */
export function createBlocker(kind, { classId, yearPlanId, themeId }, { branchPlans = [], classThemePlans = [] }) {
  if (kind === CLASS_DOC.BRANCH) return null;
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlanId);
  if (branch?.status !== 'APPROVED') return { need: 'branch', message: 'Dự kiến chủ đề nhánh của lớp cần được duyệt trước.' };
  const theme = classThemePlans.some((t) => t.classId === classId && t.yearPlanId === yearPlanId && t.themeId === themeId);
  if (kind === CLASS_DOC.WEEK && !theme) return { need: 'theme', message: 'Cần lưu kế hoạch giáo dục chủ đề trước.' };
  return null;
}

/**
 * Tình trạng cả hồ sơ chủ đề để hiển thị: chưa gửi / số tuần đã duyệt, đang chờ, bị trả lại.
 * weeks: [{ doc }] theo dossierWeekDocs.
 */
export const dossierSummary = (themeDoc, weeks) => {
  const docs = weeks.map((w) => w.doc).filter(Boolean);
  const count = (st) => docs.filter((d) => d.status === st).length;
  return {
    sent: !!themeDoc && themeDoc.status !== 'DRAFT',
    total: weeks.length,
    approved: count('APPROVED'),
    rejected: count('REJECTED'),
    pending: docs.filter((d) => String(d.status).startsWith('PENDING')).length,
  };
};

/**
 * Nhắc hạn gửi (chỉ nhắc, không chặn): hồ sơ chủ đề trước ngày bắt đầu chủ đề.
 * Trả null khi đã gửi / đã duyệt hoặc còn xa hạn.
 */
export function dueState(doc, dueIso, today = todayIso()) {
  if (doc && !isEditableStatus(doc.status)) return null;
  if (today >= dueIso) return 'late';
  return today >= addDays(dueIso, -7) ? 'soon' : null;
}

/** Số thứ tự chủ đề trong năm ("Chủ đề 1") theo ngày bắt đầu. */
export const themeNumber = (plan, themeId) =>
  [...(plan?.themes || [])]
    .filter((t) => t.start && t.end)
    .sort((a, b) => a.start.localeCompare(b.start))
    .findIndex((t) => t.id === themeId) + 1;

/** Số thứ tự chủ đề nhánh trong chủ đề ("Chủ đề nhánh 1") của một tuần. */
export const branchNumber = (plan, weekStart) => {
  const weeks = yearWeeks(plan).filter((w) => w.type === 'week');
  const week = weeks.find((w) => w.start === weekStart);
  return week ? weeks.filter((w) => w.theme.id === week.theme.id).findIndex((w) => w.start === weekStart) + 1 : 0;
};

/*
 * Gợi ý hoạt động cho kế hoạch tuần lấy từ cột "Hoạt động giáo dục" của kế hoạch chủ đề: mỗi dòng (gạch đầu dòng) là
 * một hoạt động gắn MT; loại giờ đọc từ phần đầu dòng ("Trò chuyện: …", "Chơi, HĐ ngoài trời: …"). Dòng không rõ loại giờ
 * thì gợi ý ở mọi dòng của kế hoạch tuần.
 */
const SLOT_WORDS = [
  ['don', /đón trẻ/i],
  ['tro_chuyen', /trò chuyện/i],
  ['the_duc', /thể dục sáng|\btds\b/i],
  ['hoc', /hđ học|hoạt động học|giờ học|\bhđh\b/i],
  ['ngoai_troi', /ngoài trời/i],
  ['goc', /góc/i],
  ['chieu', /chiều|theo ý thích/i],
  ['tra_tre', /trả trẻ|nêu gương/i],
];

/** Tách các hoạt động của kế hoạch chủ đề: [{ id, goalId, goalNo, slots, text }]. rowOf(goal) → { activities }. */
export function themeActivities(blocks, rowOf) {
  return blocks
    .flatMap((b) => b.goals)
    .flatMap((g) =>
      String(rowOf(g)?.activities || '')
        .split('\n')
        .map((line) => line.replace(/^[\s\-–•+*]+/, '').trim())
        .filter(Boolean)
        .map((text, i) => {
          const head = text.includes(':') ? text.slice(0, text.indexOf(':')) : text;
          return {
            id: `${g.id}#${i}`,
            goalId: g.id,
            goalNo: g.no,
            slots: SLOT_WORDS.filter(([, re]) => re.test(head)).map(([k]) => k),
            text,
          };
        }),
    );
}

/** Gợi ý cho một dòng của kế hoạch tuần: hoạt động đúng loại giờ trước, hoạt động chưa rõ loại giờ sau. */
export const activitiesForRow = (activities, rowKey) => [
  ...activities.filter((a) => a.slots.includes(rowKey)),
  ...activities.filter((a) => !a.slots.length),
];

/** Khóa ô của kế hoạch tuần để nhớ hoạt động đã chọn: dòng + ngày (0–4) hoặc "all" khi gộp cả tuần. */
export const cellKey = (rowKey, day) => `${rowKey}.${day}`;

/** MT dạy trong từng ngày (0–4) từ các hoạt động đã chọn; ô gộp cả tuần tính cho mọi ngày. */
export const dayGoalsOf = (doc) =>
  [0, 1, 2, 3, 4].map((i) => {
    const ids = Object.entries(doc.picks || {})
      .filter(([k]) => {
        const [key, day] = k.split('.');
        const r = weekRows().find((x) => x.key === key);
        // Dòng đang gộp cả tuần thì dùng hoạt động của ô gộp, ngược lại dùng ô của từng ngày
        const merged = !!r?.canMerge && rowCell(doc, r).allWeek;
        return merged ? day === 'all' : day === String(i);
      })
      .flatMap(([, list]) => list.map((p) => p.goalId));
    return [...new Set(ids)];
  });
