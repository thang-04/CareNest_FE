import { addDays, mondayOf } from '@/utils/week';
import { formatDate, formatDateTime } from '@/utils/format';
import { ABSENCE_LABELS } from '@/models/assessment/assessmentConstants';

/*
 * Lịch sử lớp cũ của trẻ chuyển đến (BE OBS-35): chỉ chọn mục theo ngày / tuần và ghép nhãn hiển thị.
 * Không suy ra "bình thường" hay "đạt" khi thiếu dữ liệu: thiếu thì nơi dùng hiện "Chưa có dữ liệu".
 */

/** Khoảng xem một ngày (màn đánh giá ngày, điểm danh). */
export const dayRange = (date) => (date ? { from: date, to: date } : null);

/** Khoảng xem cả tuần thứ Hai..Chủ nhật của tuần đang chọn (nhận xét tuần). */
export const weekRange = (weekStart) => {
  if (!weekStart) return null;
  const monday = mondayOf(weekStart);
  return { from: monday, to: addDays(monday, 6) };
};

const dayMonth = (iso) => (iso ? formatDate(iso).slice(0, 5) : '…');

/** "Học lớp Mầm 1 từ 01/09 đến 15/10". */
export const stayText = (stay) => `Học lớp ${stay?.className || '—'} từ ${dayMonth(stay?.from)} đến ${dayMonth(stay?.to)}`;

/** "Lớp …, người ghi …, lúc …": bỏ phần BE không trả. */
export const recordedText = ({ className, name, at, nameLabel = 'người ghi' }) =>
  [className && `Lớp ${className}`, name && `${nameLabel} ${name}`, at && `lúc ${formatDateTime(at)}`].filter(Boolean).join(', ');

const ATTENDANCE_LABELS = { PRESENT: 'Có mặt', ...ABSENCE_LABELS };
export const ABSENT_PART_LABELS = { MORNING: 'Nghỉ sáng', AFTERNOON: 'Nghỉ chiều' };

/** absentPart: buổi nghỉ theo đơn nửa buổi; status là của buổi còn lại (BE ATT-13). */
export const attendanceText = (entry) => {
  const status = ATTENDANCE_LABELS[entry?.status] || entry?.status || '';
  const part = ABSENT_PART_LABELS[entry?.absentPart];
  if (!part) return status;
  return status ? `${part} · buổi còn lại: ${status.toLowerCase()}` : part;
};

/** Mục của một ngày: đánh giá ngày, điểm danh, các lần ghi sức khỏe. */
export const historyOfDate = (child, date) => ({
  day: (child?.days || []).find((d) => d?.day?.date === date) || null,
  attendance: (child?.attendance || []).filter((a) => a.date === date),
  health: (child?.health || []).filter((h) => h.date === date),
});

/** Nhận xét tuần đã gửi của tuần bắt đầu weekStart. */
export const weeklyCommentsOf = (child, weekStart) => (child?.weeklyComments || []).filter((c) => c.weekStart === weekStart);

/** Trẻ có lịch sử lớp cũ trong khoảng xem (BE chỉ trả trẻ chuyển đến). */
export const historyChildren = (response) => response?.children || [];
