import { formatDate, isIsoDate, normalizeDateInput, parseDisplayDate } from '@/utils/format';

/** Ngày hợp lệ gần nhất để quay về: ngày thật (yyyy-mm-dd) hoặc rỗng; đoạn gõ dở thì giữ nguyên ngày cũ. */
export const nextLastValid = (value, previous) => (isIsoDate(value) || !value ? value || '' : previous);

/**
 * Kết quả khi gõ vào ô ngày. Đoạn gõ dở được nhận như đã gõ để form báo lỗi. Ngày đủ nhưng ngoài min/max thì không nhận:
 * ô quay về ngày hợp lệ gần nhất (không phải đoạn dở vừa gõ) và form nhận lại đúng ngày đó.
 * Trả { text, emit }: chữ hiển thị trong ô và giá trị gửi cho onChange.
 */
export const typedDateOutcome = (raw, { lastValid = '', min, max } = {}) => {
  const next = normalizeDateInput(raw);
  const iso = parseDisplayDate(next);
  if (iso && ((min && iso < min) || (max && iso > max))) {
    return { text: isIsoDate(lastValid) ? formatDate(lastValid) : '', emit: lastValid };
  }
  return { text: next, emit: iso || next };
};
