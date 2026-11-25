import { Tabs } from '@/components/ui/Tabs';
import { formatWeekdayDate } from '@/utils/format';

// Tóm tắt một ngày từ trạng thái từng bữa BE đã tính; chỉ đếm để hiển thị, không suy luận thêm
const daySummary = (day) => {
  if (day.dayOff) return 'Ngày nghỉ';
  if (day.upcoming) return 'Chưa tới';
  const missing = day.sessions.filter((s) => s.status === 'MISSING').length;
  if (missing) return `Thiếu ${missing} bữa`;
  if (day.sessions.some((s) => s.status === 'PENDING')) return 'Chờ đăng';
  return day.sessions.some((s) => s.status === 'POSTED') ? 'Đủ ảnh' : 'Không có bữa';
};

/** Dải 5 ngày của tuần: mỗi ngày một tab kèm tóm tắt thiếu/đủ ảnh để thấy ngay ngày nào cần xem. */
export function MealPhotoWeekStrip({ days, value, onChange }) {
  const items = days.map((day) => {
    const summary = daySummary(day);
    return {
      key: day.date,
      label: (
        <span className="kr-week-day">
          <span>{formatWeekdayDate(day.date)}</span>
          <span className={`kr-week-day__note ${summary.startsWith('Thiếu') ? 'kr-week-day__note--warn' : ''}`}>{summary}</span>
        </span>
      ),
      title: `${formatWeekdayDate(day.date)}: ${summary}`,
    };
  });
  return <Tabs items={items} value={value} onChange={onChange} ariaLabel="Chọn ngày trong tuần" />;
}
