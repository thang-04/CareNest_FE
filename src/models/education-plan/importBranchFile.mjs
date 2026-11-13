import { addDays } from './classPlan.js';
export const branchPayload = (draft, pending) =>
  draft && {
    ...draft,
    ...(draft.schemaVersion === 2
      ? {
          branches: draft.branches.map((b) => {
            const pendingWeek = Object.keys(pending).find((w) => w >= b.startDate && w <= b.endDate);
            return pendingWeek ? { ...b, name: pending[pendingWeek].prev } : b;
          }),
        }
      : {}),
    names: { ...draft.names, ...Object.fromEntries(Object.entries(pending).map(([week, value]) => [week, value.prev])) },
  };

export const branchFileChanges = (draft, preview) =>
  (preview.matches || []).map((match) => {
    const previous = draft.names[match.weekStart] || '';
    return { ...match, previous, overwrite: !!previous.trim() && previous !== match.name };
  });

export function applyBranchFile(draft, pending, preview) {
  const names = { ...draft.names };
  const nextPending = { ...pending };
  for (const match of preview.matches || []) {
    for (const week of match.weekStarts || [match.weekStart]) {
      names[week] = match.name;
      delete nextPending[week];
    }
  }
  const branches = draft.branches?.map((b) => {
    const match = (preview.matches || []).find((m) => m.branchKey === b.key || (m.weekStart >= b.startDate && m.weekStart <= b.endDate));
    return match ? { ...b, name: match.name } : b;
  });
  for (const match of preview.matches || []) {
    if (draft.schemaVersion === 2 && !branches.some((b) => match.weekStart >= b.startDate && match.weekStart <= b.endDate))
      branches.push({
        key: crypto.randomUUID(),
        themeId: match.themeId,
        sourceTemplateId: null,
        name: match.name,
        startDate: match.startDate || match.weekStart,
        endDate: match.endDate || addDays(match.weekStart, 4),
        weekNotes: {},
      });
  }
  return { draft: { ...draft, names, ...(branches ? { branches } : {}) }, pending: nextPending };
}
