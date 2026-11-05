import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { semestersOf } from '@/utils/semesters';

/**
 * Ô lọc học kỳ của năm học đang chọn ở header (Học kỳ I / Học kỳ II / Cả năm học). value = key học kỳ hoặc '';
 * onChange(key, semester) — semester = { start, end, label } hoặc null khi bỏ chọn. emptyLabel: nhãn khi không lọc.
 */
export function SemesterSelect({ value, onChange, emptyLabel = 'Tất cả học kỳ', className = 'select', id }) {
  const { schoolYear, schoolYears } = useSchoolYear();
  const year = schoolYears.find((y) => String(y.id) === String(schoolYear));
  const options = semestersOf(year);
  if (!options.length) return null;
  return (
    <select
      id={id}
      className={className}
      aria-label="Lọc theo học kỳ"
      value={value || ''}
      onChange={(e) => onChange(e.target.value, options.find((o) => o.key === e.target.value) || null)}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
