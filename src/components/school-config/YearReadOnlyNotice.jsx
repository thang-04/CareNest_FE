import { Info } from '@/components/ui/icons';
import { useSchoolYear } from '@/contexts/SchoolYearContext';

/** CFG-YR-01: năm đang chọn ở header đã kết thúc ⇒ màn chỉ xem. Không hiện gì với năm còn mở. */
export function YearReadOnlyNotice() {
  const { schoolYear, schoolYears, yearReadOnly } = useSchoolYear();
  if (!yearReadOnly) return null;
  const label = schoolYears.find((y) => y.id === schoolYear)?.label || schoolYear;
  return (
    <div className="alert alert--info mb-16" role="status">
      <Info size={18} />
      <div>Năm học {label} đã kết thúc – chỉ xem.</div>
    </div>
  );
}
