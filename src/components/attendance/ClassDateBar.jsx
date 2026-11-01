import { useId, useState } from 'react';
import { CalendarDays, School } from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { DateInput } from '@/components/form/DateInput';
import { isIsoDate } from '@/utils/format';

/**
 * Filter bar shared by the attendance screens: class (optional) + date.
 * `maxDate` keeps users from opening future days.
 */
export function ClassDateBar({ classes, classId, onClassChange, date, onDateChange, maxDate, dateLabel = 'Ngày', children }) {
  const id = useId();
  const [dateError, setDateError] = useState('');
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
          <DateInput
            id={`${id}-date`}
            value={date}
            max={maxDate}
            aria-invalid={!!dateError}
            aria-describedby={dateError ? `${id}-date-error` : undefined}
            onChange={(value) => {
              if (!isIsoDate(value)) {
                setDateError('Nhập ngày hợp lệ theo dd/mm/yyyy.');
                return;
              }
              if (maxDate && value > maxDate) {
                setDateError('Không chọn ngày trong tương lai.');
                return;
              }
              setDateError('');
              onDateChange(value);
            }}
          />
          {dateError && (
            <span id={`${id}-date-error`} className="field__error" role="alert">
              {dateError}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
