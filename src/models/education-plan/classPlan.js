/*
 * Tài liệu kế hoạch của lớp theo mẫu MN Thái Dương, dựa trên kế hoạch năm (mục tiêu năm) đã ban hành của khối:
 * dự kiến chủ đề nhánh từng tuần, kế hoạch chủ đề, kế hoạch tuần + 5 kế hoạch ngày (duyệt cả tuần một lần).
 */
import { DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { getEduConfig } from '@/models/education-plan/eduConfig';
import { weekBreaks } from '@/models/education-plan/goalTable';

/** Loại tài liệu của lớp (khóa collection trong service). */
export const CLASS_DOC = { BRANCH: 'branch', THEME: 'theme', WEEK: 'week' };

export const CLASS_DOC_LABELS = {
  year: 'Kế hoạch giáo dục tổ',
  branch: 'Chủ đề nhánh và thời gian',
  theme: 'Kế hoạch chủ đề',
  week: 'Kế hoạch tuần',
};

/** Các dòng của bảng tổ chức hoạt động trong tuần theo cấu hình của trường; canMerge = được gộp một ô cả tuần, allWeek = mặc định gộp. */
export const weekRows = () => getEduConfig().weekRows;

/** 4 mục cố định của giáo án ngày (spec 005 FR-001); row = dòng bảng tuần cấp tên hoạt động và MT. */
export const DAY_SECTIONS = [
  { key: 'hoc', row: 'hoc', label: '1. Hoạt động học' },
  { key: 'ngoai_troi', row: 'ngoai_troi', label: '2. Hoạt động ngoài trời' },
  { key: 'goc', row: 'goc', label: '3. Hoạt động góc' },
  { key: 'chieu', row: 'chieu', label: '4. Hoạt động chiều' },
];

/** Dòng gợi ý của Tiến hành ở mục Hoạt động học: không đánh chữ, xóa/đổi tên được (FR-004). */
export const HOC_SUGGESTED_ROWS = ['Ổn định tổ chức, gây hứng thú', 'Nội dung trọng tâm', 'Kết thúc'];
/** Dòng gợi ý của mục ngoài trời theo file "Chủ đề gia đình": ba phần của một buổi ngoài trời; xóa/đổi tên được. */
export const NGOAI_TROI_SUGGESTED_ROWS = ['Hoạt động có mục đích', 'Trò chơi vận động', 'Chơi theo ý thích'];
const SUGGESTED_ROWS = { hoc: HOC_SUGGESTED_ROWS, ngoai_troi: NGOAI_TROI_SUGGESTED_ROWS };

/** Phần II của giáo án ngày, nhận xét chung cả lớp (FR-008). */
export const DAY_REVIEW = [
  { key: 'health', label: '1. Tình trạng sức khỏe của trẻ' },
  { key: 'knowledge', label: '2. Kiến thức, kỹ năng, nhận thức của trẻ' },
  { key: 'attitude', label: '3. Thái độ, cảm xúc, hành vi của trẻ' },
];

export const PREP_TARGETS = [
  { key: 'teacher', label: '1. Đối với cô' },
  { key: 'child', label: '2. Đối với trẻ' },
  { key: 'parent', label: '3. Đối với phụ huynh' },
];

/** Giới hạn ô văn bản giáo án (spec 005: 4000 ký tự/ô, tên góc 200). */
export const TEXT_MAX = 4000;
export const NAME_MAX = 200;

export const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

/**
 * Ngày nghỉ trong tuần thành một dòng; các ngày liền nhau cùng lý do gộp lại (Tiền 05/11):
 * ['GPMN', 'GPMN', null, null, 'X'] → "Thứ 2, 3 (GPMN), Thứ 6 (X)".
 */
export const offDaysText = (offDays = []) => {
  const groups = [];
  offDays.forEach((label, i) => {
    if (!label) return;
    const last = groups[groups.length - 1];
    if (last && last.label === label && last.end === i - 1) last.end = i;
    else groups.push({ label, start: i, end: i });
  });
  return groups
    .map((g) => {
      const days = [];
      for (let i = g.start; i <= g.end; i++) days.push(i === g.start ? WEEKDAY_LABELS[i] : WEEKDAY_LABELS[i].replace('Thứ ', ''));
      return `${days.join(', ')} (${g.label})`;
    })
    .join(', ');
};

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
/** Thứ Hai của tuần học đầu tiên: bắt đầu vào Thứ 7 / Chủ nhật thì tính từ Thứ Hai kế tiếp. */
const firstTeachingMonday = (iso) => {
  const day = toDate(iso).getUTCDay();
  return day === 6 ? addDays(iso, 2) : day === 0 ? addDays(iso, 1) : mondayOf(iso);
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
 * Lịch tuần cả năm: tuần học đánh số liên tục 1..n theo các chủ đề, xen dòng đợt nghỉ đúng vị trí. Tuần chỉ thành dòng nghỉ
 * khi đợt nghỉ phủ cả Thứ 2 → Thứ 6; nghỉ vài ngày thì vẫn là tuần học, offDays ghi tên đợt nghỉ của ngày đó (BE:EDU-41).
 * Mỗi phần tử: { type: 'week', no, start, end, theme, offDays } | { type: 'break', start, end, label, theme }.
 */
export const yearWeeks = (plan) => {
  if (!plan) return [];
  const breaks = plan.breaks || [];
  const themes = [...(plan.themes || [])].filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  const rows = [];
  let no = 0;
  themes.forEach((t) => {
    for (let m = firstTeachingMonday(t.start); m <= t.end; m = addDays(m, 7)) {
      const off = weekBreaks(breaks, m);
      if (off.every(Boolean)) {
        const br = off[0];
        if (!rows.some((r) => r.type === 'break' && r.start === br.start))
          rows.push({ type: 'break', start: br.start, end: br.end, label: br.label, theme: t });
      } else {
        const offDays = off.map((b) => (b ? b.label || 'Nghỉ' : null));
        rows.push({ type: 'week', no: (no += 1), start: m, end: addDays(m, 4), theme: t, offDays });
      }
    }
  });
  return rows;
};

/**
 * Mục tiêu của một chủ đề, nhóm theo lĩnh vực và lĩnh vực con như bảng mục tiêu năm:
 * [{ domain, sub, goals: [{ id, no, text, contents: [text] }] }]; chỉ mục tiêu có nội dung được tích vào chủ đề.
 */
export const themeGoalBlocks = (domains, numbers, themeId, customTicks = null) => {
  const blocks = [];
  DOMAINS.map((name) => domains.find((d) => d.name === name))
    .filter(Boolean)
    .forEach((d) => {
      let sub = null;
      d.rows.forEach((r) => {
        if (r.kind === 'sub') sub = r.text;
        if (r.kind !== 'goal' || !numbers[r.id]) return;
        const isGoalTicked = customTicks?.[r.id];
        const contents = r.contents
          .filter((c) => {
            if (!c.text.trim()) return false;
            if (customTicks && customTicks[c.id] !== undefined) {
              return customTicks[c.id];
            }
            if (isGoalTicked !== undefined) {
              return isGoalTicked;
            }
            return c.themes.includes(themeId);
          })
          .map((c) => c.text);
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
        extra: '',
      },
    ]),
  );

const newId = () => Math.random().toString(36).slice(2, 10);
export const emptyRow = (title = '') => ({ id: newId(), title, teacher: '', child: '', note: '' });
const emptySection = (key) => ({
  aims: '',
  prep: '',
  rows: SUGGESTED_ROWS[key] ? SUGGESTED_ROWS[key].map((t) => emptyRow(t)) : [emptyRow()],
});
const emptyReview = () => ({ health: '', knowledge: '', attitude: '' });

export const emptyDay = (date) => ({
  date,
  sections: Object.fromEntries(DAY_SECTIONS.map((s) => [s.key, emptySection(s.key)])),
  review: emptyReview(),
});

const stepRow = (title, st) => ({ id: newId(), title, teacher: st?.teacher || '', child: st?.child || '', note: st?.note || '' });

/**
 * Ngày soạn theo bố cục cũ (mục đích/chuẩn bị chung, tiến trình steps 'hoc.a|b|c', 'ngoai_troi.x', 'chieu.x') sang 4 mục
 * (FR-007): mục đích/chuẩn bị chung vào mục học, bước a/b/c thành 3 dòng mang tên gợi ý; không mất chữ.
 */
export function normalizeDay(d) {
  if (!d) return d;
  if (d.sections) {
    const sections = Object.fromEntries(
      DAY_SECTIONS.map((s) => {
        const cur = d.sections[s.key];
        return [
          s.key,
          cur
            ? { aims: cur.aims || '', prep: cur.prep || '', rows: Array.isArray(cur.rows) ? cur.rows : [], off: partsOff(cur) }
            : emptySection(s.key),
        ];
      }),
    );
    return { ...d, sections, review: { ...emptyReview(), ...(d.review || {}) } };
  }
  const steps = d.steps || {};
  const { aims, prep, steps: _old, ...rest } = d;
  const one = (k) => (steps[k] ? [stepRow('', steps[k])] : [emptyRow()]);
  return {
    ...rest,
    sections: {
      hoc: { aims: aims || '', prep: prep || '', rows: ['a', 'b', 'c'].map((p, i) => stepRow(HOC_SUGGESTED_ROWS[i], steps[`hoc.${p}`])) },
      ngoai_troi: { aims: '', prep: '', rows: one('ngoai_troi.x') },
      goc: emptySection('goc'),
      chieu: { aims: '', prep: '', rows: one('chieu.x') },
    },
    review: { ...emptyReview(), ...(d.review || {}) },
  };
}

/** Kế hoạch tuần cũ: chuẩn bị 1 ô vào "Đối với cô" (FR-013); thiếu bảng góc thì rỗng. */
export function normalizeWeek(doc) {
  if (!doc) return doc;
  const prep = typeof doc.prep === 'string' || doc.prep == null ? { teacher: doc.prep || '', child: '', parent: '' } : doc.prep;
  return { ...doc, prep: { teacher: '', child: '', parent: '', ...prep }, corners: Array.isArray(doc.corners) ? doc.corners : [] };
}

const hasText = (v) => typeof v === 'string' && v.trim() !== '';
/** Mục chưa có nội dung của các ngày dạy (bỏ ngày nghỉ, ngày bố cục cũ) — BE:spec 005 FR-007a: [{ date, section }]. */
export function emptyDaySections(docs, weeks = []) {
  const off = new Set(weeks.flatMap((w) => (w.offDays || []).map((l, i) => (l ? addDays(w.start, i) : null)).filter(Boolean)));
  return docs.flatMap((doc) =>
    (doc?.days || []).flatMap((d) =>
      d.sections && !off.has(d.date)
        ? DAY_SECTIONS.filter((s) => !sectionHasContent(d.sections[s.key])).map((s) => ({ date: d.date, section: s.key }))
        : [],
    ),
  );
}

/** Mục có nội dung ở bất kỳ ô nào; tên dòng không tính (FR-007a). */
/** Phần a/b/c của một mục mà cô đã tự xóa (Tiền 11/11/2026): 'aims' | 'prep' | 'rows'; thêm lại được. */
export const SECTION_PARTS = [
  { key: 'aims', label: 'a) Mục đích, yêu cầu' },
  { key: 'prep', label: 'b) Chuẩn bị' },
  { key: 'rows', label: 'c) Tiến hành' },
];
export const partsOff = (sec) => (Array.isArray(sec?.off) ? sec.off.filter((k) => SECTION_PARTS.some((x) => x.key === k)) : []);
/** Xóa một phần: bỏ nội dung của phần đó và đánh dấu đã xóa. */
export const removePart = (sec, key) => ({ ...sec, [key]: key === 'rows' ? [] : '', off: [...new Set([...partsOff(sec), key])] });
export const restorePart = (sec, key) => ({
  ...sec,
  rows: key === 'rows' ? [emptyRow()] : sec.rows,
  off: partsOff(sec).filter((k) => k !== key),
});

export const sectionHasContent = (sec) =>
  !!sec &&
  (hasText(sec.aims) || hasText(sec.prep) || (sec.rows || []).some((r) => hasText(r.teacher) || hasText(r.child) || hasText(r.note)));

/** Ô của một dòng trong bảng tuần; dòng thêm vào cấu hình sau khi soạn giáo án thì trả ô trống. */
export const rowCell = (doc, r) =>
  doc.grid[r.key] || {
    allWeek: r.allWeek,
    common: '',
    days: r.key === 'hoc' ? [0, 1, 2, 3, 4].map(() => ({ subject: '', topic: '' })) : ['', '', '', '', ''],
    extra: '',
  };

/** Giáo án tuần rỗng: kế hoạch tuần + 5 kế hoạch ngày Thứ 2–6. */
export const emptyWeekPlan = ({ classId, yearPlanId, weekStart, weekNo, themeId, versionNo = 1 }) => ({
  // Phiên bản kế hoạch năm ≥2: khóa thêm id kế hoạch để không trùng tuần của phiên bản cũ (BE kiểm khớp)
  id: `wp_${classId}_${weekStart}${versionNo > 1 ? `_${yearPlanId}` : ''}`,
  kind: CLASS_DOC.WEEK,
  classId,
  yearPlanId,
  weekStart,
  weekNo,
  themeId,
  aims: { knowledge: '', skills: '', attitude: '' },
  prep: { teacher: '', child: '', parent: '' },
  corners: [],
  grid: emptyGrid(),
  days: [0, 1, 2, 3, 4].map((i) => emptyDay(addDays(weekStart, i))),
  status: 'DRAFT',
  approvals: [],
  history: [],
});

/** Còn sửa được nội dung (đánh giá trẻ ghi ở trang Đánh giá hằng ngày, không ở giáo án). */
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
 * Hồ sơ chủ đề theo file MN Thái Dương: giáo viên soạn kế hoạch chủ đề + giáo án tất cả các nhánh rồi gửi MỘT lần;
 * duyệt / trả lại cả hồ sơ. Chủ đề nhánh đi kèm hồ sơ này, không có vòng duyệt riêng.
 * Dùng chung cho màn hình (UX) và mock service (BE thật phải tự kiểm).
 */
export function submitBlocker(kind, doc, { branchPlans = [], weekPlans = [], classThemePlans = [], yearPlan }) {
  if (!doc || kind === CLASS_DOC.BRANCH) return null;
  const branch = branchPlans.find((b) => b.classId === doc.classId && b.yearPlanId === doc.yearPlanId);
  const unnamed = !branch || themeWeeksOf(yearPlan, doc.themeId).some((week) => !branch.names?.[week.start]?.trim());
  if (unnamed) return 'Cần tạo đủ chủ đề nhánh của chủ đề này trước khi gửi hồ sơ chủ đề.';
  if (kind === CLASS_DOC.WEEK) {
    const theme = classThemePlans.find((t) => t.classId === doc.classId && t.yearPlanId === doc.yearPlanId && t.themeId === doc.themeId);
    if (!theme || theme.status === 'DRAFT') return 'Kế hoạch tuần được gửi cùng kế hoạch chủ đề.';
    return null;
  }
  const missing = dossierWeekDocs(doc, yearPlan, weekPlans)
    .map((x, i) => (x.doc ? null : `nhánh ${i + 1}`))
    .filter(Boolean);
  if (missing.length)
    return `Còn thiếu kế hoạch giáo dục ngày ${missing.join(', ')}. Soạn và lưu đủ kế hoạch giáo dục ngày các nhánh rồi mới gửi duyệt kế hoạch chủ đề.`;
  return null;
}

/**
 * Trình tự lập kế hoạch lớp: có thể soạn nhánh và kế hoạch chủ đề song song; giáo án cần hồ sơ chủ đề đã lưu.
 * Chỉ chặn tạo mới; các nhánh trong một chủ đề soạn song song. Trả { need: 'branch' | 'theme', message } hoặc null.
 */
export function createBlocker(
  kind,
  { classId, yearPlanId, themeId, weekStart },
  { branchPlans = [], classThemePlans = [], yearPlan = null },
) {
  if (kind === CLASS_DOC.BRANCH) return null;
  const theme = classThemePlans.some((t) => t.classId === classId && t.yearPlanId === yearPlanId && t.themeId === themeId);
  if (kind === CLASS_DOC.WEEK && !theme) return { need: 'theme', message: 'Cần lưu kế hoạch giáo dục chủ đề trước.' };
  // EDU-14 (Tiền 13/11/2026): tuần chưa có tên chủ đề nhánh thì chưa lập kế hoạch tuần; BE chặn lại khi lưu (7112)
  if (kind === CLASS_DOC.WEEK && weekStart && yearPlan) {
    const branchDoc = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlanId) || null;
    const group = themeBranchGroups(yearPlan, branchDoc, themeId).find((g) => g.weeks.some((w) => w.start === weekStart));
    if (!group?.name?.trim()) return { need: 'branch', message: 'Cần đặt tên chủ đề nhánh của tuần này trước.' };
  }
  return null;
}

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
export const branchNumber = (plan, weekStart, branchDoc) => {
  if (branchDoc?.schemaVersion === 2) {
    const branch = branchDoc.branches.find((b) => weekStart >= b.startDate && weekStart <= b.endDate);
    if (!branch) return 0;
    return (
      branchDoc.branches
        .filter((b) => b.themeId === branch.themeId)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .findIndex((b) => b.key === branch.key) + 1
    );
  }
  const weeks = yearWeeks(plan).filter((w) => w.type === 'week');
  const week = weeks.find((w) => w.start === weekStart);
  return week ? weeks.filter((w) => w.theme.id === week.theme.id).findIndex((w) => w.start === weekStart) + 1 : 0;
};

/*
 * Gợi ý hoạt động cho kế hoạch tuần lấy từ cột "Hoạt động giáo dục" của kế hoạch chủ đề: mỗi dòng (gạch đầu dòng) là
 * một hoạt động gắn MT; loại giờ đọc từ phần đầu dòng ("Trò chuyện: …", "Chơi, HĐ ngoài trời: …"). Dòng không rõ loại giờ
 * thì gợi ý ở mọi dòng của kế hoạch tuần.
 */
// Tên loại giờ theo cách trường hay viết (file Thái Dương): TDS / TD sáng, HĐ chơi (góc), LĐVS, nêu gương (buổi chiều)…
const SLOT_WORDS = [
  ['don', /đón trẻ/i],
  ['tro_chuyen', /trò chuyện/i],
  ['the_duc', /thể dục sáng|\btds\b|\btd sáng/i],
  ['hoc', /hđ học|hoạt động học|giờ học|\bhđh\b|hđ tạo hình/i],
  ['ngoai_troi', /ngoài trời/i],
  ['goc', /góc|hđ chơi\b|hoạt động chơi\b/i],
  ['chieu', /chiều|theo ý thích|lđvs|lao động|nêu gương/i],
  ['tra_tre', /trả trẻ/i],
];
// Ngoài tên quen dùng, nhận cả đúng tên dòng của kế hoạch tuần (kể cả dòng trường tự thêm ở trang Cấu hình)
const slotsOf = (head) => {
  const h = head.trim().toLowerCase();
  const byLabel = weekRows()
    .filter((r) => h && r.label.trim().toLowerCase() === h)
    .map((r) => r.key);
  return [...new Set([...byLabel, ...SLOT_WORDS.filter(([, re]) => re.test(head)).map(([k]) => k)])];
};

/* ---------- Thẻ hoạt động (BE:EDU-78, spec 006) ---------- */

/** Tên thẻ tối đa (BE R8). */
export const CARD_NAME_MAX = 300;

const headOf = (text) => (text.includes(':') ? text.slice(0, text.indexOf(':')) : text);
// Thẻ chỉ mang một loại giờ: loại giờ đầu tiên khớp mà trường đang có trong cấu hình; không khớp ⇒ "" (chưa rõ)
const slotKeyOf = (head) => slotsOf(head).find((k) => weekRows().some((r) => r.key === k)) || '';

/**
 * Dữ liệu cũ (ô chữ "Loại giờ: …" của từng MT) thành thẻ, cùng cách tách của bản cũ: đầu mục rỗng ("HĐ học:") cho các dòng
 * con "+ …" loại giờ của nó. Id thẻ = "goalId#i" để lượt xếp và học liệu cũ vẫn trỏ đúng (BE research R2).
 */
function legacyCards(content, goalIds) {
  return Object.entries(content?.rows || {})
    .filter(([goalId]) => !goalIds || goalIds.has(String(goalId)))
    .flatMap(([goalId, row]) => {
      let heading = null;
      const out = [];
      String(row?.activities || '')
        .split('\n')
        .forEach((raw) => {
          const sub = /^\s*\+/.test(raw);
          const line = raw.replace(/^[\s\-–•+*]+/, '').trim();
          if (!line) return;
          const colon = line.indexOf(':');
          const head = colon >= 0 ? line.slice(0, colon) : line;
          if (!sub && colon >= 0 && !line.slice(colon + 1).trim()) {
            heading = { name: head.trim(), slot: slotKeyOf(head) };
            return;
          }
          if (!sub) heading = null;
          const inherit = sub && heading && !slotsOf(head).length;
          out.push({
            id: `${goalId}#${out.length}`,
            slot: inherit ? heading.slot : slotKeyOf(head),
            name: inherit ? `${heading.name}: ${line}` : line,
            goalIds: [String(goalId)],
            contentRefs: [],
            legacy: true,
          });
        });
      return out;
    });
}

/** Thẻ của kế hoạch chủ đề; bản chưa có thẻ thì dựng từ ô chữ cũ (chỉ MT trong goalIds nếu truyền). */
export const normalizeTheme = (content, goalIds = null) =>
  Array.isArray(content?.activities) ? content.activities : legacyCards(content, goalIds && new Set([...goalIds].map(String)));

/** Thẻ dùng ở tuần: thẻ của kế hoạch chủ đề + thẻ bổ sung theo hồ sơ chủ đề (day.content.week.cards, FR-014). */
export const cardsOf = (themeContent, dayWeek = null, goalIds = null) => {
  const own = normalizeTheme(themeContent, goalIds);
  const ids = new Set(own.map((c) => c.id));
  return [...own, ...(dayWeek?.cards || []).filter((c) => !ids.has(c.id))];
};

const cardMap = (cards) => (cards instanceof Map ? cards : new Map((cards || []).map((c) => [c.id, c])));

/** MT của một lượt xếp = MT của thẻ (FR-026); thẻ không còn thì dùng bản chụp goalIds, bản cũ dùng goalId; gõ tay ⇒ []. */
export const resolveGoals = (pick, cards = []) => {
  const card = cardMap(cards).get(pick?.cardId ?? pick?.id);
  if (card) return (card.goalIds || []).map(String);
  if (Array.isArray(pick?.goalIds) && pick.goalIds.length) return pick.goalIds.map(String);
  return pick?.goalId != null && pick.goalId !== '' ? [String(pick.goalId)] : [];
};

export const newCard = ({ slot, name, goalIds, contentRefs = [], origin }) => ({
  id: `c-${crypto.randomUUID()}`,
  slot,
  name,
  goalIds: goalIds.map(String),
  contentRefs,
  ...(origin ? { origin } : {}),
});

export const slotLabel = (slot) => weekRows().find((r) => r.key === slot)?.label || '';

/** "Loại giờ: tên" như dòng của mẫu (FR-008); thẻ cũ đã mang sẵn đầu dòng của nó. */
export const cardText = (card) => (card.legacy || !card.slot ? card.name : `${slotLabel(card.slot)}: ${card.name}`);

/** Lượt xếp mới lưu vào ô tuần: MT chỉ là bản chụp, MT thật giải theo thẻ (BE R3). */
export const pickOf = (a, cornerId) => ({ id: a.id, cardId: a.id, goalIds: a.goalIds, text: a.text, ...(cornerId ? { cornerId } : {}) });

/**
 * Hoạt động gợi ý cho kế hoạch tuần từ thẻ của kế hoạch chủ đề: [{ id, card, goalIds, goalNos, goalId, goalNo, slots, text }].
 * source: tài liệu kế hoạch chủ đề, hoặc rowOf(goal) → { activities } (bản cũ). MT ngoài chủ đề bị bỏ khỏi thẻ.
 */
export function themeActivities(blocks, source, dayWeek = null) {
  const goals = blocks.flatMap((b) => b.goals);
  const byId = new Map(goals.map((g) => [String(g.id), g]));
  const content = typeof source === 'function' ? { rows: Object.fromEntries(goals.map((g) => [g.id, source(g)])) } : source;
  return cardsOf(content, dayWeek, new Set(byId.keys())).map((card) => {
    const goalIds = (card.goalIds || []).map(String).filter((id) => byId.has(id));
    return {
      id: card.id,
      card,
      goalIds,
      goalNos: goalIds.map((id) => byId.get(id).no),
      goalId: goalIds[0] ?? null,
      goalNo: goalIds.length ? byId.get(goalIds[0]).no : null,
      slots: card.legacy ? slotsOf(headOf(card.name)) : card.slot ? [card.slot] : [],
      text: cardText(card),
      origin: card.origin || null,
    };
  });
}

/** Dạng cây MT → nội dung → thẻ (FR-004): warn 'red' = MT chưa có thẻ; nội dung chưa có thẻ ⇒ warn của dòng = 'yellow'. */
export function themeTree(blocks, cards, contentLines = (g) => g.contents) {
  return blocks
    .flatMap((b) => b.goals)
    .map((goal) => {
      const own = cards.filter((c) => (c.goalIds || []).map(String).includes(String(goal.id)));
      const contents = contentLines(goal).map((text, i) => {
        const linked = own.filter((c) => (c.contentRefs || []).includes(`${goal.id}:${i}`));
        return { text, index: i, cards: linked, warn: linked.length ? null : 'yellow' };
      });
      const unlinkedCards = own.filter((c) => !(c.contentRefs || []).some((r) => r.startsWith(`${goal.id}:`)));
      return { goal, cards: own, contents, unlinkedCards, warn: own.length ? null : 'red' };
    });
}

/** Dòng nội dung của bản chụp (bỏ gạch đầu dòng) để gắn thẻ theo chỉ số "goalId:i". */
export const contentLinesOf = (text) =>
  String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[\s\-–•+*]+/, '').trim())
    .filter(Boolean);

/** Gợi ý cho một dòng của kế hoạch tuần (FR-019): thẻ đúng loại giờ trước, các thẻ khác (cả "chưa rõ") ở nhóm "Khác". */
export const activitiesForRow = (activities, rowKey) => [
  ...activities.filter((a) => a.slots.includes(rowKey)),
  ...activities.filter((a) => !a.slots.includes(rowKey)).map((a) => ({ ...a, other: true })),
];

/** Khóa ô của kế hoạch tuần để nhớ hoạt động đã chọn: dòng + ngày (0–4) hoặc "all" khi gộp cả tuần. */
export const cellKey = (rowKey, day) => `${rowKey}.${day}`;

/** Các ô đang dùng của giáo án tuần: [{ key, day, list }]; dòng đang gộp cả tuần chỉ dùng ô "all", ngược lại dùng ô từng ngày. */
const activeCells = (doc) =>
  Object.entries(doc?.picks || {})
    .map(([key, list]) => ({ key, day: key.split('.')[1], list }))
    .filter(({ key, day }) => {
      const r = weekRows().find((x) => x.key === key.split('.')[0]);
      const merged = !!r?.canMerge && rowCell(doc, r).allWeek;
      return merged ? day === 'all' : day !== 'all';
    });

export const teachingDayPicks = (doc, day) =>
  activeCells(doc)
    .filter((cell) => day == null || cell.day === 'all' || cell.day === 'extra' || cell.day === String(day))
    .flatMap((cell) => cell.list);

/** MT dạy trong từng ngày (0–4) = hợp MT của các thẻ xếp vào ngày (FR-024); ô gộp cả tuần, bảng góc tính cho mọi ngày. */
export const dayGoalsOf = (doc, cards = []) => {
  const map = cardMap(cards);
  return [0, 1, 2, 3, 4].map((i) => {
    const ids = activeCells(doc)
      .filter(({ day }) => day === 'all' || day === 'extra' || day === String(i))
      .flatMap(({ list }) => list.flatMap((p) => resolveGoals(p, map)));
    return [...new Set(ids)];
  });
};

/*
 * Khung giáo án ngày theo 4 mục lấy từ kế hoạch tuần (FR-005, FR-006): tên hoạt động, MT, gợi ý mục đích (câu MT để cô
 * viết lại) và dòng tiến hành; mục góc lấy từ bảng góc chi tiết. Trả { hoc|ngoai_troi|goc|chieu: { name, goals, aims, prep, rows } }.
 */
/**
 * Tên giờ học như file Thái Dương: môn + nội dung chính (dòng đầu của đề tài); các dòng sau là nội dung kết hợp (NDKH).
 * Vd. "Âm nhạc: Dạy VĐMH “Vui đến trường” (NDKH: Nghe hát “Ngày đầu tiên đi học”; TC “Đoán tên bạn hát”)".
 */
export const hocTitle = (hoc) => {
  const ls = String(hoc?.topic || '')
    .split('\n')
    .map((l) => l.replace(/^[\s\-–•+*]+/, '').trim())
    .filter(Boolean);
  const main = [hoc?.subject?.trim(), ls[0]].filter(Boolean).join(': ');
  return ls.length > 1 ? `${main} (NDKH: ${ls.slice(1).join('; ')})` : main;
};

// Bản cũ có nội dung nhập tay nhưng chưa có picks: giữ nội dung, không đoán liên kết MT/học liệu.
export const teachingDayUnlinked = (doc, day) =>
  weekRows().flatMap((row) => {
    const grid = rowCell({ ...doc, grid: doc.grid || {} }, row);
    const merged = row.canMerge && grid.allWeek;
    const cells = merged ? [['all', grid.common]] : (day == null ? [0, 1, 2, 3, 4] : [day]).map((d) => [d, grid.days?.[d]]);
    if (!merged && row.extraLabel) cells.push(['extra', grid.extra]);
    return cells
      .filter(([d]) => !(doc.picks?.[cellKey(row.key, d)] || []).length)
      .flatMap(([d, value]) => {
        const text = typeof value === 'string' ? value.trim() : hocTitle(value).trim();
        return text ? [{ id: `unlinked/${row.key}/${d}`, goalId: null, goalNo: null, text: `${row.label}: ${text}`, unlinked: true }] : [];
      });
  });

export function dayDraftFromWeek(doc, i, goals = [], cards = []) {
  const map = cardMap(cards);
  const lines = (s) =>
    String(s || '')
      .split('\n')
      .map((l) => l.replace(/^[\s\-–•+*]+/, '').trim())
      .filter(Boolean);
  const textOf = (key) => {
    const r = weekRows().find((x) => x.key === key);
    if (!r) return '';
    const g = rowCell(doc, r);
    const merged = r.canMerge && g.allWeek;
    const v = merged ? g.common : g.days[i];
    // Phần chung cả tuần (Chơi tự do, Chơi tự chọn, Nêu gương…) thành các hoạt động cuối của mục, như file mẫu
    const extra = !merged && r.extraLabel ? g.extra || '' : '';
    return [typeof v === 'string' ? v : v?.topic || '', extra].filter((x) => x.trim()).join('\n');
  };
  const picksOf = (key) => {
    const r = weekRows().find((x) => x.key === key);
    const merged = !!r?.canMerge && rowCell(doc, r).allWeek;
    const keys = merged ? [cellKey(key, 'all')] : [cellKey(key, i), cellKey(key, 'extra')];
    return keys.flatMap((k) => doc.picks?.[k] || []);
  };
  const goalsOf = (key) => {
    const ids = [...new Set(picksOf(key).flatMap((p) => resolveGoals(p, map)))];
    return ids.map((id) => goals.find((g) => String(g.id) === id)).filter(Boolean);
  };
  // Hoạt động (thẻ) đang xếp ở mục: để biết kế hoạch tuần đã đổi sau khi cô viết mục ngày (FR-027)
  const cardIdsOf = (key) => [
    ...new Set(
      picksOf(key)
        .map((p) => p.cardId ?? p.id)
        .filter(Boolean),
    ),
  ];
  const mtAims = (key) =>
    goalsOf(key)
      .map((g) => `- MT${g.no}: ${g.text}`)
      .join('\n');
  const steps = (items) => items.map((t, n) => `Hoạt động ${n + 1}: ${t}`).join('\n');
  const bullets = (items) => items.map((t) => `- ${t}`).join('\n');
  const hoc = doc.grid.hoc?.days?.[i] || {};
  const hocItems = lines(hoc.topic);
  // File "Chủ đề gia đình": giờ học ghi "Hoạt động chính" (môn + nội dung chính) và "Hoạt động kết hợp" (các dòng sau)
  const main = [hoc.subject?.trim(), hocItems[0]].filter(Boolean).join(': ');
  const corners = (doc.corners || []).filter((c) => c.name?.trim() || c.content?.trim());
  // Ngoài trời: dòng đầu của ô ngày = hoạt động có mục đích, các dòng sau = trò chơi vận động, phần chung cả tuần = chơi theo ý thích
  const outRow = weekRows().find((x) => x.key === 'ngoai_troi');
  const outCell = outRow ? rowCell(doc, outRow) : null;
  const outMerged = !!outRow?.canMerge && !!outCell?.allWeek;
  const outItems = lines(outCell ? (outMerged ? outCell.common : outCell.days[i]) : '');
  const outFree = lines(outCell && !outMerged ? outCell.extra : '');
  const outParts = [outItems.slice(0, 1), outItems.slice(1), outFree];
  const chieuItems = lines(textOf('chieu'));
  return {
    hoc: {
      name: hocTitle(hoc),
      main,
      combined: hocItems.slice(1).join('; '),
      goals: goalsOf('hoc'),
      cards: cardIdsOf('hoc'),
      aims: mtAims('hoc'),
      prep: '',
      rows: hocItems.length ? HOC_SUGGESTED_ROWS.map((title, n) => ({ title, teacher: n === 1 ? steps(hocItems) : '' })) : [],
    },
    ngoai_troi: {
      name: [...outItems, ...outFree].join('; '),
      goals: goalsOf('ngoai_troi'),
      cards: cardIdsOf('ngoai_troi'),
      aims: mtAims('ngoai_troi'),
      prep: '',
      rows: outParts.some((x) => x.length) ? NGOAI_TROI_SUGGESTED_ROWS.map((title, n) => ({ title, teacher: outParts[n].join('\n') })) : [],
    },
    // Mục góc của ngày theo file: mỗi góc một dòng "tên góc: nội dung"; mục đích, chuẩn bị, cách tiến hành nằm ở bảng góc của tuần
    goc: {
      name: corners
        .map((c) => c.name)
        .filter((x) => x?.trim())
        .join(', '),
      goals: goalsOf('goc'),
      cards: cardIdsOf('goc'),
      aims: '',
      prep: '',
      rows: corners.map((c) => ({ title: c.name || '', teacher: c.content || '' })),
    },
    // Buổi chiều theo file: danh sách gạch đầu dòng
    chieu: {
      name: chieuItems.join('; '),
      goals: goalsOf('chieu'),
      cards: cardIdsOf('chieu'),
      aims: mtAims('chieu'),
      prep: '',
      rows: chieuItems.length ? [{ title: '', teacher: bullets(chieuItems) }] : [],
    },
  };
}

/** Chữ ký nội dung dòng tiến hành để biết cô đã sửa sau lần "Lấy từ kế hoạch tuần" chưa. */
export const rowsSig = (rows = []) =>
  rows.map((r) => [r.title, r.teacher, r.child, r.note].map((x) => x || '').join('\u0001')).join('\u0002');
export const rowsFromDraft = (rows) => rows.map((r) => ({ ...emptyRow(r.title), teacher: r.teacher || '' }));

/** Dòng Góc của bảng Thứ 2–6 sinh từ bảng góc chi tiết, chỉ xem (FR-015b). */
export function cornersToGrid(doc) {
  const r = weekRows().find((x) => x.key === 'goc');
  if (!r || !doc.corners) return doc;
  const g = (doc.grid.goc ||= rowCell(doc, r));
  g.allWeek = true;
  g.common = doc.corners
    .filter((c) => c.name?.trim() || c.content?.trim())
    .map((c) => [c.name?.trim(), c.content?.trim()].filter(Boolean).join(': '))
    .join('\n');
  return doc;
}

/**
 * Chép bảng góc tuần trước vào tuần đang trống (FR-015c); MT chỉ giữ khi thuộc MT của chủ đề tuần mới.
 * goalIds: Set id MT của chủ đề tuần mới.
 */
export function copyPrevCorners(doc, prev, goalIds) {
  if (!prev?.corners?.length || doc.corners?.length) return doc;
  const idMap = new Map();
  doc.corners = prev.corners.map((c) => {
    const id = newId();
    idMap.set(c.id, id);
    return { ...c, id };
  });
  const picks = (prev.picks?.['goc.all'] || []).filter(
    (p) => idMap.has(p.cornerId) && resolveGoals(p).some((id) => goalIds.has(id) || goalIds.has(Number(id))),
  );
  (doc.picks ||= {})['goc.all'] = picks.map((p) => ({ ...p, cornerId: idMap.get(p.cornerId) }));
  return cornersToGrid(doc);
}

export const newCorner = () => ({ id: newId(), name: '', content: '', aims: '', prep: '', steps: '' });

/** Phần nội dung của hoạt động để ghi vào ô ("Trò chuyện: Ngày hội đến trường" → "Ngày hội đến trường"). */
export const activityBody = (text) => (text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text);

const normText = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Ô gõ tay (không chọn gợi ý): thẻ của kế hoạch chủ đề có nội dung nằm trong chữ của ô thì tự nhớ như đã chọn, để kế hoạch
 * ngày và đánh giá trẻ có đúng MT. Một thẻ xếp được nhiều ô, nhiều tuần (FR-009).
 */
export function linkTypedActivities(doc, activities, canEditCell = () => true) {
  if (!activities.length) return doc;
  weekRows().forEach((r) => {
    const g = rowCell(doc, r);
    const merged = r.canMerge && g.allWeek;
    const cells = merged
      ? [['all', g.common]]
      : [
          ...g.days.map((v, i) => [i, typeof v === 'string' ? v : `${v?.subject || ''} ${v?.topic || ''}`]),
          ...(r.extraLabel ? [['extra', g.extra]] : []),
        ];
    cells.forEach(([day, text]) => {
      if (!canEditCell(day)) return;
      const t = ` ${normText(text)} `;
      if (!t.trim()) return;
      const key = cellKey(r.key, day);
      const list = doc.picks?.[key] || [];
      const add = activitiesForRow(activities, r.key).filter((a) => {
        const body = normText(activityBody(a.text));
        // Cô đã bỏ MT này khỏi ô (unlinked) thì không tự gắn lại
        return !(body.length < 6 || !t.includes(` ${body} `) || list.some((p) => p.id === a.id) || doc.unlinked?.[key]?.includes(a.id));
      });
      if (add.length) (doc.picks ||= {})[key] = [...list, ...add.map((a) => pickOf(a))];
    });
  });
  return doc;
}

/** Hoạt động đã xếp (cả ô ngày và ô gộp cả tuần) của một giáo án tuần (Set id). */
export const pickedIdsOf = (doc) => new Set(activeCells(doc).flatMap(({ list }) => list.map((p) => p.id)));

/**
 * Bảng phủ MT × tuần (FR-013, FR-022, FR-023): weeks = [{ start, offDays, doc }] với doc là bản tuần đang xem (nháp của người
 * soạn hoặc bản hiệu lực). Ô gộp cả tuần, bảng góc tính cho mọi ngày học; bỏ ngày nghỉ; hoạt động gõ tay không có MT.
 * Trả { rows: [{ goal, weeks: { start: [day] }, count }], unlinked: [{ weekStart, day, rowKey, text }], covered, total, placed }.
 */
export function coverageOf(goals, cards, weeks) {
  const map = cardMap(cards);
  const rows = goals.map((goal) => ({ goal, weeks: {}, count: 0 }));
  const byGoal = new Map(rows.map((r) => [String(r.goal.id), r]));
  const unlinked = [];
  let placed = 0;
  weeks.forEach(({ start, offDays = [], doc }) => {
    if (!doc) return;
    const teaching = [0, 1, 2, 3, 4].filter((i) => !offDays[i]);
    activeCells(doc).forEach(({ list, day }) => {
      const days = day === 'all' || day === 'extra' ? teaching : teaching.filter((i) => String(i) === day);
      list.forEach((p) => {
        placed += 1;
        resolveGoals(p, map).forEach((id) => {
          const row = byGoal.get(id);
          if (!row) return;
          days.forEach((i) => {
            const at = (row.weeks[start] ||= []);
            if (!at.includes(i)) {
              at.push(i);
              row.count += 1;
            }
          });
        });
      });
    });
    teachingDayUnlinked(doc, null).forEach((u) => {
      const [, rowKey, d] = u.id.split('/');
      if (d === 'all' || d === 'extra' || teaching.includes(Number(d))) unlinked.push({ weekStart: start, day: d, rowKey, text: u.text });
    });
  });
  rows.forEach((r) => Object.values(r.weeks).forEach((d) => d.sort()));
  const covered = rows.filter((r) => r.count > 0).length;
  return { rows, unlinked, covered, total: rows.length, placed, missing: rows.filter((r) => !r.count).map((r) => r.goal) };
}

/** Ô tuần khác nhau giữa hai bản (FR-017): khóa "dòng.ngày" | "dòng.all" | "dòng.extra" có chữ hoặc lượt xếp khác. */
export function weekDiff(a, b) {
  const textAt = (doc, r, d) => {
    const g = rowCell({ ...doc, grid: doc?.grid || {} }, r);
    const v = d === 'all' ? g.common : d === 'extra' ? g.extra : g.days?.[d];
    return JSON.stringify(v ?? '');
  };
  const pickAt = (doc, key) => JSON.stringify((doc?.picks?.[key] || []).map((p) => [p.cardId ?? p.id, p.cornerId ?? null, p.text ?? '']));
  const out = [];
  weekRows().forEach((r) =>
    [0, 1, 2, 3, 4, 'all', 'extra'].forEach((d) => {
      const key = cellKey(r.key, d);
      if (textAt(a, r, d) !== textAt(b, r, d) || pickAt(a, key) !== pickAt(b, key)) out.push(key);
    }),
  );
  if (JSON.stringify(a?.corners || []) !== JSON.stringify(b?.corners || []) && !out.includes('goc.all')) out.push('goc.all');
  return out;
}

/** Phần lịch của tuần lưu làm mốc khi bắt đầu sửa theo hồ sơ chủ đề (BE research R5). */
export const weekBaseOf = (doc) => ({
  grid: structuredClone(doc?.grid || {}),
  picks: structuredClone(doc?.picks || {}),
  unlinked: structuredClone(doc?.unlinked || {}),
  corners: structuredClone(doc?.corners || []),
});

/**
 * Điền sẵn ô a) Mục đích, yêu cầu bằng câu MT (FR-011, FR-025): chỉ khi ô trống và chưa từng điền, mỗi mục một lần; ghi
 * "pulled" để nút "Lấy từ kế hoạch tuần" coi như đã lấy. Trả true khi có điền.
 */
export function prefillDayAims(day, fromWeek) {
  let changed = false;
  DAY_SECTIONS.forEach((s) => {
    const sec = day.sections?.[s.key];
    const aims = fromWeek[s.key]?.aims;
    if (!sec || !aims || sec.aims?.trim() || partsOff(sec).includes('aims') || day.prefilled?.includes(s.key)) return;
    sec.aims = aims;
    day.prefilled = [...(day.prefilled || []), s.key];
    day.pulled = { ...(day.pulled || {}), [`${s.key}.aims`]: aims };
    changed = true;
  });
  return changed;
}

/** Mốc thẻ của từng mục lúc soạn ngày; mục có thẻ bị bỏ khỏi ô tuần sau đó ⇒ ghi chú "đã đổi ở kế hoạch tuần" (FR-027). */
export const markDayBasis = (day, fromWeek) => {
  day.basis = Object.fromEntries(DAY_SECTIONS.map((s) => [s.key, fromWeek[s.key]?.cards || []]));
  return day;
};
export const droppedFromWeek = (day, fromWeek) =>
  DAY_SECTIONS.filter((s) => (day.basis?.[s.key] || []).some((id) => !(fromWeek[s.key]?.cards || []).includes(id))).map((s) => s.key);

/** Lấy từ tuần trước cho các dòng đang gộp cả tuần: chỉ điền ô gộp còn trống, kèm MT đã chọn. */
export function copyMergedRows(doc, prev) {
  if (!prev) return doc;
  weekRows().forEach((r) => {
    const g = rowCell(doc, r);
    const p = rowCell(prev, r);
    // Phần chung cả tuần của dòng ngoài trời / buổi chiều cũng lặp lại mỗi tuần
    if (r.extraLabel && !g.extra?.trim() && p.extra?.trim()) {
      (doc.grid[r.key] ||= g).extra = p.extra;
      const k = cellKey(r.key, 'extra');
      if (prev.picks?.[k]?.length) (doc.picks ||= {})[k] = prev.picks[k].map((x) => ({ ...x }));
    }
    if (!r.canMerge || !g.allWeek || !p.allWeek || g.common?.trim() || !p.common?.trim()) return;
    (doc.grid[r.key] ||= g).common = p.common;
    const key = cellKey(r.key, 'all');
    if (prev.picks?.[key]?.length) (doc.picks ||= {})[key] = prev.picks[key].map((x) => ({ ...x }));
  });
  return doc;
}

const hocRowsOf = (day) => normalizeDay(day)?.sections?.hoc?.rows || [];

/**
 * Bài dạy đã soạn có cùng môn + nội dung chính với giờ học của ngày (ở giáo án khác: lớp khác, năm trước) để dùng lại
 * dòng tiến hành của mục học: [{ doc, index, date, rows }], mới nhất trước.
 */
export function lessonReuseFor(docs, doc, index) {
  const key = normText(
    hocTitle({ ...doc.grid.hoc?.days?.[index], topic: String(doc.grid.hoc?.days?.[index]?.topic || '').split('\n')[0] }),
  );
  if (!key) return [];
  return docs
    .filter((x) => x && x.id !== doc.id)
    .flatMap((x) => (x.days || []).map((d, i) => ({ doc: x, index: i, date: d.date, rows: hocRowsOf(d), hoc: x.grid?.hoc?.days?.[i] })))
    .filter((x) => x.hoc && normText(hocTitle({ ...x.hoc, topic: String(x.hoc.topic || '').split('\n')[0] })) === key)
    .filter((x) => x.rows.some((r) => r.teacher?.trim()))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Chép dòng tiến hành của mục học vào các dòng còn trống theo thứ tự; thiếu dòng thì thêm (FR-006). */
export function copyLessonSteps(doc, index, rows) {
  const target = doc.days[index].sections.hoc.rows;
  (rows || []).forEach((src, i) => {
    if (!target[i]) target.push(emptyRow(src.title || ''));
    const cur = target[i];
    if (!cur.title?.trim() && src.title?.trim()) cur.title = src.title;
    ['teacher', 'child', 'note'].forEach((f) => {
      if (!cur[f]?.trim() && src[f]?.trim()) cur[f] = src[f];
    });
  });
  return doc;
}

/** Mục đích tuần gợi ý từ câu MT của các hoạt động đã xếp trong tuần (mỗi MT một dòng), để cô viết lại. */
export const weekAimsFromGoals = (doc, goals, cards = []) => {
  const map = cardMap(cards);
  const ids = [...new Set(activeCells(doc).flatMap(({ list }) => list.flatMap((p) => resolveGoals(p, map))))];
  return goals
    .filter((g) => ids.includes(String(g.id)))
    .map((g) => `- ${g.text}`)
    .join('\n');
};

/** Lịch tháng giữ đủ từng tuần; chỉ gộp các tuần liền nhau của cùng một nhánh. */
export function branchGrid(rows, names, branches = []) {
  const weeks = rows.filter((r) => r.type === 'week').sort((a, b) => a.start.localeCompare(b.start));
  const months = [...new Set(weeks.map((r) => r.start.slice(0, 7)))];
  return {
    months: months.map((month) => {
      const monthWeeks = weeks.filter((week) => week.start.startsWith(month));
      const cells = [];
      for (let slot = 1; slot <= 5; slot++) {
        const week = monthWeeks.find((w) => Math.floor((Number(w.start.slice(8, 10)) - 1) / 7) + 1 === slot);
        const owner =
          week && branches.find((b) => String(b.themeId) === String(week.theme.id) && week.start >= b.startDate && week.end <= b.endDate);
        const previous = cells.at(-1);
        if (owner && previous?.branchKey === owner.key) {
          previous.span++;
          previous.end = week.end;
        } else
          cells.push({
            slot,
            span: 1,
            week,
            end: week?.end,
            branchKey: owner?.key,
            name: week ? names?.[week.start]?.trim() || owner?.name || '' : '',
          });
      }
      return { month, cells };
    }),
  };
}

/**
 * Các tuần của một chủ đề gom theo chủ đề nhánh (nhánh 1 hay nhiều tuần): [{ no, weeks, name, label }].
 * label "Tuần 2+3" theo thứ tự tuần trong chủ đề; lịch nhánh cũ (không có branches) thì mỗi tuần một nhánh.
 */
export function themeBranchGroups(yearPlan, branchDoc, themeId) {
  const weeks = yearPlan ? yearWeeks(yearPlan).filter((w) => w.type === 'week' && w.theme.id === themeId) : [];
  const ranges = (branchDoc?.branches || [])
    .filter((b) => String(b.themeId) === String(themeId))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const groups = [];
  weeks.forEach((w, i) => {
    const range = ranges.find((b) => w.start >= b.startDate && w.start <= b.endDate);
    const last = groups[groups.length - 1];
    if (range && last?.range === range) last.weeks.push({ ...w, themeNo: i + 1 });
    else groups.push({ range, weeks: [{ ...w, themeNo: i + 1 }] });
  });
  return groups.map((g, i) => ({
    no: i + 1,
    weeks: g.weeks,
    name: g.range?.name || branchDoc?.names?.[g.weeks[0].start] || '',
    label: `Tuần ${g.weeks.map((w) => w.themeNo).join('+')}`,
  }));
}

/**
 * Học kỳ để lọc trang kế hoạch lớp (Tiền 13/11/2026): có đủ ngày học kỳ của năm học thì luôn có Học kỳ 1, 2, không chờ BE
 * tạo gói học kỳ (gói chỉ có sau lần lưu đầu và gắn một phiên bản kế hoạch tổ). Gói đã có thì dùng danh sách chủ đề và hạn
 * của gói; chưa có thì xếp chủ đề theo ngày bắt đầu như BE (EduSemesters.of: nghỉ giữa kỳ tính vào học kỳ sau).
 * Trả [{ semesterNo, pkg, themeIds, deadline }].
 */
export function semesterChoices(year, themes, packages) {
  const y = year || {};
  const configured = !!(y.semester1Start && y.semester1End && y.semester2Start && y.semester2End);
  const noOf = (d) => (!d || d < y.semester1Start || d > y.semester2End ? null : d > y.semester1End ? 2 : 1);
  const nos = configured ? [1, 2] : [...new Set(packages.map((p) => Number(p.semesterNo)))].sort((a, b) => a - b);
  return nos.map((no) => {
    const pkg = packages.find((p) => Number(p.semesterNo) === no) || null;
    return {
      semesterNo: no,
      pkg,
      themeIds: pkg ? (pkg.themeIds || []).map(String) : themes.filter((t) => noOf(t.start) === no).map((t) => String(t.id)),
      deadline: pkg?.deadline || (configured ? (no === 1 ? y.semester1Start : y.semester2Start) : null),
    };
  });
}
