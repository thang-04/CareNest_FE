import { useId, useState } from 'react';
import { CalendarDays, School } from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { DateInput } from '@/components/form/DateInput';
import { isIsoDate } from '@/utils/format';
import { isPastClass } from '@/utils/attendance/attendancePermissions';

const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
// AUTH-03: lớp cũ ghi rõ các đợt đã dạy, chỉ xem
const classLabel = (c) =>
  isPastClass(c) ? `${c.name} (đã dạy ${c.readRanges.map((r) => `${dm(r.start)}–${dm(r.end)}`).join(', ')}, chỉ xem)` : c.name;

/**
 * Filter bar shared by the attendance screens: class (optional) + date.
 * `maxDate` keeps users from opening future days; `minDate` (lớp cũ) chặn trước đợt dạy đầu tiên.
 */
export function ClassDateBar({ classes, classId, onClassChange, date, onDateChange, minDate, maxDate, dateLabel = 'Ngày', children }) {
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
          {/* GV chỉ dạy một lớp: hiện tên lớp, không bắt chọn */}
          {classes.length === 1 ? (
            <span id={`${id}-class`} className="fw-600 dd-bar__value">
              {classLabel(classes[0])}
            </span>
          ) : (
            <select id={`${id}-class`} className="select" value={classId || ''} onChange={(e) => onClassChange(e.target.value)}>
              {classes.length === 0 && <option value="">Không có lớp</option>}
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                  {multiCampus ? ` – ${md.campusById?.(c.campusId)?.shortName || md.campusById?.(c.campusId)?.name || c.campusId}` : ''}
                </option>
              ))}
            </select>
          )}
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
            min={minDate}
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
              if (minDate && value < minDate) {
                setDateError('Không chọn ngày trước đợt đã dạy.');
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
