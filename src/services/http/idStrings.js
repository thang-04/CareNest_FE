/*
 * BE trả id kiểu số; màn và dữ liệu mẫu của module children coi id là chuỗi (tham số URL, user.id, user.campusId).
 * Adapter API đổi id sang chuỗi tại một chỗ (plan 2026-11-11-children-module-be-wiring) thay vì sửa từng phép so sánh.
 */
const ID_KEY = /^(id|.+Id)$/;
const IDS_KEY = /.+Ids$/;

const toIdString = (value) => (typeof value === 'number' ? String(value) : value);

/** Đổi mọi `id`, `xxxId` (số) và `xxxIds` (mảng số) sang chuỗi, đệ quy; giá trị khác (CCCD, sĩ số...) giữ nguyên. */
export function stringifyIds(value) {
  if (Array.isArray(value)) return value.map(stringifyIds);
  if (!value || typeof value !== 'object' || value instanceof Blob) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => {
      if (ID_KEY.test(key)) return [key, toIdString(v)];
      if (IDS_KEY.test(key) && Array.isArray(v)) return [key, v.map(toIdString)];
      return [key, stringifyIds(v)];
    }),
  );
}

/** So id hai nguồn có thể khác kiểu (số từ BE, chuỗi từ URL hoặc dữ liệu mẫu). */
export const sameId = (a, b) => a != null && b != null && String(a) === String(b);
