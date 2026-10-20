import { useRef } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from '@/components/ui/icons';
import { addDays, mondayOf, weekLabel } from '@/models/menu-planning/menuPlanningConstants';

/**
 * Chọn tuần (value / onChange là ngày thứ Hai yyyy-mm-dd): nút tuần trước / sau, bấm nhãn tuần mở lịch.
 * Chọn ngày nào trên lịch cũng quy về thứ Hai của tuần đó. Có `thisWeek` thì hiện nút "Tuần này" khi đang ở tuần khác.
 */
export function WeekPicker({ value, onChange, thisWeek }) {
  const pickerRef = useRef(null);
  const label = weekLabel(value);

  const openPicker = () => {
    try {
      pickerRef.current?.showPicker();
    } catch {
      pickerRef.current?.focus();
    }
  };

  return (
    <span className="week-picker">
      <button type="button" className="icon-btn" aria-label="Tuần trước" onClick={() => onChange(addDays(value, -7))}>
        <ChevronLeft size={18} />
      </button>
      <span className="week-picker__value">
        <button type="button" className="btn" onClick={openPicker} aria-label={`Tuần ${label}, bấm để chọn trên lịch`}>
          <CalendarDays size={16} /> {label}
        </button>
        <input
          ref={pickerRef}
          type="date"
          className="date-input__picker"
          tabIndex={-1}
          aria-hidden="true"
          value={value || ''}
          onChange={(e) => e.target.value && onChange(mondayOf(e.target.value))}
        />
      </span>
      <button type="button" className="icon-btn" aria-label="Tuần sau" onClick={() => onChange(addDays(value, 7))}>
        <ChevronRight size={18} />
      </button>
      {thisWeek && value !== thisWeek && (
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => onChange(thisWeek)}>
          Tuần này
        </button>
      )}
    </span>
  );
}
