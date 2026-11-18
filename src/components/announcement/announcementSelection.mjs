export const emptyAnnouncementSelection = () => ({ allMatching: false, ids: [], excludedIds: [] });

export function toggleAnnouncementSelection(selection, id) {
  const key = selection.allMatching ? 'excludedIds' : 'ids';
  const values = selection[key];
  return { ...selection, [key]: values.includes(id) ? values.filter((value) => value !== id) : [...values, id] };
}

export const announcementIsSelected = (selection, row) =>
  !!row.canDelete && (selection.allMatching ? !selection.excludedIds.includes(row.id) : selection.ids.includes(row.id));

export const announcementSelectionCount = (selection, cancelledCount) =>
  selection.allMatching ? Math.max(0, cancelledCount - selection.excludedIds.length) : selection.ids.length;

export function announcementSelectionRequest(selection, filters) {
  return { allMatching: selection.allMatching, ids: [...selection.ids], excludedIds: [...selection.excludedIds], ...filters };
}
