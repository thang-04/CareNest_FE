import { sourceOf } from '@/services/demoSource';
import { inspectionApi as api } from '@/services/kitchen/api/inspectionApi';
import { inspectionMockRepository as mock } from '@/services/kitchen/mock/inspectionMockRepository';

/** Kiểm thực ba bước M1–M3 theo ngày và điểm trường. Nguồn mock/BE theo INTEGRATION_MODULES. */
const repo = sourceOf('kitchen-inspection', mock, api);

/** { campusId, date, canEdit, canSign, tabs: { fresh, dry, process, serve } } — mỗi mẫu có rows, status, signature. */
export const getInspectionDay = (filters, user) => repo.getInspectionDay(filters, user);
/** Lưu nháp một mẫu: { campusId, date, tab, rows: [{ key, ...ô nhập }] }. */
export const saveInspectionTab = (payload, user) => repo.saveInspectionTab(payload, user);
/** Nhà cung cấp đang dùng: [{ id, name, address, phone, contactName }]. */
export const getInspectionSuppliers = (user) => repo.getInspectionSuppliers(user);
/** Mở khóa mẫu đã ký để sửa: { campusId, date, tab, reason } (bắt buộc lý do). */
export const reopenInspectionTab = (payload, user) => repo.reopenInspectionTab(payload, user);
/** Ký mẫu: { campusId, date, tab, signatureId, imageUrl } (mock chép imageUrl, BE chỉ nhận signatureId). */
export const signInspectionTab = (payload, user) => repo.signInspectionTab(payload, user);
/** Ngày cũ (INS-05): gửi yêu cầu mở một mẫu { campusId, date, tab, reason, validHours? }; Hiệu trưởng gửi thì mở ngay. */
export const requestInspectionApproval = (payload, user) => repo.requestInspectionApproval(payload, user);
/** Hàng chờ của Hiệu trưởng: { campusId?, status? } → [{ id, campusId, date, tab, status, reason, requestedByName, ... }]. */
export const getInspectionApprovals = (filters, user) => repo.getInspectionApprovals(filters, user);
/** Hiệu trưởng duyệt / từ chối / thu hồi: { approvalId, decision: 'approve' | 'reject' | 'revoke', note, validHours? }. */
export const decideInspectionApproval = (payload, user) => repo.decideInspectionApproval(payload, user);
