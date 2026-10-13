/*
 * Kế hoạch giáo dục theo mẫu Trường MN Thái Dương (nguồn chính từ 13/10/2026):
 * kế hoạch năm theo khối (mục tiêu đánh số 1..n, nội dung tích vào chủ đề), rồi theo lớp:
 * chủ đề nhánh từng tuần, kế hoạch chủ đề, kế hoạch tuần + 5 kế hoạch ngày (duyệt theo tuần).
 */

/** Loại tài liệu (khóa collection trong service). */
export const PLAN_KIND = { YEAR: 'year', BRANCH: 'branch', THEME: 'theme', WEEK: 'week' };

export const PLAN_KIND_LABELS = {
  year: 'Kế hoạch năm học',
  branch: 'Chủ đề nhánh và thời gian',
  theme: 'Kế hoạch chủ đề',
  week: 'Giáo án tuần',
};

/** 5 lĩnh vực cố định của Chương trình GDMN, tên theo mẫu kế hoạch năm của trường. */
export const YEAR_DOMAINS = [
  { key: 'TC', roman: 'I', name: 'Giáo dục phát triển thể chất' },
  { key: 'NT', roman: 'II', name: 'Giáo dục phát triển nhận thức' },
  { key: 'NN', roman: 'III', name: 'Giáo dục phát triển ngôn ngữ' },
  { key: 'TX', roman: 'IV', name: 'Giáo dục phát triển tình cảm và kĩ năng xã hội' },
  { key: 'TM', roman: 'V', name: 'Giáo dục phát triển thẩm mĩ' },
];

/** Dòng tiêu đề trong bảng mục tiêu: lĩnh vực con (*) và nhóm kết quả mong đợi (-). */
export const ROW_TYPE_LABELS = { sub: 'Lĩnh vực con', group: 'Nhóm kết quả mong đợi', goal: 'Mục tiêu' };

/** 8 dòng cố định của bảng tổ chức hoạt động trong tuần; allWeek = mặc định gộp ô cả tuần. */
export const WEEK_ROWS = [
  { key: 'don', label: 'Đón trẻ', allWeek: true },
  { key: 'tro_chuyen', label: 'Trò chuyện', allWeek: true },
  { key: 'the_duc', label: 'Thể dục sáng', allWeek: true },
  { key: 'hoc', label: 'Hoạt động học', allWeek: false },
  { key: 'ngoai_troi', label: 'Chơi, hoạt động ngoài trời', allWeek: false },
  { key: 'goc', label: 'Chơi, hoạt động ở các góc', allWeek: true },
  { key: 'chieu', label: 'Chơi, hoạt động buổi chiều', allWeek: false },
  { key: 'tra_tre', label: 'Trả trẻ', allWeek: true },
];

/** 3 dòng tiến trình của kế hoạch ngày. */
export const DAY_STEPS = [
  { key: 'hoc', label: '1. Hoạt động học', hint: 'a) Ổn định tổ chức, gây hứng thú · b) Nội dung trọng tâm · c) Kết thúc' },
  { key: 'ngoai_troi', label: '2. Chơi, hoạt động ngoài trời', hint: 'Hoạt động có chủ đích · TCVĐ · Chơi tự do' },
  { key: 'chieu', label: '3. Chơi, hoạt động theo ý thích buổi chiều', hint: '' },
];

export const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

/* ---------- Ngày tháng (chuỗi yyyy-mm-dd, tính theo UTC để không lệch múi giờ) ---------- */

const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
const toIso = (d) => d.toISOString().slice(0, 10);

export const addDays = (iso, n) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};

/** Thứ Hai của tuần chứa ngày iso. */
export const mondayOf = (iso) => {
  const day = toDate(iso).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
};

export const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

export const todayIso = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ---------- Kế hoạch năm ---------- */

/** Mọi mục tiêu theo thứ tự, kèm số MT (đánh liên tục cả năm như mẫu của trường) và lĩnh vực. */
export const numberedGoals = (plan) => {
  let no = 0;
  return (plan?.domains || []).flatMap((d) =>
    d.rows.filter((r) => r.type === 'goal').map((g) => ({ ...g, no: (no += 1), domainId: d.id, domain: d })),
  );
};

/** Số MT theo id mục tiêu. */
export const goalNumberMap = (plan) => Object.fromEntries(numberedGoals(plan).map((g) => [g.id, g.no]));

/** Mục tiêu của một chủ đề = các mục tiêu có ít nhất 1 nội dung được tích vào chủ đề đó. */
export const themeGoals = (plan, themeId) =>
  numberedGoals(plan)
    .map((g) => ({ ...g, contents: g.contents.filter((c) => c.themes.includes(themeId)) }))
    .filter((g) => g.contents.length > 0);

/** "1, 2, 4… (29 MT)" như cột Mục tiêu giáo dục ở phần B. */
export const themeGoalLabel = (plan, themeId) => {
  const nos = themeGoals(plan, themeId).map((g) => g.no);
  return nos.length ? `${nos.join(', ')} (${nos.length} MT)` : 'Chưa có mục tiêu nào được tích';
};

const inBreak = (plan, monday) => (plan?.breaks || []).some((b) => monday <= b.end && addDays(monday, 4) >= b.start);

/** Tuần học của một chủ đề (thứ Hai), bỏ tuần nghỉ. */
export const themeWeeks = (plan, theme) => {
  const weeks = [];
  if (!theme?.startDate || !theme?.endDate) return weeks;
  for (let m = mondayOf(theme.startDate); m <= theme.endDate; m = addDays(m, 7)) {
    if (!inBreak(plan, m)) weeks.push(m);
  }
  return weeks;
};

/**
 * Lịch tuần cả năm: tuần học đánh số liên tục 1..n, xen dòng nghỉ (Tết, ôn tập…) đúng vị trí.
 * Mỗi phần tử: { type: 'week', no, start, end, theme } | { type: 'break', start, end, label }.
 */
export const yearWeeks = (plan) => {
  if (!plan) return [];
  const themes = [...(plan.themes || [])].filter((t) => t.startDate && t.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const rows = [];
  let no = 0;
  themes.forEach((t) => {
    for (let m = mondayOf(t.startDate); m <= t.endDate; m = addDays(m, 7)) {
      const br = (plan.breaks || []).find((b) => m <= b.end && addDays(m, 4) >= b.start);
      if (br) {
        if (!rows.some((r) => r.type === 'break' && r.start === br.start)) rows.push({ type: 'break', ...br, theme: t });
      } else rows.push({ type: 'week', no: (no += 1), start: m, end: addDays(m, 4), theme: t });
    }
  });
  return rows;
};

/** Ngày bắt đầu của một chủ đề → số tuần học. */
export const themeWeekCount = (plan, theme) => themeWeeks(plan, theme).length;

/** Tháng (số) của một ngày iso, dùng cho cột Tháng của bảng chủ đề nhánh. */
export const monthOf = (iso) => Number(iso.slice(5, 7));

/* ---------- Tạo bản ghi rỗng ---------- */

let seq = 0;
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${(seq += 1).toString(36)}`;

export const emptyDomains = (prefix) =>
  YEAR_DOMAINS.map((d) => ({ id: `${prefix}-${d.key}`, key: d.key, roman: d.roman, name: d.name, rows: [] }));

export const emptyGrid = () =>
  Object.fromEntries(WEEK_ROWS.map((r) => [r.key, { allWeek: r.allWeek, days: ['', '', '', '', ''], common: '' }]));

export const emptyDay = (date) => ({
  date,
  assigneeId: null,
  aims: '',
  prep: '',
  steps: Object.fromEntries(DAY_STEPS.map((s) => [s.key, { title: '', teacher: '', child: '', note: '' }])),
  evaluation: '',
  adjustment: '',
});

/** Giáo án tuần rỗng: kế hoạch tuần + 5 kế hoạch ngày Thứ 2–6. */
export const emptyWeekPlan = ({ classId, yearPlanId, weekStart, weekNo, themeId, branchName }) => ({
  id: `wp_${classId}_${weekStart}`,
  classId,
  yearPlanId,
  weekStart,
  weekNo,
  themeId,
  branchName,
  aims: { knowledge: '', skills: '', attitude: '' },
  prep: '',
  grid: emptyGrid(),
  days: [0, 1, 2, 3, 4].map((i) => emptyDay(addDays(weekStart, i))),
  status: 'DRAFT',
  history: [],
});

export const emptyThemePlan = ({ classId, yearPlanId, themeId }) => ({
  id: `tp_${classId}_${themeId}`,
  classId,
  yearPlanId,
  themeId,
  rows: {},
  envIn: '',
  envOut: '',
  status: 'DRAFT',
  history: [],
});

export const emptyBranchPlan = ({ classId, yearPlanId }) => ({
  id: `bp_${classId}_${yearPlanId}`,
  classId,
  yearPlanId,
  names: {},
  status: 'DRAFT',
  history: [],
});

/** Trạng thái còn sửa được nội dung (đánh giá cuối ngày vẫn ghi được sau khi duyệt). */
export const isEditableStatus = (status) => status === 'DRAFT' || status === 'REJECTED';

/**
 * Bản sao kế hoạch năm với id mới (dùng cho "Lập từ kế hoạch có sẵn").
 * shiftDays dời ngày chủ đề và ngày nghỉ (364 = sang năm học sau, giữ nguyên thứ).
 */
export const copyYearPlan = (src, { id, schoolYear, ageGroupId, shiftDays = 0 }) => {
  const themeIds = Object.fromEntries((src.themes || []).map((t, i) => [t.id, `${id}-t${i + 1}`]));
  const shift = (iso) => (iso ? addDays(iso, shiftDays) : iso);
  let rowSeq = 0;
  return {
    id,
    schoolYear,
    ageGroupId,
    status: 'DRAFT',
    domains: src.domains.map((d) => ({
      ...d,
      id: `${id}-${d.key}`,
      rows: d.rows.map((r) => {
        const rid = `${id}-r${(rowSeq += 1)}`;
        if (r.type !== 'goal') return { ...r, id: rid };
        return {
          ...r,
          id: rid,
          contents: r.contents.map((c, k) => ({ ...c, id: `${rid}-c${k + 1}`, themes: c.themes.map((t) => themeIds[t]).filter(Boolean) })),
        };
      }),
    })),
    themes: (src.themes || []).map((t) => ({ ...t, id: themeIds[t.id], startDate: shift(t.startDate), endDate: shift(t.endDate) })),
    breaks: (src.breaks || []).map((b) => ({ ...b, start: shift(b.start), end: shift(b.end) })),
    domainOwners: {},
    builders: [],
    issued: null,
    history: [],
  };
};

export const emptyYearPlan = ({ id, schoolYear, ageGroupId }) => ({
  id,
  schoolYear,
  ageGroupId,
  status: 'DRAFT',
  domains: emptyDomains(id),
  themes: [],
  breaks: [],
  domainOwners: {},
  builders: [],
  issued: null,
  history: [],
});
