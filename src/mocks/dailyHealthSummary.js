export function dailyHealthSummary(entries) {
  return {
    entryCount: entries.length,
    reminder: !entries.length
      ? 'Chưa ghi nhận sức khỏe'
      : entries.some((entry) => Number.isFinite(entry.temperature))
        ? null
        : 'Chưa ghi thân nhiệt',
  };
}
