import { PICKUP_OUTCOME, VERIFICATION, outcomeOf } from '@/models/pickup/pickupConstants';

const PHONE_RE = /^0\d{9}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const NOTE_MAX = 500;

/** Nội dung cuộc gọi bắt buộc khi xác minh qua điện thoại, cả trả và không trả (user chốt 2026-10-23). */
export const callNoteError = (note) => {
  const text = String(note || '').trim();
  if (!text) return 'Ghi nội dung cuộc gọi với phụ huynh.';
  return text.length > NOTE_MAX ? `Nội dung tối đa ${NOTE_MAX} ký tự.` : null;
};

const PHONE_VERIFICATIONS = [VERIFICATION.PHONE_CONFIRMED, VERIFICATION.PHONE_DECLINED];

/**
 * Pickup result form (UC 3.16). Returns { field: message }.
 * Thông tin người đón chỉ bắt buộc khi trả trẻ khớp ảnh. Gọi phụ huynh (trả hoặc không trả): không lấy thông tin người đón, người đón
 * và lý do ghi trong nội dung cuộc gọi (user chốt 2026-10-15, 2026-10-23; trả trẻ ghi ngay trong modal 2026-10-24).
 */
export const validatePickupResult = (form = {}) => {
  const errors = {};
  if (!Object.values(VERIFICATION).includes(form.verification)) errors.verification = 'Chọn kết quả xác minh người đón.';
  const handedOver = outcomeOf(form.verification) === PICKUP_OUTCOME.HANDED_OVER;
  const needsPerson = form.verification === VERIFICATION.PHOTO_MATCH;
  if (needsPerson && !String(form.pickupPersonName || '').trim()) errors.pickupPersonName = 'Nhập họ tên người đón.';
  if (needsPerson && !String(form.pickupPersonRelation || '').trim()) errors.pickupPersonRelation = 'Chọn quan hệ với trẻ.';
  const phone = String(form.pickupPersonPhone || '').replace(/\s/g, '');
  if (phone && !PHONE_RE.test(phone)) errors.pickupPersonPhone = 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
  if (handedOver && !TIME_RE.test(String(form.handoverTime || ''))) errors.handoverTime = 'Nhập giờ trả trẻ (HH:mm).';
  const noteError = PHONE_VERIFICATIONS.includes(form.verification)
    ? callNoteError(form.note)
    : String(form.note || '').length > NOTE_MAX
      ? `Ghi chú tối đa ${NOTE_MAX} ký tự.`
      : null;
  if (noteError) errors.note = noteError;
  return errors;
};
