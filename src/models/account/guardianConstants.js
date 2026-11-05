/** Tài khoản phụ huynh gắn trẻ (BE AUTH-18, AUTH-19). */

/**
 * Quan hệ của liên kết tài khoản–trẻ: 6 loại như lựa chọn trên hồ sơ trẻ (user chốt 2026-10-28, D-5a B; BE đang có 4 mã ⇒ BE
 * mở rộng). OTHER chỉ còn cho dữ liệu cũ.
 */
export const GUARDIAN_RELATIONSHIPS = ['MOTHER', 'FATHER', 'GRANDFATHER', 'GRANDMOTHER', 'SIBLING', 'GUARDIAN', 'OTHER'];

export { GUARDIAN_RELATIONSHIP_LABELS } from '@/models/guardianRelationshipLabels';
