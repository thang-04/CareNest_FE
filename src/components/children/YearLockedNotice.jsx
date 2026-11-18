import { Info } from '@/components/ui/icons';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { lockedYearMessage, lockedYearOf } from '@/utils/schoolYearPrep';

/**
 * Header chọn năm sắp diễn ra chưa tới ngày mở chuẩn bị (CFG-YR-05, CHD-12) ⇒ trang chỉ xem. action: việc bị khóa,
 * vd. "Sửa hồ sơ"; trang tự ẩn phần làm việc theo yearLocked.
 */
export function YearLockedNotice({ action }) {
  const { schoolYear, schoolYears } = useSchoolYear();
  const year = lockedYearOf(schoolYears, schoolYear);
  if (!year) return null;
  return (
    <div className="alert alert--info mb-16" role="status">
      <Info size={18} />
      <div>
        {lockedYearMessage(year)}
        {action ? ` ${action}: làm được từ ngày mở chuẩn bị.` : ''}
      </div>
    </div>
  );
}
