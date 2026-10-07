import { TRANSFER_TYPES } from '@/models/facility-transfer/transferConstants';

/**
 * Shared validation. Used by the wizard (instant feedback) and by the mock
 * repository (server-side check), so both always agree.
 * Each function returns { field: message }; empty object = valid.
 */

export const validateGeneralInfo = (form) => {
  const e = {};
  if (!form.createdDate) e.createdDate = 'Vui lòng chọn ngày lập';
  if (!form.expectedHandoverDate) e.expectedHandoverDate = 'Vui lòng chọn ngày dự kiến bàn giao';
  else if (form.createdDate && form.expectedHandoverDate < form.createdDate)
    e.expectedHandoverDate = 'Ngày dự kiến bàn giao phải từ ngày lập trở đi';
  if (!form.type) e.type = 'Vui lòng chọn loại luân chuyển';
  if (!form.fromCampusId) e.fromCampusId = 'Vui lòng chọn campus';
  if (form.type === TRANSFER_TYPES.INTER_CAMPUS) {
    if (!form.toCampusId) e.toCampusId = 'Vui lòng chọn campus đến';
    else if (form.toCampusId === form.fromCampusId) e.toCampusId = 'Campus đến phải khác campus đi';
  }
  if (!form.fromLocationId) e.fromLocationId = 'Vui lòng chọn nơi đi';
  if (!form.toLocationId) e.toLocationId = 'Vui lòng chọn nơi đến';
  else if (form.toLocationId === form.fromLocationId) e.toLocationId = 'Nơi đến không được trùng nơi đi';
  if (!form.reason?.trim()) e.reason = 'Vui lòng nhập lý do luân chuyển';
  else if (form.reason.length > 500) e.reason = 'Lý do tối đa 500 ký tự';
  if ((form.note || '').length > 500) e.note = 'Ghi chú tối đa 500 ký tự';
  return e;
};

export const validateCreatorSignature = (form) =>
  form.creatorSignatureUrl ? {} : { creatorSignature: 'Vui lòng chọn hoặc tải lên chữ ký người tạo phiếu' };

/**
 * @param items transfer items
 * @param availableById map assetId -> available quantity at the sending location
 */
export const validateItems = (items, availableById) => {
  const e = {};
  if (!items?.length) {
    e.items = 'Vui lòng chọn ít nhất 1 tài sản';
    return e;
  }
  items.forEach((item) => {
    const qty = Number(item.quantity);
    const available = availableById?.[item.assetId];
    if (!Number.isInteger(qty) || qty <= 0) e[`item_${item.assetId}`] = 'Số lượng phải lớn hơn 0';
    else if (available != null && qty > available) e[`item_${item.assetId}`] = `Vượt số lượng hiện có (${available})`;
  });
  return e;
};

export const validateAssignees = (form) => {
  const e = {};
  if (!form.handoverUserId) e.handoverUserId = 'Vui lòng chọn người bàn giao';
  if (!form.receiverUserId) e.receiverUserId = 'Vui lòng chọn người nhận';
  if (form.handoverUserId && form.handoverUserId === form.receiverUserId) e.receiverUserId = 'Người nhận phải khác người bàn giao';
  return e;
};

export const validateWholeTransfer = (form, availableById) => ({
  ...validateGeneralInfo(form),
  ...validateItems(form.items, availableById),
  ...validateAssignees(form),
});

export const hasErrors = (errors) => Object.keys(errors).length > 0;
export const firstError = (errors) => Object.values(errors)[0];
