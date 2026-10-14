import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays } from '@/components/ui/icons';
import { formatDate, isIsoDate, parseDisplayDate } from '@/utils/format';

// Tự chèn dấu "/" khi gõ: "05092026" -> "05/09/2026"
const mask = (raw) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
};

const toText = (value) => (isIsoDate(value) ? formatDate(value) : value || '');

/**
 * Date field shown and typed as dd/mm/yyyy whatever the browser locale; the calendar button opens the native picker.
 * value / onChange use yyyy-mm-dd. Text that is not yet a real date is passed through as typed so validation can report it.
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
    const next = mask(e.target.value);
    setText(next);
    onChange?.(parseDisplayDate(next) || next);
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
