import { sameId } from '@/services/http/idStrings';

// G94-180/CHD-04: mở lại hồ sơ mặc định điểm trường của trẻ (BE duplicate-check trả campusId) nếu điểm trường có trong năm tiếp nhận lại; không có ⇒ trống, bắt chọn.
export function defaultReadmitCampus(duplicate, campuses) {
  const own = duplicate?.campusId;
  if (own == null || own === '') return '';
  const found = (campuses || []).find((c) => sameId(c.id, own));
  return found ? String(found.id) : '';
}
