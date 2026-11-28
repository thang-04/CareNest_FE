import { Info } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { lockedYearMessage, lockedYearOf } from '@/utils/schoolYearPrep';

/**
 * Trang chỉ xem theo năm học ở header, trang tự ẩn phần làm việc theo useChildYearLock:
 * - năm sắp diễn ra chưa tới ngày mở chuẩn bị (CFG-YR-05, CHD-12); action: việc bị khóa, vd. "Sửa hồ sơ";
 * - năm đã kết thúc (CFG-YR-01); subject: thông tin được xem, vd. "hồ sơ trẻ".
 */
export function YearLockedNotice({ action, subject }) {
  const { schoolYear, schoolYears, yearReadOnly, activeYear, setSchoolYear } = useSchoolYear();
  if (yearReadOnly)
    return (
      <div className="alert alert--info mb-16" role="status">
        <Info size={18} />
        <div>
          Năm học đã kết thúc. Bạn chỉ có thể xem thông tin{subject ? ` ${subject}` : ''}.
          {activeYear && activeYear.id !== schoolYear && (
            <>
              {' '}
              <Button size="sm" onClick={() => setSchoolYear(activeYear.id)}>
                Chuyển sang năm học {activeYear.label}
              </Button>
            </>
          )}
        </div>
      </div>
    );
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
