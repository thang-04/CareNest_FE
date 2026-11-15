import { useMemo } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { addDays, weekOptions } from '@/utils/week';

/**
 * Chọn tuần (value / onChange là ngày thứ Hai yyyy-mm-dd): nút tuần trước / sau, bấm nhãn tuần mở danh sách tuần của năm học.
 * Có `thisWeek` thì danh sách đánh dấu tuần đó và hiện nút "Tuần này" khi đang ở tuần khác.
 */
export function WeekPicker({ value, onChange, thisWeek, disabled = false }) {
  const { schoolYear, schoolYears } = useSchoolYear() || {};
  const year = schoolYears?.find((y) => y.id === schoolYear);
  const options = useMemo(
    () => weekOptions({ start: year?.startDate, end: year?.endDate, value, thisWeek }),
    [year?.startDate, year?.endDate, value, thisWeek],
  );

  return (
    <span className="week-picker">
      <button type="button" className="icon-btn" aria-label="Tuần trước" disabled={disabled} onClick={() => onChange(addDays(value, -7))}>
        <ChevronLeft size={18} />
      </button>
      <SearchSelect
        className="week-picker__select"
        options={options}
        value={value}
        onChange={onChange}
        disabled={disabled}
        searchable={false}
        ariaLabel="Chọn tuần"
        renderValue={(o) => (
          <>
            <CalendarDays size={16} /> {o.label}
          </>
        )}
      />
      <button type="button" className="icon-btn" aria-label="Tuần sau" disabled={disabled} onClick={() => onChange(addDays(value, 7))}>
        <ChevronRight size={18} />
      </button>
      {thisWeek && value !== thisWeek && (
        <button type="button" className="btn btn--sm btn--ghost" disabled={disabled} onClick={() => onChange(thisWeek)}>
          Tuần này
        </button>
      )}
    </span>
  );
}
