import { addDays, todayIso, yearWeeks } from '@/models/education-plan/classPlan';
import { eduError } from './eduMockErrors';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameList = (a, b) => same(a || [], b || []);
const keys = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])];
const future = (date, today) => {
  if (!date || date <= today) throw eduError('CLASS_DOC_LOCKED');
};
const content = (doc = {}) => {
  const result = { ...doc };
  for (const field of ['id', 'kind', 'classId', 'yearPlanId', 'themeId', 'weekStart', 'version', 'dossierVersion', 'status', 'approvals', 'history', 'permissions', 'review', 'superseded', 'sourceDocKey', 'adjustments', 'authorIds', 'createdBy', 'updatedBy', 'waitingRole', 'reviewRound', 'completionMode', 'completionPolicy', 'completedAt', 'printSnapshot', 'durationPolicySnapshot', 'calendarRevision', 'orderedThemeIds']) delete result[field];
  return result;
};

// BE:EDU-64 — fake backend giữ cùng giới hạn ngày và phạm vi hồ sơ với service thật.
export const hasFutureClassContent = (kind, doc, plan, today = todayIso()) => {
  if (kind === 'week') return !!doc.weekStart && addDays(doc.weekStart, 4) > today;
  if (kind === 'theme') return (plan?.themes || []).some((theme) => theme.id === doc.themeId && theme.start > today);
  return yearWeeks(plan || {}).some((week) => week.type === 'week' && week.start > today);
};

export function validateFutureClassEdit(kind, current, incoming, plan, today = todayIso()) {
  const before = content(current);
  const after = content(incoming);
  if (same(before, after)) return [];
  if (kind === 'theme') {
    future(plan?.themes?.find((theme) => theme.id === incoming.themeId)?.start, today);
    return [incoming.themeId];
  }
  if (kind === 'week') {
    const start = incoming.weekStart;
    if (!start) throw eduError('CLASS_DOC_LOCKED');
    if (after.days !== undefined && (!Array.isArray(after.days) || after.days.length > 5 || after.days.some((day, i) => day.date !== addDays(start, i)))) throw eduError('CLASS_DOC_LOCKED');
    for (const field of ['grid', 'picks', 'unlinked']) if (after[field] !== undefined && (!after[field] || typeof after[field] !== 'object' || Array.isArray(after[field]))) throw eduError('CLASS_DOC_LOCKED');
    if (after.dayGoals !== undefined && (!Array.isArray(after.dayGoals) || after.dayGoals.length > 5)) throw eduError('CLASS_DOC_LOCKED');
    if (start <= today) {
      for (let i = 0; i < 5; i++) {
        if (!same(before.days?.[i], after.days?.[i])) {
          future(addDays(start, i), today);
          if (after.days?.[i]?.date !== addDays(start, i)) throw eduError('CLASS_DOC_LOCKED');
        }
        if (!sameList(before.dayGoals?.[i], after.dayGoals?.[i])) future(addDays(start, i), today);
      }
      if (after.days?.length > 5 || after.dayGoals?.length > 5) throw eduError('CLASS_DOC_LOCKED');
      for (const field of ['picks', 'unlinked']) {
        for (const key of keys(before[field], after[field])) {
          if (sameList(before[field]?.[key], after[field]?.[key])) continue;
          const day = key.slice(key.lastIndexOf('.') + 1);
          if (!/^[0-4]$/.test(day)) throw eduError('CLASS_DOC_LOCKED');
          future(addDays(start, Number(day)), today);
        }
      }
      for (const row of keys(before.grid, after.grid)) {
        const oldRow = { ...before.grid?.[row] };
        const newRow = { ...after.grid?.[row] };
        for (let i = 0; i < 5; i++) if (!same(oldRow.days?.[i], newRow.days?.[i])) future(addDays(start, i), today);
        if (newRow.days?.length > 5) throw eduError('CLASS_DOC_LOCKED');
        delete oldRow.days;
        delete newRow.days;
        if (!same(oldRow, newRow)) throw eduError('CLASS_DOC_LOCKED');
      }
      for (const field of ['days', 'grid', 'dayGoals', 'picks', 'unlinked']) {
        delete before[field];
        delete after[field];
      }
      if (!same(before, after)) throw eduError('CLASS_DOC_LOCKED');
    }
    return [incoming.themeId];
  }
  const weeks = yearWeeks(plan).filter((week) => week.type === 'week');
  const affected = new Set();
  for (const field of ['names', 'notes']) {
    for (const date of keys(before[field], after[field])) {
      if (same(before[field]?.[date], after[field]?.[date])) continue;
      future(date, today);
      const week = weeks.find((item) => item.start === date);
      if (!week) throw eduError('CLASS_DOC_LOCKED');
      affected.add(week.theme.id);
    }
  }
  const oldBranches = Object.fromEntries((before.branches || []).map((branch) => [branch.key, branch]));
  const newBranches = Object.fromEntries((after.branches || []).map((branch) => [branch.key, branch]));
  for (const key of keys(oldBranches, newBranches)) {
    if (same(oldBranches[key], newBranches[key])) continue;
    for (const branch of [oldBranches[key], newBranches[key]].filter(Boolean)) {
      if (!weeks.some((week) => week.theme.id === branch.themeId)) throw eduError('CLASS_DOC_LOCKED');
      future(branch.startDate || weeks.find((week) => week.theme.id === branch.themeId)?.start, today);
      affected.add(branch.themeId);
    }
  }
  for (const field of ['names', 'notes', 'branches']) {
    delete before[field];
    delete after[field];
  }
  if (!same(before, after)) {
    if (!weeks.length) throw eduError('CLASS_DOC_LOCKED');
    weeks.forEach((week) => { future(week.start, today); affected.add(week.theme.id); });
  }
  return [...affected];
}
