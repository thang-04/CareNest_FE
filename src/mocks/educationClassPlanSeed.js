import { THAI_DUONG } from './thaiDuongData';
import { YEAR_DOMAINS, addDays, emptyBranchPlan, emptyThemePlan, emptyWeekPlan, yearWeeks } from '@/models/education-plan/yearPlanModel';

/*
 * Dữ liệu mẫu kế hoạch giáo dục theo mẫu Trường MN Thái Dương:
 * - kế hoạch năm khối 3–4 tuổi năm 2025–2026 (đúng file của trường) và 2026–2027 (dời +364 ngày, đã ban hành);
 * - năm 2026–2027: 2 lớp Mầm có chủ đề nhánh, kế hoạch chủ đề 1 và giáo án 3 tuần (1 tuần chờ tổ trưởng, 1 tuần chờ Phó HT).
 * Người ký là tài khoản demo, không dùng tên người trong tài liệu của trường.
 */

const AG = 'ag-3';
const SHIFT = 364; // giữ nguyên thứ trong tuần

const PEOPLE = {
  u_lan: ['Nguyễn Thị Lan', 'Phó hiệu trưởng'],
  u_ha: ['Trần Thu Hà', 'Tổ trưởng nhóm tuổi'],
  u_an: ['Nguyễn Văn An', 'Giáo viên'],
  u_tuan: ['Hoàng Minh Tuấn', 'Giáo viên'],
};

const entry = (userId, action, at, tone = '', note) => ({
  action,
  by: PEOPLE[userId][0],
  role: PEOPLE[userId][1],
  at,
  tone,
  ...(note ? { note } : {}),
});

const textSig = (userId, at) => ({
  userId,
  name: PEOPLE[userId][0],
  role: PEOPLE[userId][1],
  at,
  sig: { type: 'text', data: PEOPLE[userId][0] },
});

// Ghi chú và khoảng nghỉ năm 2026–2027 (Tết 2027 rơi vào tuần 08/02).
const NOTES_2627 = {
  GT: 'Kết thúc học kì I ngày 08/01/2027',
  'T&MX': 'Nghỉ Tết Nguyên đán 08/02/2027 → 12/02/2027',
  'QH-ĐN-BH': 'Từ 26/04/2027 → 30/04/2027 ôn tập, nghỉ lễ',
};
const BREAKS = {
  '2025-2026': [
    { start: '2026-02-16', end: '2026-02-20', label: 'Nghỉ Tết Nguyên đán' },
    { start: '2026-04-27', end: '2026-05-01', label: 'Ôn tập, nghỉ lễ 30/4 – 1/5' },
  ],
  '2026-2027': [
    { start: '2027-02-08', end: '2027-02-12', label: 'Nghỉ Tết Nguyên đán' },
    { start: '2027-04-26', end: '2027-04-30', label: 'Ôn tập, nghỉ lễ 30/4 – 1/5' },
  ],
};

const buildYearPlan = (schoolYear, shift) => {
  const id = `yp_${AG}_${schoolYear}`;
  const themeId = (abbr) => `${id}-t${THAI_DUONG.year.themes.findIndex((t) => t.abbr === abbr) + 1}`;
  let rowSeq = 0;
  const domains = THAI_DUONG.year.domains.map((d, i) => ({
    id: `${id}-${YEAR_DOMAINS[i].key}`,
    key: YEAR_DOMAINS[i].key,
    roman: d.roman,
    name: d.name,
    rows: d.rows.map((r) =>
      r.type === 'goal'
        ? {
            id: `${id}-g${r.no}`,
            type: 'goal',
            text: r.text,
            contents: r.contents.map((c, k) => ({ id: `${id}-g${r.no}-c${k + 1}`, text: c.text, themes: c.themes.map(themeId) })),
          }
        : { id: `${id}-r${(rowSeq += 1)}`, type: r.type, text: r.text },
    ),
  }));
  const themes = THAI_DUONG.year.themes.map((t, i) => ({
    id: `${id}-t${i + 1}`,
    abbr: t.abbr,
    name: t.name,
    festivals: t.festivals.join('; '),
    startDate: addDays(t.start, shift),
    endDate: addDays(t.end, shift),
    note: shift ? NOTES_2627[t.abbr] || '' : t.note,
  }));
  const issuedAt = shift ? '2026-09-01 15:00' : '2025-09-01 15:00';
  const startedAt = shift ? '2026-08-12 09:00' : '2025-08-12 09:00';
  return {
    id,
    schoolYear,
    ageGroupId: AG,
    status: 'APPROVED',
    domains,
    themes,
    breaks: BREAKS[schoolYear],
    domainOwners: { [`${id}-TC`]: 'u_ha', [`${id}-NT`]: 'u_ha', [`${id}-NN`]: 'u_lan', [`${id}-TX`]: 'u_lan', [`${id}-TM`]: 'u_ha' },
    builders: [textSig('u_lan', issuedAt), textSig('u_ha', issuedAt)],
    issued: textSig('u_lan', issuedAt),
    history: [
      entry('u_lan', 'Tạo kế hoạch năm học', startedAt),
      entry('u_ha', 'Gửi Phó hiệu trưởng ban hành', addDays(issuedAt.slice(0, 10), -3) + ' 16:30'),
      entry('u_lan', 'Ký và ban hành kế hoạch', issuedAt, 'ok'),
    ],
  };
};

/** Tiêu đề hoạt động học: bỏ phần "1. Hoạt động học:" ở đầu (nhãn dòng đã cố định). */
const stepTitle = (t) => t.replace(/^\s*1\.\s*Hoạt động học\s*:?\s*/i, '').trim();

const buildClassDocs = (plan, { classId, teachers, approvedWeeks, pending }) => {
  const weeks = yearWeeks(plan).filter((w) => w.type === 'week');
  const names = Object.fromEntries(weeks.map((w, i) => [w.start, THAI_DUONG.branches[i]?.name || '']));
  const [first, second] = teachers;
  const branch = {
    ...emptyBranchPlan({ classId, yearPlanId: plan.id }),
    names,
    status: 'APPROVED',
    history: [entry(first, 'Gửi duyệt', '2026-09-03 16:00'), entry('u_lan', 'Phó hiệu trưởng duyệt', '2026-09-04 10:00', 'ok')],
  };

  const mn = plan.themes[0];
  const goalId = (no) => `${plan.id}-g${no}`;
  const theme = {
    ...emptyThemePlan({ classId, yearPlanId: plan.id, themeId: mn.id }),
    rows: Object.fromEntries(THAI_DUONG.topicMN.rows.map((r) => [goalId(r.goalNo), { contents: r.contents, activities: r.activities }])),
    envIn: THAI_DUONG.topicMN.envIn,
    envOut: THAI_DUONG.topicMN.envOut,
    status: 'APPROVED',
    history: [entry(first, 'Gửi duyệt', '2026-09-03 16:10'), entry('u_lan', 'Phó hiệu trưởng duyệt', '2026-09-04 10:05', 'ok')],
  };

  const weekDocs = THAI_DUONG.weeksMN.map((src, i) => {
    const w = weeks[i];
    const base = emptyWeekPlan({
      classId,
      yearPlanId: plan.id,
      weekStart: w.start,
      weekNo: w.no,
      themeId: mn.id,
      branchName: names[w.start],
    });
    const sentAt = `${addDays(w.start, -3)} 16:00`;
    const doc = {
      ...base,
      aims: src.aims,
      prep: src.prep,
      grid: src.grid,
      days: src.days.map((d, k) => ({
        ...base.days[k],
        assigneeId: k % 2 === 0 ? first : second || first,
        aims: d.aims,
        prep: d.prep,
        steps: {
          hoc: { ...d.steps[0], title: stepTitle(d.steps[0].title) },
          ngoai_troi: { ...d.steps[1], title: '' },
          chieu: { ...d.steps[2], title: '' },
        },
        evaluation: d.evaluation,
        adjustment: d.adjustment,
      })),
    };
    if (i < approvedWeeks) {
      return {
        ...doc,
        status: 'APPROVED',
        approvedBy: textSig('u_lan', `${addDays(w.start, -1)} 09:00`),
        history: [
          entry(first, 'Gửi duyệt giáo án tuần', sentAt),
          entry('u_lan', 'Phó hiệu trưởng duyệt', `${addDays(w.start, -1)} 09:00`, 'ok'),
        ],
      };
    }
    const skippedTl = pending === 'PENDING_VP';
    return {
      ...doc,
      status: pending,
      history: [
        entry(
          first,
          skippedTl ? 'Gửi duyệt giáo án tuần (tổ trưởng là giáo viên của lớp nên chuyển thẳng Phó HT)' : 'Gửi duyệt giáo án tuần',
          sentAt,
        ),
      ],
    };
  });

  return { branch, theme, weeks: weekDocs };
};

export const buildSeedClassPlans = () => {
  const old = buildYearPlan('2025-2026', 0);
  const current = buildYearPlan('2026-2027', SHIFT);
  // Lớp Mầm 1 điểm 1: 2 giáo viên, trong đó có tổ trưởng → giáo án đi thẳng Phó HT.
  const a = buildClassDocs(current, { classId: 'cls_c1_m1', teachers: ['u_an', 'u_ha'], approvedWeeks: 2, pending: 'PENDING_VP' });
  // Lớp Mầm 1 điểm 2: tuần 3 chờ tổ trưởng duyệt.
  const b = buildClassDocs(current, { classId: 'cls_c2_m1', teachers: ['u_tuan'], approvedWeeks: 2, pending: 'PENDING_TL' });
  return {
    eduYearPlans: [current, old],
    eduBranchPlans: [a.branch, b.branch],
    eduThemePlans: [a.theme, b.theme],
    eduWeekPlans: [...a.weeks, ...b.weeks],
  };
};
