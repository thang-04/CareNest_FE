/** Tài khoản phụ huynh gắn trẻ (BE AUTH-18, AUTH-19). */

/**
 * Quan hệ của liên kết tài khoản–trẻ: 6 loại như lựa chọn trên hồ sơ trẻ (user chốt 2026-10-28, D-5a B; BE đang có 4 mã ⇒ BE
 * mở rộng). OTHER chỉ còn cho dữ liệu cũ.
 */
export const GUARDIAN_RELATIONSHIPS = ['MOTHER', 'FATHER', 'GRANDFATHER', 'GRANDMOTHER', 'SIBLING', 'GUARDIAN', 'OTHER'];

export const GUARDIAN_RELATIONSHIP_LABELS = {
  MOTHER: 'Mẹ',
  FATHER: 'Bố',
  GRANDFATHER: 'Ông',
  GRANDMOTHER: 'Bà',
  SIBLING: 'Anh/chị',
  GUARDIAN: 'Người giám hộ',
  OTHER: 'Khác',
};
