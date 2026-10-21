import { PICKUP_OUTCOME, VERIFICATION, outcomeOf } from '@/models/pickup/pickupConstants';

const PHONE_RE = /^0\d{9}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Pickup result form (UC 3.16). Returns { field: message }.
 * Thông tin người đón chỉ bắt buộc khi trả trẻ. Phụ huynh không đồng ý: ghi nhận không trả trẻ ngay, không lấy thông tin;
 * không liên lạc được: thông tin người đón theo lời khai, không bắt buộc (quyết định user 2026-10-15).
 */
export const validatePickupResult = (form = {}) => {
  const errors = {};
  if (!Object.values(VERIFICATION).includes(form.verification)) errors.verification = 'Chọn kết quả xác minh người đón.';
  const handedOver = outcomeOf(form.verification) === PICKUP_OUTCOME.HANDED_OVER;
  if (handedOver && !String(form.pickupPersonName || '').trim()) errors.pickupPersonName = 'Nhập họ tên người đón.';
  if (handedOver && !String(form.pickupPersonRelation || '').trim()) errors.pickupPersonRelation = 'Chọn quan hệ với trẻ.';
  const phone = String(form.pickupPersonPhone || '').replace(/\s/g, '');
  if (phone && !PHONE_RE.test(phone)) errors.pickupPersonPhone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
  if (handedOver && !TIME_RE.test(String(form.handoverTime || ''))) errors.handoverTime = 'Nhập giờ trả trẻ (HH:mm).';
  if (String(form.note || '').length > 500) errors.note = 'Ghi chú tối đa 500 ký tự.';
  return errors;
};
