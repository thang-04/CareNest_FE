// Giá trị mẫu cố định để xem trước câu chữ quy tắc; không phải dữ liệu thật và không gửi đi đâu.
export const SAMPLE_VALUES = {
  tenTre: 'Bé An Nhiên',
  ngay: '21/11/2026',
  gio: '16:30',
  lop: 'Lớp Mầm 1',
  tuNgay: '24/11/2026',
  denNgay: '26/11/2026',
  nguoiDon: 'Người đón: Bà ngoại',
  tuan: '48',
};

/** Thay `{biến}` bằng giá trị mẫu; biến không có giá trị mẫu giữ nguyên để người soạn thấy. */
export const renderSample = (template, values = SAMPLE_VALUES) =>
  (template || '').replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(values, name) ? values[name] : match));

/**
 * Chèn `token` vào chuỗi tại vị trí con trỏ (hoặc thay đoạn đang chọn).
 * Trả { value, caret } hoặc null khi kết quả vượt `maxLength` (không tự cắt chữ).
 */
export function insertAtCaret(value, start, end, token, maxLength = Infinity) {
  const text = value || '';
  const from = Math.min(start ?? text.length, text.length);
  const to = Math.min(end ?? from, text.length);
  const next = `${text.slice(0, from)}${token}${text.slice(to)}`;
  if (next.length > maxLength) return null;
  return { value: next, caret: from + token.length };
}

export const formatCount = (value, max) => `${(value || '').length.toLocaleString('vi-VN')} / ${max.toLocaleString('vi-VN')}`;
