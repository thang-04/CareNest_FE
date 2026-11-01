export const branchPayload = (draft, pending) =>
  draft && {
    ...draft,
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
    names[match.weekStart] = match.name;
    delete nextPending[match.weekStart];
  }
  return { draft: { ...draft, names }, pending: nextPending };
}
