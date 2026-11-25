import { monthEnd, monthsBetween, periodLabel, weekEnd, weeksBetween } from '@/utils/assessment/assessmentPeriods';

export function developmentPeriods(scope, year, today) {
  const start = year?.startDate;
  const end = year?.endDate;
  if (!start || !end || start > end || today < start) return [];
  const until = end < today ? end : today;
  const clampStart = (day) => (day < start ? start : day);
  const clampEnd = (day) => (day > end ? end : day);
  if (scope === 'YEAR') return [{ start, end, label: periodLabel('YEAR', start, end) }];
  if (scope === 'SEMESTER')
    return [
      { start: year.semester1Start, end: year.semester1End, label: 'Học kỳ I' },
      { start: year.semester2Start, end: year.semester2End, label: 'Học kỳ II' },
    ]
      .filter((p) => p.start && p.end && p.start <= p.end && p.start >= start && p.end <= end && p.start <= today)
      .reverse();
  if (scope === 'MONTH')
    return monthsBetween(start, until)
      .map((m) => ({ start: clampStart(m), end: clampEnd(monthEnd(m)), label: periodLabel('MONTH', m) }))
      .reverse();
  return weeksBetween(start, until)
    .map((w) => ({ start: clampStart(w), end: clampEnd(weekEnd(w)), label: periodLabel('WEEK', w, weekEnd(w)) }))
    .filter((p) => p.start <= p.end)
    .reverse();
}
