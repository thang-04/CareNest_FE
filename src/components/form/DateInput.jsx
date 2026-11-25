import { forwardRef, useEffect, useRef, useState } from 'react';
import { CalendarDays } from '@/components/ui/icons';
import { nextLastValid, typedDateOutcome } from '@/utils/dateInputRules';
import { formatDate, isIsoDate, padDisplayDate, parseDisplayDate } from '@/utils/format';

const toText = (value) => (isIsoDate(value) ? formatDate(value) : value || '');

/**
 * Date field shown and typed as dd/mm/yyyy whatever the browser locale; the calendar button opens the native picker.
 * value / onChange use yyyy-mm-dd. Text that is not yet a real date is passed through as typed so validation can report it;
 * a full date outside min / max (yyyy-mm-dd) is rejected and the last valid date restored, same as the calendar.
 *
 * <DateInput value={form.startDate} onChange={(v) => set({ startDate: v })} />
 */
export const DateInput = forwardRef(function DateInput({ value, onChange, onBlur, min, max, className = '', disabled, ...props }, ref) {
  const [text, setText] = useState(() => toText(value));
  const pickerRef = useRef(null);
  // Ngày hợp lệ gần nhất: đoạn gõ dở được truyền lên làm value nên không thể dùng value để quay về
  const lastValid = useRef(isIsoDate(value) ? value : '');

  // Giá trị đổi từ ngoài (chọn trên lịch, form gợi ý) thì hiển thị lại theo dd/mm/yyyy
  useEffect(() => {
    lastValid.current = nextLastValid(value, lastValid.current);
    setText((current) => (parseDisplayDate(current) === value || current === value ? current : toText(value)));
  }, [value]);

  const handleType = (e) => {
    // Ngày đủ nhưng ngoài min/max thì không nhận: quay về ngày hợp lệ gần nhất (cùng quy tắc với lịch chọn)
    const { text: nextText, emit } = typedDateOutcome(e.target.value, { lastValid: lastValid.current, min, max });
    setText(nextText);
    onChange?.(emit);
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
