import { ISSUE_TYPES, REQUEST_ITEM_MODES, MAX_QUANTITY, PROPOSAL_ACTION_LABELS } from '@/models/facility/facilityConstants';

/*
 * Shared validation of the facility module (UI shows the messages next to the fields,
 * the mock repository answers 422 with the same rules). SRS UC 7.2–7.4, GBR-FAC-03, GBR-FAC-05, GBR-FAC-10.
 */

const isPositiveInt = (v) => v !== '' && v !== null && v !== undefined && Number.isInteger(Number(v)) && Number(v) >= 1;

export const validateIssue = (form, asset) => {
  const e = {};
  if (!form.locationId) e.locationId = 'Vui lòng chọn lớp/phòng';
  if (!form.assetId) e.assetId = 'Vui lòng chọn tài sản gặp sự cố';
  if (!Object.values(ISSUE_TYPES).includes(form.type)) e.type = 'Vui lòng chọn loại sự cố';
  const desc = (form.description || '').trim();
  if (!desc) e.description = 'Vui lòng mô tả sự cố';
  else if (desc.length < 10) e.description = 'Mô tả quá ngắn: ghi rõ hiện trạng (ít nhất 10 ký tự)';
  else if (desc.length > 1000) e.description = 'Mô tả tối đa 1000 ký tự';
  const max = asset?.quantity ?? MAX_QUANTITY;
  if (form.type === ISSUE_TYPES.DAMAGED || form.type === ISSUE_TYPES.MISSING) {
    if (!isPositiveInt(form.quantity)) e.quantity = 'Nhập số lượng là số nguyên từ 1';
    else if (Number(form.quantity) > max) e.quantity = `Không được vượt số lượng đang có (${max})`;
  }
  if (form.type === ISSUE_TYPES.DAMAGED && !(form.images || []).length) e.images = 'Báo hư hỏng cần ít nhất 1 ảnh hiện trạng';
  if (form.type === ISSUE_TYPES.INSUFFICIENT) {
    const cur = form.currentQuantity;
    if (cur === '' || cur === null || cur === undefined || !Number.isInteger(Number(cur)) || Number(cur) < 0)
      e.currentQuantity = 'Nhập số lượng hiện có (số nguyên từ 0)';
    if (!isPositiveInt(form.quantity)) e.quantity = 'Nhập số lượng cần bổ sung (số nguyên từ 1)';
    else if (Number(form.quantity) > MAX_QUANTITY) e.quantity = `Tối đa ${MAX_QUANTITY}`;
  }
  return e;
};

export const validateRequest = (form) => {
  const e = {};
  if (!form.locationId) e.locationId = 'Vui lòng chọn lớp/phòng';
  if (form.itemMode === REQUEST_ITEM_MODES.EXISTING) {
    if (!form.assetId) e.assetId = 'Vui lòng chọn tài sản cần bổ sung';
  } else {
    if (!(form.itemName || '').trim()) e.itemName = 'Vui lòng nhập tên tài sản';
    if (!(form.unit || '').trim()) e.unit = 'Vui lòng nhập đơn vị tính';
  }
  if (!isPositiveInt(form.quantity)) e.quantity = 'Nhập số lượng là số nguyên từ 1';
  else if (Number(form.quantity) > MAX_QUANTITY) e.quantity = `Tối đa ${MAX_QUANTITY}`;
  const reason = (form.reason || '').trim();
  if (!reason) e.reason = 'Vui lòng nhập lý do đề nghị';
  else if (reason.length < 10) e.reason = 'Lý do quá ngắn: ghi rõ vì sao cần bổ sung (ít nhất 10 ký tự)';
  return e;
};

/** Reject / cancel always needs a reason (GBR-FAC-05, DESIGN 12.2). */
export const validateReason = (reason, label = 'lý do') => ((reason || '').trim() ? null : `Vui lòng nhập ${label}`);

export const validateProposalLine = (line) => {
  if (!(line.itemName || '').trim()) return 'Thiếu tên tài sản';
  if (!isPositiveInt(line.quantity)) return 'Số lượng phải là số nguyên từ 1';
  if (Number(line.quantity) > MAX_QUANTITY) return `Số lượng tối đa ${MAX_QUANTITY}`;
  const cost = line.estimatedCost;
  if (cost !== '' && cost !== null && cost !== undefined && (Number.isNaN(Number(cost)) || Number(cost) < 0)) return 'Dự toán không hợp lệ';
  return null;
};

/** `forSubmit` adds the rules that only apply when the proposal is sent to the Principal. */
export const validateProposal = (form, { forSubmit = false } = {}) => {
  const e = {};
  if (!(form.title || '').trim()) e.title = 'Vui lòng nhập tên đề xuất';
  if (!PROPOSAL_ACTION_LABELS[form.action]) e.action = 'Vui lòng chọn hình thức đề xuất';
  if (forSubmit) {
    if (!(form.reason || '').trim()) e.reason = 'Vui lòng nêu lý do / căn cứ đề xuất';
    if (!(form.lines || []).length) e.lines = 'Đề xuất cần ít nhất 1 tài sản';
  }
  (form.lines || []).forEach((l) => {
    const err = validateProposalLine(l);
    if (err) e[`line_${l.id}`] = err;
  });
  return e;
};

export const hasErrors = (e) => Object.keys(e).length > 0;
export const firstError = (e) => Object.values(e)[0];
