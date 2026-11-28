/*
 * Chỉ để hiển thị, cùng cách BE chọn giờ cho một ngày (ATT-06): giờ hẹn ngày nào áp dụng từ ngày đó, cùng ngày áp dụng
 * thì bản lưu sau thắng. `history` xếp bản lưu mới nhất trước.
 */
export const splitCutoffSchedule = (history = [], today) => {
  const byDate = new Map();
  history.forEach((entry) => {
    if (!byDate.has(entry.effectiveFrom)) byDate.set(entry.effectiveFrom, entry);
  });
  const rows = [...byDate.values()].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return {
    current: rows.filter((r) => r.effectiveFrom <= today).pop() || null,
    upcoming: rows.filter((r) => r.effectiveFrom > today),
  };
};
