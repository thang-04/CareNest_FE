import { formatTemperature, symptomLabels } from '@/utils/dailyHealthValidation';
import { temperatureLevel } from '@/utils/attendance/temperatureLevels';

/**
 * Thẻ trên dòng trẻ theo lần ghi nhận mới nhất (một thẻ ngắn): "39 °C · Sốt rất cao" / "37 °C · Cần chú ý" / "Cần chú ý" / "36,8 °C".
 * full = nội dung đầy đủ cho tooltip (mức, biểu hiện, ghi chú); chi tiết xem ở khung sức khỏe bên phải.
 */
export const healthFlag = (latest, full = false) => {
  if (!latest) return '';
  const noted = latest.observation === 'NOTED';
  const level = temperatureLevel(latest.temperature);
  const temp = Number.isFinite(latest.temperature) ? formatTemperature(latest.temperature) : '';
  if (!full) {
    // Mức thân nhiệt khác bình thường thì ghi tên mức, ngược lại "Cần chú ý" khi cô chọn Có dấu hiệu
    const tag = level?.chip ? level.label : noted ? 'Cần chú ý' : '';
    return [temp, tag].filter(Boolean).join(' · ');
  }
  const parts = noted ? ['Cần chú ý'] : [];
  if (temp) parts.push(`${temp}${level?.chip ? ` ${level.label}` : ''}`);
  const signs = symptomLabels(latest.symptoms);
  if (signs) parts.push(signs);
  if (latest.note) parts.push(latest.note);
  return parts.join(' · ');
};

/** Màu thẻ: theo mức thân nhiệt; có dấu hiệu mà thân nhiệt bình thường / thấp / chưa đo thì đỏ; không dấu hiệu, bình thường thì xám. */
export const flagTone = (latest) => {
  const level = temperatureLevel(latest?.temperature);
  if (level?.chip && level.key !== 'LOW') return level.chip.replace('chip--', '');
  if (latest?.observation === 'NOTED') return 'red';
  return level?.chip?.replace('chip--', '') || 'gray';
};

// Nhắc bổ sung số đo sau khi điểm danh Có mặt đã được lưu; không kết luận khi thiếu dữ liệu sức khỏe.
export const healthReminder = ({ record, healthSummary }) => {
  if (record?.status !== 'PRESENT') return '';
  if (healthSummary?.reminder) return healthSummary.reminder;
  if (healthSummary?.checked && healthSummary.latest && !Number.isFinite(healthSummary.latest.temperature)) return 'Chưa đo thân nhiệt';
  return '';
};
