import { Link } from 'react-router-dom';
import { Info } from '@/components/ui/icons';
import { useSchoolYear } from '@/contexts/SchoolYearContext';

/**
 * Tiếp nhận, nhập Excel, xếp lớp luôn làm ở năm học đang hoạt động (user chốt 2026-10-28, Y-3). Header đang ở năm khác:
 * năm đã kết thúc ⇒ chỉ xem, có nút chuyển năm (trang ẩn phần làm việc theo yearReadOnly); năm sắp diễn ra ⇒ nhắc xếp lớp năm sau
 * ở màn Xếp lớp năm học mới. action: việc của trang, vd. "Tiếp nhận trẻ".
 */
export function ActiveYearNotice({ action }) {
  const { schoolYear, schoolYears, activeYear, yearReadOnly, setSchoolYear } = useSchoolYear();
  if (!activeYear || schoolYear === activeYear.id) return null;
  const label = schoolYears.find((y) => y.id === schoolYear)?.label || schoolYear;
  return (
    <div className="alert alert--info mb-16" role="status">
      <Info size={18} />
      {yearReadOnly ? (
        <div>
          Năm học {label} đã kết thúc – chỉ xem. {action} làm ở năm học đang hoạt động {activeYear.label}.{' '}
          <button type="button" className="btn btn--sm" onClick={() => setSchoolYear(activeYear.id)}>
            Chuyển sang năm học {activeYear.label}
          </button>
        </div>
      ) : (
        <div>
          {action} vào năm học đang hoạt động {activeYear.label}. Xếp lớp cho năm học {label} ở màn{' '}
          <Link to="/school/placement">Xếp lớp năm học mới</Link>.
        </div>
      )}
    </div>
  );
}
