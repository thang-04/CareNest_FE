import { APPROVAL_REASON_MIN, APPROVAL_STATUS } from '@/models/kitchen/inspectionConstants';
import { formatDateTime } from '@/utils/format';

/*
 * Dòng thông báo trạng thái mở ghi ngày cũ của một mẫu (INS-05). Chỉ chuyển trạng thái BE trả thành câu chữ: ngày nào khóa, ai được
 * gửi yêu cầu, hạn mở đều do BE quyết định.
 */

/** Giờ hiển thị của hạn mở (theo `Asia/Ho_Chi_Minh` qua `formatDateTime`). */
const untilText = (expiresAt) => (expiresAt ? formatDateTime(expiresAt) : '');

/** `{ kind, text }` để đưa vào `LockNote`, hoặc null khi không cần nhắc gì (ngày hôm nay, chưa có gì đáng báo). */
export const approvalNotice = (approval) => {
  if (!approval) return null;
  const { locked, status, decisionNote, reason, expiresAt } = approval;
  const note = decisionNote ? ` Ghi chú: ${decisionNote}` : '';
  if (status === APPROVAL_STATUS.PENDING) {
    return { kind: 'notYet', text: `Đã gửi yêu cầu mở mẫu${reason ? ` ("${reason}")` : ''}, đang chờ Hiệu trưởng duyệt.` };
  }
  if (status === APPROVAL_STATUS.REJECTED) {
    return { kind: 'overdue', text: `Hiệu trưởng đã từ chối mở mẫu này.${note} Cần sửa thì gửi yêu cầu mới.` };
  }
  if (status === APPROVAL_STATUS.REVOKED) {
    return { kind: 'overdue', text: `Hiệu trưởng đã thu hồi quyền mở mẫu này.${note} Cần sửa thì gửi yêu cầu mới.` };
  }
  if (status === APPROVAL_STATUS.EXPIRED) {
    return { kind: 'overdue', text: `Quyền mở mẫu đã hết hạn lúc ${untilText(expiresAt)}. Cần sửa thì gửi yêu cầu mới.` };
  }
  if (status === APPROVAL_STATUS.CONSUMED && locked) {
    return { kind: 'locked', text: 'Đã ký xong sau khi được mở. Muốn sửa lại phải gửi yêu cầu mới.' };
  }
  if (status === APPROVAL_STATUS.APPROVED && !locked) {
    return { kind: 'notYet', text: `Hiệu trưởng đã mở mẫu này, sửa và ký trước ${untilText(expiresAt)}.` };
  }
  if (locked) return { kind: 'locked', text: 'Ngày đã qua: cần Hiệu trưởng duyệt mở mới ghi được mẫu này.' };
  return null;
};

/** Lý do hoặc ghi chú hợp lệ khi đủ độ dài tối thiểu (BE kiểm lại; đây chỉ để chặn sớm ở form). */
export const isApprovalTextValid = (text) => String(text || '').trim().length >= APPROVAL_REASON_MIN;

/** Nhãn nút theo người xem: HT mở ngay, PHT gửi yêu cầu chờ duyệt. */
export const approvalActionLabel = (approval) => (approval?.canSelfOpen ? 'Mở để sửa' : 'Yêu cầu HT mở');
