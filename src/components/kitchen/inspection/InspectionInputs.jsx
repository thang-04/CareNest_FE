import { maskDate, normalizeDate, normalizeTime, toDisplayDate } from '@/utils/kitchen/inspectionForm';

/**
 * Ô gõ giờ và ngày bằng bàn phím, không mở bảng chọn của trình duyệt: giờ "730" → 07:30, ngày "09112026" → 09/11/2026 (tự chèn dấu "/",
 * thiếu năm lấy năm của biên bản). Chuẩn hóa khi rời ô; giá trị lưu trong form là HH:MM và YYYY-MM-DD.
 */
export function TimeInput({ value, onChange, ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="hh:mm"
      maxLength={5}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9:.hH]/g, ''))}
      onBlur={(e) => onChange(normalizeTime(e.target.value))}
      {...rest}
    />
  );
}

export function DateInput({ value, onChange, defaultYear, ...rest }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="dd/mm/yyyy"
      maxLength={10}
      value={toDisplayDate(value)}
      onChange={(e) => onChange(maskDate(e.target.value.replace(/[^0-9/.\-\s]/g, '')))}
      onBlur={(e) => onChange(normalizeDate(e.target.value, defaultYear))}
      {...rest}
    />
  );
}
