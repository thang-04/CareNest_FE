import { CalendarX, Info, Lock, Unlock } from '@/components/ui/icons';
import { formatDate, formatDateTime } from '@/utils/format';

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
  if (sheet.unlock && !sheet.locked)
    return (
      <div className="alert alert--info mb-16" role="status">
        <Unlock size={18} />
        <div>
          <b>{sheet.unlock.unlockedByName}</b> đã mở lại điểm danh lớp này đến <b>{formatDateTime(sheet.unlock.validUntil)}</b>.
        </div>
      </div>
    );
  if (sheet.locked)
    return (
      <div className="alert alert--warning mb-16">
        <Lock size={18} />
        <div>
          Điểm danh và báo ăn đã khóa sau <b>{sheet.cutoff}</b>
          {sheet.date === sheet.today ? ' hôm nay' : ` ngày ${formatDate(sheet.date)}`}.
        </div>
      </div>
    );
  return (
    <div className="alert alert--info mb-16">
      <Info size={18} />
      <div>
        Điểm danh và báo ăn trước <b>{sheet.cutoff}</b> hôm nay.
      </div>
    </div>
  );
}
