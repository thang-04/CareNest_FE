import { DEFAULT_CUTOFF_TIME, SCHOOL_TIME_ZONE } from '@/models/attendance/attendanceConstants';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isValidTime = (value) => TIME_RE.test(String(value || ''));

/** Current date and time on the school clock (Vietnam time, GBR-CFG-02): { date: 'yyyy-mm-dd', time: 'HH:mm' }. */
export const schoolNow = (now = new Date()) => {
  // sv-SE formats as "yyyy-mm-dd HH:mm:ss".
  const text = now.toLocaleString('sv-SE', { timeZone: SCHOOL_TIME_ZONE, hour12: false });
  const [date, time] = text.split(' ');
  return { date, time: time.slice(0, 5) };
};

export const schoolToday = () => schoolNow().date;

/** Assumption until the school calendar exists: Monday–Friday are school days. */
export const isSchoolDay = (date) => {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day !== 0 && day !== 6;
};

/** A day is locked once its cut-off has passed (GBR-ATT-02, GBR-ATT-04). */
export const isDayLocked = (date, cutoff = DEFAULT_CUTOFF_TIME, now = schoolNow()) =>
  date < now.date || (date === now.date && now.time >= cutoff);

export const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Inclusive list of school days between two dates. */
export const schoolDaysBetween = (from, to) => {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (isSchoolDay(d)) days.push(d);
  return days;
};

/** Last n school days up to and including `date`. */
export const previousSchoolDays = (date, n) => {
  const days = [];
  for (let d = date; days.length < n; d = addDays(d, -1)) if (isSchoolDay(d)) days.unshift(d);
  return days;
};

export const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
