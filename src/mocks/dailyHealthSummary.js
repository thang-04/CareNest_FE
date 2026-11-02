/**
 * Tóm tắt sức khỏe trong ngày của một trẻ cho danh sách điểm danh.
 * noted: lần ghi nhận mới nhất là "Có dấu hiệu cần lưu ý" (giáo viên đánh giá, hệ thống không tự suy từ thân nhiệt).
 */
import { needsAttention } from '@/utils/attendance/temperatureLevels';

const summaryOf = ({ entryCount, latest }) => ({
  entryCount,
  checked: entryCount > 0,
  // Nhãn "Chưa khám" khi trong ngày chưa có lần ghi nhận nào
  reminder: entryCount > 0 ? null : 'Chưa khám',
  noted: latest?.observation === 'NOTED',
  // Cần chú ý: cô chọn "Có dấu hiệu" hoặc thân nhiệt lần mới nhất từ mức "Sốt nhẹ" trở lên
  flagged: latest?.observation === 'NOTED' || needsAttention(latest?.temperature),
  latest,
});

export function dailyHealthSummary(entries) {
  const latest = [...entries].sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''))[0] || null;
  return summaryOf({
    entryCount: entries.length,
    latest: latest
      ? { observation: latest.observation, temperature: latest.temperature, symptoms: latest.symptoms || [], note: latest.note || '' }
      : null,
  });
}

/** Từ `health` BE trả ở bảng điểm danh (lần ghi nhận mới nhất trong ngày). */
export function dailyHealthSummaryFromBe(health) {
  // BE không trả health (bản cũ) thì không kết luận "Chưa khám"
  if (!health) return { entryCount: null, checked: null, reminder: null, noted: false, flagged: false, latest: null };
  if (!health.checked) return summaryOf({ entryCount: 0, latest: null });
  const temperature = health.temperature === null || health.temperature === undefined ? null : Number(health.temperature);
  return summaryOf({
    entryCount: health.entryCount,
    latest: { observation: health.observation, temperature, symptoms: health.symptoms || [], note: health.note || '' },
  });
}
