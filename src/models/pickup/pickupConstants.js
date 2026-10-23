/**
 * Child pickup (SRS #99–#101, UC 3.15 Hand Over Child to Pickup Person, UC 3.16 Record Pickup Result, BF-07, GBR-CP-03).
 *
 * @typedef {Object} PickupRecord
 * @property {string} id
 * @property {string} date                 yyyy-mm-dd
 * @property {string} childId
 * @property {string} classId
 * @property {string} campusId
 * @property {'HANDED_OVER'|'NOT_HANDED_OVER'} outcome
 * @property {'PHOTO_MATCH'|'PHONE_CONFIRMED'|'PHONE_DECLINED'|'PHONE_UNREACHABLE'} verification
 * @property {string} pickupPersonName
 * @property {string} pickupPersonRelation
 * @property {string} pickupPersonPhone
 * @property {string|null} handedOverAt    ISO, only for a completed handover
 * @property {boolean} phoneConfirmed      parent confirmed the pickup person by phone
 * @property {string} note
 * @property {string} teacherId            responsible teacher
 * @property {string} recordedAt
 * @property {{ channel: string, at: string }|null} parentNotification
 */

export const PICKUP_OUTCOME = { HANDED_OVER: 'HANDED_OVER', NOT_HANDED_OVER: 'NOT_HANDED_OVER' };

export const PICKUP_OUTCOME_LABELS = { HANDED_OVER: 'Đã trả trẻ', NOT_HANDED_OVER: 'Không trả trẻ' };

export const VERIFICATION = {
  PHOTO_MATCH: 'PHOTO_MATCH',
  PHONE_CONFIRMED: 'PHONE_CONFIRMED',
  PHONE_DECLINED: 'PHONE_DECLINED',
  PHONE_UNREACHABLE: 'PHONE_UNREACHABLE',
};

/**
 * Từ 2026-10-23 "Gọi phụ huynh" chỉ còn Trả trẻ (PHONE_CONFIRMED) / Không trả (PHONE_DECLINED), lý do ghi trong nội dung cuộc gọi;
 * PHONE_UNREACHABLE chỉ còn ở bản ghi cũ.
 */
export const VERIFICATION_LABELS = {
  PHOTO_MATCH: 'Khớp ảnh đăng ký',
  PHONE_CONFIRMED: 'Phụ huynh xác nhận qua điện thoại',
  PHONE_DECLINED: 'Gọi phụ huynh – không trả',
  PHONE_UNREACHABLE: 'Không liên lạc được phụ huynh',
};

/**
 * Lý do trả trẻ khác giờ thường: cô đã báo phụ huynh đón về sớm ở Sức khỏe trong ngày. Trẻ hiện "Chờ đón sớm" ở Đón trẻ;
 * giờ đón là lúc cô thực sự trả trẻ (vẫn xác minh như thường, GBR-CP-03).
 */
export const PICKUP_REASON = { HEALTH_EARLY: 'HEALTH_EARLY' };
export const PICKUP_REASON_LABELS = { HEALTH_EARLY: 'Về sớm do sức khỏe' };

/** Only these verifications allow the child to leave (GBR-CP-03). */
export const outcomeOf = (verification) =>
  [VERIFICATION.PHOTO_MATCH, VERIFICATION.PHONE_CONFIRMED].includes(verification)
    ? PICKUP_OUTCOME.HANDED_OVER
    : PICKUP_OUTCOME.NOT_HANDED_OVER;

/** Board status of a child for the day (derived by the backend). */
export const PICKUP_STATUS = { WAITING: 'WAITING', PICKED_UP: 'PICKED_UP', ABSENT: 'ABSENT' };

export const PICKUP_STATUS_LABELS = { WAITING: 'Chờ đón', PICKED_UP: 'Đã đón', ABSENT: 'Vắng hôm nay' };

export const RELATIONS = ['Bố', 'Mẹ', 'Ông', 'Bà', 'Anh/chị', 'Cô/dì/chú/bác', 'Khác'];
