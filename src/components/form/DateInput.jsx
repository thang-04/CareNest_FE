import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays } from '@/components/ui/icons';
import { formatDate, isIsoDate, normalizeDateInput, padDisplayDate, parseDisplayDate } from '@/utils/format';

const toText = (value) => (isIsoDate(value) ? formatDate(value) : value || '');

/**
 * Date field shown and typed as dd/mm/yyyy whatever the browser locale; the calendar button opens the native picker.
 * value / onChange use yyyy-mm-dd. Text that is not yet a real date is passed through as typed so validation can report it.
 *
 * <DateInput value={form.startDate} onChange={(v) => set({ startDate: v })} />
 */
export const DateInput = forwardRef(function DateInput({ value, onChange, onBlur, min, max, className = '', disabled, ...props }, ref) {
  const [text, setText] = useState(() => toText(value));
  const pickerRef = useRef(null);

  // Giá trị đổi từ ngoài (chọn trên lịch, form gợi ý) thì hiển thị lại theo dd/mm/yyyy
  useEffect(() => {
    setText((current) => (parseDisplayDate(current) === value || current === value ? current : toText(value)));
  }, [value]);

  const handleType = (e) => {
    const next = normalizeDateInput(e.target.value);
    setText(next);
    onChange?.(parseDisplayDate(padDisplayDate(next)) || next);
  };

  // Rời ô thì hiển thị bản đã đệm số 0 nếu là ngày thật; vẫn gọi onBlur của người dùng
  const handleBlur = (e) => {
    const padded = padDisplayDate(text);
    if (padded !== text && parseDisplayDate(padded)) setText(padded);
    onBlur?.(e);
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
        onBlur={handleBlur}
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
