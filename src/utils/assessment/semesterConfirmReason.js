/* Lý do nút "Xác nhận" đánh giá học kỳ bị khóa (cờ confirmBlockedReason của BE) → câu giải thích cho người dùng. */
import { formatDate } from '@/utils/format';

export const CONFIRM_BLOCKED_REASONS = {
  NO_PERMISSION: 'Chưa có quyền ghi hoặc xác nhận đánh giá.',
  NOT_HOMEROOM: 'Chỉ GV chủ nhiệm lớp xác nhận.',
  YEAR_NOT_ACTIVE: 'Năm học đã đóng, không xác nhận được.',
  DEADLINE_LOCKED: 'Quá hạn xác nhận, liên hệ PHT hoặc Hiệu trưởng để mở lại.',
  NOT_ENDED: 'Xác nhận được từ ngày kết thúc học kỳ.',
  // OBS-25 (26/11/2026): chỉ khóa khi cả bảng chưa có kết quả nào; trẻ vào lớp muộn chưa có dữ liệu vẫn xác nhận được
  INCOMPLETE: 'Bảng chưa có kết quả mục tiêu nào để xác nhận.',
  CONFIRMED: 'Bảng đã được xác nhận.',
};

/**
 * Câu giải thích hiện dưới nút Xác nhận; rỗng khi bấm được.
 * @param {string|null} reason mã lý do từ BE
 * @param {object} ctx { endDate: ngày kết thúc học kỳ (ISO) }
 */
export const semesterConfirmBlockedNote = (reason, { endDate } = {}) => {
  if (!reason) return '';
  if (reason === 'NOT_ENDED')
    return endDate ? `Xác nhận được từ ngày kết thúc học kỳ ${formatDate(endDate)}.` : CONFIRM_BLOCKED_REASONS.NOT_ENDED;
  return CONFIRM_BLOCKED_REASONS[reason] || '';
};
