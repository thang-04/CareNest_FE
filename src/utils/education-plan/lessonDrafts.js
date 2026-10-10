import { COMPETENCIES, EDU_STATUS, QUALITIES, STEP_TEMPLATE, slotsFor, themeCodes } from '@/models/education-plan/educationPlanConstants';
import { daysOf } from '@/components/education-plan/lessonShared';

const uid = () => Math.random().toString(36).slice(2, 9);
const isEmptyText = (s) => !s || !s.trim();
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Giờ sinh hoạt soạn chi tiết (mục đích, chuẩn bị, các bước); các giờ khác chỉ cần đề tài và mã. */
export const CORE_SLOT = 'Hoạt động học';

export const emptyDaySlot = (name = '', duration = '') => ({
  id: uid(),
  name,
  duration,
  topic: '',
  codes: [],
  purpose: '',
  skills: '',
  qualities: [...QUALITIES],
  competencies: [...COMPETENCIES],
  prepTeacher: '',
  prepChild: '',
  steps: name === CORE_SLOT ? STEP_TEMPLATE.map((title) => ({ id: uid(), title, teacher: '', child: '' })) : [],
});

/** Câu YCCĐ của các mã đã chọn, dùng điền sẵn ô "Mục đích" (giáo án thật ghi mục đích bám đúng câu YCCĐ). */
export const purposeFromCodes = (codes, theme) => {
  const options = themeCodes(theme);
  return codes
    .map((c) => options.find((o) => o.code === c))
    .filter((o) => o?.text)
    .map((o) => `- ${o.text} (${o.code})`)
    .join('\n');
};

/** Nội dung giáo dục của chủ đề theo mã, dùng gợi ý hoạt động cho ô kế hoạch tuần. */
export const contentFromCodes = (codes, theme) => {
  const rows = theme?.rows || [];
  const seen = new Set();
  return codes
    .map((c) => rows.find((r) => r.code === c)?.content?.trim())
    .filter((t) => t && !seen.has(t) && seen.add(t))
    .join('\n');
};

/** Điền đề tài, mã và mục đích của từng thời điểm trong ngày từ kế hoạch tuần (chỉ điền ô còn trống). */
export const fromWeekPlan = (slots, wp, date, theme) =>
  slots.map((s) => {
    const src = wp.slots.find((x) => sameName(x.name, s.name));
    if (!src) return s;
    const cell = src.allWeek ? src.all : src.cells?.[date];
    if (!cell || isEmptyText(cell.text) || !isEmptyText(s.topic)) return s;
    const codes = s.codes.length ? s.codes : cell.codes || [];
    const purpose = isEmptyText(s.purpose) && s.name === CORE_SLOT ? purposeFromCodes(codes, theme) : s.purpose;
    return { ...s, topic: cell.text, codes, purpose };
  });

export const daySlotsFor = (ageGroupId) =>
  slotsFor(ageGroupId)
    .filter((s) => s.name !== 'Trả trẻ')
    .map((s) => emptyDaySlot(s.name, s.duration));

/** Kế hoạch ngày nháp cho các ngày trong tuần lớp chưa có kế hoạch ngày, lấy nội dung từ kế hoạch tuần. */
export function dayDraftsFromWeek(week, theme, lessons, createdBy) {
  const taken = new Set(
    lessons.filter((l) => l.type === 'day' && l.classId === week.classId && l.status !== EDU_STATUS.REJECTED).map((l) => l.date),
  );
  return daysOf(week.weekStart)
    .filter((d) => !taken.has(d.date))
    .map((d) => ({
      id: `l-${uid()}`,
      code: `KHN-${week.classId.replace('c-', '').toUpperCase()}-${d.date.slice(5).replace('-', '')}`,
      type: 'day',
      themeId: week.themeId,
      classId: week.classId,
      ageGroupId: week.ageGroupId,
      weekIndex: week.weekIndex,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      branch: week.branch,
      date: d.date,
      slots: fromWeekPlan(daySlotsFor(week.ageGroupId), week, d.date, theme),
      dayNotes: {},
      weekReview: '',
      dayReview: '',
      adjust: '',
      signature: null,
      status: EDU_STATUS.DRAFT,
      createdBy,
      history: [],
    }));
}
