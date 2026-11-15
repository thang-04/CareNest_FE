export const goalDisplayLabel = (row, number) => row.displayLabel?.trim() || (number ? `MT${number}` : '—');

// Dòng kéo điền STT được: mục tiêu đã có tên, hoặc mới gõ STT trước khi gõ tên
export const isLabelGoal = (r) => r.kind === 'goal' && Boolean(r.text.trim() || r.displayLabel?.trim());

export const fillGoalLabels = (domains, sourceId, targetId, numbers) => {
  const goals = domains.flatMap((d) => d.rows.filter(isLabelGoal));
  const source = goals.findIndex((r) => r.id === sourceId);
  const target = goals.findIndex((r) => r.id === targetId);
  if (source < 0 || target < 0 || source === target) return domains;
  const label = goalDisplayLabel(goals[source], numbers[sourceId]);
  const match = label.match(/^(.*?)(\d+)(\D*)$/u);
  const labels = new Map();
  for (let i = Math.min(source, target); i <= Math.max(source, target); i++) {
    let next = label;
    if (match) {
      const value = BigInt(match[2]) + BigInt(i - source);
      const digits = (value < 0n ? -value : value).toString().padStart(match[2].length, '0');
      next = `${match[1]}${value < 0n ? '-' : ''}${digits}${match[3]}`;
    }
    if (next.length > 100) throw new RangeError('Nhãn mục tiêu tối đa 100 ký tự.');
    labels.set(goals[i].id, next);
  }
  return domains.map((d) => ({ ...d, rows: d.rows.map((r) => (labels.has(r.id) ? { ...r, displayLabel: labels.get(r.id) } : r)) }));
};
