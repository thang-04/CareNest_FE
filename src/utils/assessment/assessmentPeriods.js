/* Pure date / period helpers for the assessment module (dates are local yyyy-mm-dd strings). */
import { slotsFor } from '@/models/education-plan/educationPlanConstants';
import { NON_ASSESSED_SLOT_KEYWORDS, PERIOD_TYPE } from '@/models/assessment/assessmentConstants';

const pad = (n) => String(n).padStart(2, '0');
const toDate = (s) => new Date(`${s}T00:00:00`);
export const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayIso = () => toIso(new Date());

export const addDays = (s, n) => {
  const d = toDate(s);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

export const isSchoolDay = (s) => ![0, 6].includes(toDate(s).getDay());

/** Monday of the week containing the date. */
export const weekStart = (s) => {
  const day = toDate(s).getDay();
  return addDays(s, day === 0 ? -6 : 1 - day);
};
/** Friday of the week (school week). */
export const weekEnd = (s) => addDays(weekStart(s), 4);

export const monthStart = (s) => `${s.slice(0, 7)}-01`;
export const monthEnd = (s) => {
  const d = toDate(monthStart(s));
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return toIso(d);
};

/** School year '2026-2027' -> 01/09/2026 – 31/05/2027 (assumption: the SRS does not fix the dates). */
export const schoolYearRange = (schoolYear) => {
  const [y1, y2] = String(schoolYear || '').split('-');
  return { start: `${y1}-09-01`, end: `${y2}-05-31` };
};

export const schoolYearOf = (date) => {
  const y = Number(date.slice(0, 4));
  return Number(date.slice(5, 7)) >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

export const schoolDaysBetween = (from, to) => {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) days.push(d);
  return days;
};

/** Mondays of every school week that overlaps [from, to]. */
export const weeksBetween = (from, to) => {
  const list = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) list.push(w);
  return list;
};

export const monthsBetween = (from, to) => {
  const list = [];
  for (let m = monthStart(from); m <= to; m = monthStart(addDays(monthEnd(m), 1))) list.push(m);
  return list;
};

/** Range of a period of the given type that starts at `start`. */
export const periodRange = (type, start, schoolYear) => {
  if (type === PERIOD_TYPE.WEEK) return { start: weekStart(start), end: weekEnd(start) };
  if (type === PERIOD_TYPE.MONTH) return { start: monthStart(start), end: monthEnd(start) };
  return schoolYearRange(schoolYear);
};

const dm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;

export const periodLabel = (type, start, end) => {
  if (type === PERIOD_TYPE.WEEK) return `Tuần ${dm(start)} – ${dm(end)}/${end.slice(0, 4)}`;
  if (type === PERIOD_TYPE.MONTH) return `Tháng ${start.slice(5, 7)}/${start.slice(0, 4)}`;
  return `Năm học ${start.slice(0, 4)} – ${end.slice(0, 4)}`;
};

/**
 * Week -> month assignment for the monthly ticket: the month that holds the Monday.
 * Assumption – GBR-REW-02 leaves the cross-month rule open.
 */
export const monthOfWeek = (monday) => monthStart(monday);

/**
 * GBR-OBS-03: the teacher may edit until the end of the next school day, then the record is locked.
 */
export const isAssessmentLocked = (date, today = todayIso()) => {
  let next = addDays(date, 1);
  while (!isSchoolDay(next)) next = addDays(next, 1);
  return today > next;
};

/** Timetable activities that can be assessed for the class age group (from the education-plan day slots). */
export const assessableActivities = (ageGroupId) =>
  slotsFor(ageGroupId)
    .map((s) => s.name)
    .filter((name) => !NON_ASSESSED_SLOT_KEYWORDS.some((k) => name.startsWith(k)));
