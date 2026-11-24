import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays } from '@/components/ui/icons';
import { formatDate, isIsoDate, normalizeDateInput, parseDisplayDate } from '@/utils/format';

const toText = (value) => (isIsoDate(value) ? formatDate(value) : value || '');

/**
 * Date field shown and typed as dd/mm/yyyy whatever the browser locale; the calendar button opens the native picker.
 * value / onChange use yyyy-mm-dd. Text that is not yet a real date is passed through as typed so validation can report it;
 * a full date outside min / max (yyyy-mm-dd) is rejected and the previous value kept, same as the calendar.
 *
 * <DateInput value={form.startDate} onChange={(v) => set({ startDate: v })} />
 */
export const DateInput = forwardRef(function DateInput({ value, onChange, min, max, className = '', disabled, ...props }, ref) {
  const [text, setText] = useState(() => toText(value));
  const pickerRef = useRef(null);

  // Giá trị đổi từ ngoài (chọn trên lịch, form gợi ý) thì hiển thị lại theo dd/mm/yyyy
  useEffect(() => {
    setText((current) => (parseDisplayDate(current) === value || current === value ? current : toText(value)));
  }, [value]);

  const handleType = (e) => {
    const next = normalizeDateInput(e.target.value);
    const iso = parseDisplayDate(next);
    // Ngày đủ nhưng ngoài min/max thì không nhận: giữ giá trị hợp lệ trước đó (cùng quy tắc với lịch chọn)
    if (iso && ((min && iso < min) || (max && iso > max))) {
      setText(toText(value));
      return;
    }
    setText(next);
    onChange?.(iso || next);
  };

  const openPicker = () => {
    try {
      pickerRef.current?.showPicker();
    } catch {
      pickerRef.current?.focus();
    }
  };

  return (
    <div className="input-group">
      <input
        ref={ref}
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        autoComplete="off"
        disabled={disabled}
        className={`input ${className}`}
        value={text}
        onChange={handleType}
      />
      <input
        ref={pickerRef}
        type="date"
        className="date-input__picker"
        tabIndex={-1}
        aria-hidden="true"
        min={min}
        max={max}
        disabled={disabled}
        value={isIsoDate(value) ? value : ''}
        onChange={(e) => e.target.value && onChange?.(e.target.value)}
      />
      <button
        type="button"
        className="icon-btn input-group__action"
        onClick={openPicker}
        disabled={disabled}
        aria-label="Chọn ngày trên lịch"
      >
        <CalendarDays size={18} />
      </button>
    </div>
  );
});
