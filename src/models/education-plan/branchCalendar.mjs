import { addDays, yearWeeks } from './classPlan.js';
import { durationRangeIssue } from './goalTable.js';

export function calendarDurationIssue(doc, plan) {
  const limits = doc?.durationPolicySnapshot;
  if (limits?.mode !== 'BOUNDED') return null;
  for (const schedule of doc.themeSchedules || []) {
    const theme = (plan.themes || []).find((t) => String(t.id) === String(schedule.themeId));
    const issue = durationRangeIssue({ start: schedule.startDate, end: schedule.endDate }, plan.breaks || [], limits.theme, `Chủ đề "${theme?.name || ''}"`);
    if (issue) return issue;
  }
  for (const branch of doc.branches || []) {
    const issue = durationRangeIssue({ start: branch.startDate, end: branch.endDate }, plan.breaks || [], limits.branch, `Nhánh "${branch.name || ''}"`);
    if (issue) return issue;
  }
  return null;
}

export const calendarPlan = (plan, doc) => ({
  ...plan,
  themes: (plan.themes || []).map((t) => {
    const schedule = doc?.themeSchedules?.find((s) => String(s.themeId) === String(t.id));
    return schedule ? { ...t, start: schedule.startDate, end: schedule.endDate } : t;
  }),
});
export const teachingWeeks = (plan, doc) => yearWeeks(calendarPlan(plan, doc)).filter((w) => w.type === 'week');
export const branchWeeks = (branch, plan, doc) =>
  teachingWeeks(plan, doc).filter(
    (w) => String(w.theme.id) === String(branch.themeId) && w.start >= branch.startDate && w.end <= branch.endDate,
  );
export function branchDisplayRows(plan, doc) {
  const rows = yearWeeks(calendarPlan(plan, doc));
  const seen = new Set();
  const branchOf = (row) => (doc.branches || []).find((branch) =>
    String(branch.themeId) === String(row.theme.id) && row.start >= branch.startDate && row.start <= branch.endDate);
  return rows.filter((row, index) => {
    if (row.type !== 'week') return true;
    const branch = branchOf(row);
    if (branch) {
      if (seen.has(branch.key)) return false;
      seen.add(branch.key);
      return true;
    }
    const previous = rows[index - 1];
    return !previous || previous.type !== 'week' || String(previous.theme.id) !== String(row.theme.id) || !!branchOf(previous);
  });
}
export function projectCalendar(doc, plan) {
  const names = {},
    notes = {};
  for (const b of doc.branches || [])
    branchWeeks(b, plan, doc).forEach((w, i) => {
      names[w.start] = b.name;
      notes[w.start] = b.weekNotes?.[i] || '';
    });
  return { ...doc, names, notes };
}
export function adaptCalendar(doc, plan) {
  if (doc.schemaVersion === 2) return projectCalendar(doc, plan);
  return projectCalendar(
    {
      ...doc,
      schemaVersion: 2,
      themeSchedules: (plan.themes || []).map((t) => ({ themeId: t.id, startDate: t.start, endDate: t.end })),
      branches: teachingWeeks(plan)
        .filter((w) => doc.names?.[w.start]?.trim() || doc.notes?.[w.start]?.trim())
        .map((w) => ({
          key: crypto.randomUUID(),
          themeId: w.theme.id,
          sourceTemplateId: null,
          name: doc.names?.[w.start] || '',
          startDate: w.start,
          endDate: w.end,
          weekNotes: { 0: doc.notes?.[w.start] || '' },
        })),
    },
    plan,
  );
}
export function updateWeek(doc, plan, field, monday, value) {
  const adapted = adaptCalendar(doc, plan);
  const b = adapted.branches.find((item) => branchWeeks(item, plan, adapted).some((w) => w.start === monday));
  if (!b) {
    const week = teachingWeeks(plan, adapted).find((w) => w.start === monday);
    if (!week) return adapted;
    return projectCalendar(
      {
        ...adapted,
        branches: [
          ...adapted.branches,
          {
            key: crypto.randomUUID(),
            themeId: week.theme.id,
            sourceTemplateId: null,
            name: field === 'names' ? value : '',
            startDate: week.start,
            endDate: week.end,
            weekNotes: field === 'notes' ? { 0: value } : {},
          },
        ],
      },
      plan,
    );
  }
  const offset = branchWeeks(b, plan, adapted).findIndex((w) => w.start === monday);
  return projectCalendar(
    {
      ...adapted,
      branches: adapted.branches.map((item) =>
        item.key !== b.key
          ? item
          : field === 'names'
            ? { ...item, name: value }
            : { ...item, weekNotes: { ...item.weekNotes, [offset]: value } },
      ),
    },
    plan,
  );
}
export function resizeBranch(doc, plan, key, startDate, endDate) {
  const branches = doc.branches.map((b) => (b.key === key ? { ...b, startDate, endDate } : b));
  const selected = branches.find((b) => b.key === key);
  const schedule = doc.themeSchedules.find((t) => String(t.themeId) === String(selected.themeId));
  if (
    !startDate ||
    !endDate ||
    new Date(startDate + 'T00:00:00Z').getUTCDay() !== 1 ||
    new Date(endDate + 'T00:00:00Z').getUTCDay() !== 5 ||
    startDate > endDate ||
    startDate < schedule.startDate ||
    endDate > schedule.endDate
  )
    throw Error('Nhánh phải trọn tuần Thứ Hai–Thứ Sáu và nằm trong chủ đề.');
  if (branches.some((b) => b.key !== key && b.startDate <= endDate && b.endDate >= startDate))
    throw Error('Thời gian bị trùng với nhánh khác.');
  return projectCalendar({ ...doc, branches }, plan);
}
// BE giả cho FR-017: API thật dùng calendar-preview, không tính lịch tại UI.
export function reorderCalendar(doc, plan, order) {
  const base = adaptCalendar(doc, plan);
  const schedules = base.themeSchedules;
  if (
    order.length !== schedules.length ||
    new Set(order.map(String)).size !== schedules.length ||
    order.some((id) => !schedules.some((t) => String(t.themeId) === String(id)))
  )
    throw Error('Danh sách chủ đề không hợp lệ.');
  const weeks = teachingWeeks(plan, base).sort((a, b) => a.start.localeCompare(b.start));
  if (schedules.some((s) => !s.startDate || !s.endDate)) throw Error('Chọn đủ ngày cho các chủ đề trước khi đổi thứ tự.');
  let offset = 0;
  const maps = new Map();
  const nextSchedules = order.map((id) => {
    const old = weeks.filter((w) => String(w.theme.id) === String(id));
    const next = weeks.slice(offset, offset + old.length);
    offset += old.length;
    if (!old.length || next.length !== old.length) throw Error('Chủ đề chưa có tuần học.');
    const value = { themeId: id, startDate: next[0].start, endDate: next.at(-1).end };
    const rangeWeeks = yearWeeks({
      ...plan,
      themes: [{ ...plan.themes.find((t) => String(t.id) === String(id)), start: value.startDate, end: value.endDate }],
    }).filter((w) => w.type === 'week');
    if (rangeWeeks.length !== old.length) throw Error('Khoảng trống lịch không cho phép đổi thứ tự mà giữ số tuần. Hãy chỉnh ngày trước.');
    maps.set(String(id), { old, next });
    return value;
  });
  const branches = base.branches.map((b) => {
    const { old, next } = maps.get(String(b.themeId));
    const starts = old.findIndex((w) => w.start === b.startDate),
      ends = old.findIndex((w) => w.end === b.endDate);
    if (starts < 0 || ends < starts) throw Error('Hoàn thiện ngày nhánh trước khi đổi thứ tự.');
    return { ...b, startDate: next[starts].start, endDate: addDays(next[ends].start, 4) };
  });
  return projectCalendar({ ...base, themeSchedules: nextSchedules, branches }, plan);
}

export const calendarPayload = (doc) => ({ schemaVersion: 2, themeSchedules: doc.themeSchedules || [], branches: doc.branches || [] });

export function takeTemplate(doc, plan, template) {
  const schedule = doc.themeSchedules.find((s) => String(s.themeId) === String(template.themeId));
  if (!schedule) throw Error('Không tìm thấy chủ đề của mẫu.');
  const parent = plan.themes.find((t) => String(t.id) === String(template.themeId));
  const firstFree = teachingWeeks(plan, doc).find(
    (w) => String(w.theme.id) === String(template.themeId) && !doc.branches.some((b) => w.start >= b.startDate && w.start <= b.endDate),
  );
  if (!firstFree) throw Error('Chủ đề đã đủ nhánh cho các tuần học. Hãy chỉnh hoặc bỏ nhánh đang có.');
  const delta = Math.round((Date.parse(schedule.startDate) - Date.parse(parent.start)) / 86400000);
  const startDate = template.startDate ? addDays(template.startDate, delta) : firstFree.start;
  const endDate = template.endDate ? addDays(template.endDate, delta) : firstFree.end;
  if (doc.branches.some((b) => b.startDate <= endDate && b.endDate >= startDate))
    throw Error('Mẫu trùng lịch nhánh đang có. Hãy chỉnh hoặc bỏ nhánh đó trước.');
  return projectCalendar(
    {
      ...doc,
      branches: [
        ...doc.branches,
        {
          key: crypto.randomUUID(),
          themeId: template.themeId,
          sourceTemplateId: template.id,
          name: template.name,
          startDate,
          endDate,
          weekNotes: {},
        },
      ],
    },
    plan,
  );
}

export function seedTeamBranchTemplates(doc, plan) {
  if (doc.branches?.length) return doc;
  return (plan.branchTemplates || []).filter((template) => template.startDate && template.endDate)
    .reduce((calendar, template) => takeTemplate(calendar, plan, template), doc);
}
