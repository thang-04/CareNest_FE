import { useId } from 'react';
import { CalendarDays, School } from 'lucide-react';
import { useMasterData } from '@/hooks/useMasterData';

/**
 * Filter bar shared by the attendance screens: class (optional) + date.
 * `maxDate` keeps users from opening future days.
 */
export function ClassDateBar({ classes, classId, onClassChange, date, onDateChange, maxDate, dateLabel = 'Ngày', children }) {
  const id = useId();
  const md = useMasterData();
  const multiCampus = new Set((classes || []).map((c) => c.campusId)).size > 1;
  return (
    <div className="filter-bar dd-bar">
      {classes && (
        <div className="dd-bar__field">
          <label className="field__label" htmlFor={`${id}-class`}>
            <School size={15} /> Lớp
          </label>
          <select id={`${id}-class`} className="select" value={classId || ''} onChange={(e) => onClassChange(e.target.value)}>
            {classes.length === 0 && <option value="">Không có lớp</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {multiCampus ? ` – ${md.campusById?.(c.campusId)?.name || c.campusId}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {onDateChange && (
        <div className="dd-bar__field">
          <label className="field__label" htmlFor={`${id}-date`}>
            <CalendarDays size={15} /> {dateLabel}
          </label>
          <input
            id={`${id}-date`}
            type="date"
            className="input"
            value={date}
            max={maxDate}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
        </div>
      )}
      {children}
    </div>
  );
}
