import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  decideInspectionApproval,
  getInspectionApprovals,
  getInspectionDay,
  getInspectionSuppliers,
  reopenInspectionTab,
  requestInspectionApproval,
  saveInspectionTab,
  signInspectionTab,
} from '@/services/kitchen/inspectionService';
import { isIsoDate } from '@/utils/format';

/**
 * Bốn mẫu kiểm thực M1–M3 của một điểm trường và ngày, kèm hàm lưu nháp, ký, sửa lại.
 * Ghi xong gọi `reload({ silent: true })` để lấy trạng thái, chữ ký, lịch sử BE trả.
 */
export function useInspectionDay(campusId, date) {
  const { user } = useAuth();
  const query = useAsync(() => getInspectionDay({ campusId, date }, user), [user?.id, campusId, date], {
    enabled: !!user && !!campusId && isIsoDate(date),
  });
  return {
    ...query,
    save: (tab, request) => saveInspectionTab({ campusId, date, tab, ...request }, user),
    sign: (tab, signature) => signInspectionTab({ campusId, date, tab, signatureId: signature.id, imageUrl: signature.url }, user),
    reopen: (tab, reason) => reopenInspectionTab({ campusId, date, tab, reason }, user),
    // Ngày cũ (INS-05): PHT gửi yêu cầu chờ HT duyệt, HT gửi thì mở ngay; `decide` chỉ HT dùng (thu hồi quyền đang mở)
    requestApproval: (tab, { reason, validHours }) => requestInspectionApproval({ campusId, date, tab, reason, validHours }, user),
    decide: (approvalId, decision, { note, validHours } = {}) => decideInspectionApproval({ approvalId, decision, note, validHours }, user),
  };
}

/** Hàng chờ yêu cầu mở mẫu ngày cũ của Hiệu trưởng (mọi điểm trường); chỉ tải khi `enabled`, BE từ chối người không phải HT. */
export function useInspectionApprovalQueue(enabled) {
  const { user } = useAuth();
  const query = useAsync(() => getInspectionApprovals({ status: 'PENDING' }, user), [user?.id], { enabled: enabled && !!user });
  return {
    ...query,
    decide: (approvalId, decision, { note, validHours } = {}) => decideInspectionApproval({ approvalId, decision, note, validHours }, user),
  };
}

/** Nhà cung cấp để điền nhanh; chỉ tải khi `enabled` (hộp chọn đang mở). */
export const useInspectionSuppliers = (enabled) => {
  const { user } = useAuth();
  return useAsync(() => getInspectionSuppliers(user), [user?.id], { enabled: enabled && !!user });
};
