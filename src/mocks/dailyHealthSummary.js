/**
 * Tóm tắt sức khỏe trong ngày của một trẻ cho danh sách điểm danh.
 * noted: lần ghi nhận mới nhất là "Có dấu hiệu cần lưu ý" (giáo viên đánh giá, hệ thống không tự suy từ thân nhiệt).
 */
import { needsAttention } from '@/utils/attendance/temperatureLevels';

export function dailyHealthSummary(entries) {
  const latest = [...entries].sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''))[0] || null;
  return {
    entryCount: entries.length,
    reminder: !entries.length
      ? 'Chưa ghi nhận sức khỏe'
      : entries.some((entry) => Number.isFinite(entry.temperature))
        ? null
        : 'Chưa ghi thân nhiệt',
    noted: latest?.observation === 'NOTED',
    // Cần chú ý: cô chọn "Có dấu hiệu" hoặc thân nhiệt lần mới nhất từ mức "Sốt nhẹ" trở lên
    flagged: latest?.observation === 'NOTED' || needsAttention(latest?.temperature),
    latest: latest
      ? { observation: latest.observation, temperature: latest.temperature, symptoms: latest.symptoms || [], note: latest.note || '' }
      : null,
  };
}
