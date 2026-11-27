export const ABSENT_TODAY_HINT = 'Trẻ vắng hôm nay (điểm danh). Nhập khi trẻ có mặt.';

export function nextRosterChild(rows, currentId, results) {
  rows ||= [];
  const index = rows.findIndex((row) => String(row.childId) === String(currentId));
  const ordered = [...rows.slice(index + 1), ...rows.slice(0, Math.max(index, 0))];
  return ordered.find((row) => row.canEdit && !row.absentToday && !row.movedTo && results.includes(row.result)) ?? null;
}
