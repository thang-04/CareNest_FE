import { CalendarX, Info, Lock } from '@/components/ui/icons';
import { formatDate } from '@/utils/format';

/** Shows the cut-off state of the day (MSG22, MSG24). */
export function DayLockAlert({ sheet }) {
  if (!sheet) return null;
  if (!sheet.schoolDay)
    return (
      <div className="alert alert--warning mb-16">
        <CalendarX size={18} />
        <div>Ngày đã chọn không phải ngày học.</div>
      </div>
    );
  if (sheet.locked)
    return (
      <div className="alert alert--warning mb-16">
        <Lock size={18} />
        <div>
          Điểm danh và báo ăn đã khóa sau <b>{sheet.cutoff}</b>
          {sheet.date === sheet.today ? ' hôm nay' : ` ngày ${formatDate(sheet.date)}`}. Trẻ đến sau giờ khóa không được thêm vào sĩ số suất
          ăn.
        </div>
      </div>
    );
  return (
    <div className="alert alert--info mb-16">
      <Info size={18} />
      <div>
        Điểm danh và báo ăn trước <b>{sheet.cutoff}</b> hôm nay. Sau giờ này dữ liệu bị khóa và sĩ số suất ăn được gửi Phó hiệu trưởng xác
        nhận.
      </div>
    </div>
  );
}
