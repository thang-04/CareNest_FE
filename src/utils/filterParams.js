/**
 * Bộ lọc danh sách <-> query string. Chỉ ghi các giá trị khác mặc định để URL gọn
 * và mặc định theo vai trò (vd. Hiệu trưởng xem "Chờ phê duyệt") không bị khoá vào URL.
 * Giá trị luôn là chuỗi; key ngoài `defaults` (vd. tab, id) được giữ nguyên.
 */
export function readFilters(params, defaults) {
  const out = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = params.get(key);
    out[key] = value === null ? fallback : value;
  }
  return out;
}

export function writeFilters(prev, next, defaults) {
  const params = new URLSearchParams(prev);
  for (const key of Object.keys(defaults)) {
    const value = next[key] ?? defaults[key];
    if (value === defaults[key]) params.delete(key);
    else params.set(key, String(value));
  }
  return params;
}

/** Số bộ lọc đang khác mặc định (dùng cho nút "Lọc thêm", nút đặt lại, chip). */
export const activeFilterKeys = (filters, defaults, keys = Object.keys(defaults)) => keys.filter((key) => filters[key] !== defaults[key]);
