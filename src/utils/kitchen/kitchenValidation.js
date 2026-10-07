import { MEAL_SESSIONS, NOTE_MAX, PREP_STATUS_ORDER } from '@/models/kitchen/kitchenConstants';

/* Each validator returns { field: message }; empty object = valid. Used by forms and by the mock repository (422). */

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const tooLong = (v, max = NOTE_MAX) => String(v || '').length > max;

/** UC 6.23: each line needs a food, a received quantity and, when goods are rejected, a reason. */
export const validateStockReceipt = (payload, today) => {
  const errors = {};
  if (!isDate(payload.date)) errors.date = 'Chọn ngày nhập kho.';
  else if (today && payload.date > today) errors.date = 'Ngày nhập kho không được sau hôm nay.';
  if (tooLong(payload.note)) errors.note = `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
  const items = payload.items || [];
  if (items.length === 0) errors.items = 'Thêm ít nhất một thực phẩm.';
  const seen = new Set();
  items.forEach((it, i) => {
    const received = num(it.receivedQty);
    const rejected = it.rejectedQty === '' || it.rejectedQty === undefined ? 0 : num(it.rejectedQty);
    if (!it.foodId) errors[`items.${i}.foodId`] = 'Chọn thực phẩm.';
    else if (seen.has(it.foodId)) errors[`items.${i}.foodId`] = 'Thực phẩm bị trùng dòng.';
    seen.add(it.foodId);
    if (!(received > 0)) errors[`items.${i}.receivedQty`] = 'Nhập số lượng nhận lớn hơn 0.';
    if (!(rejected >= 0)) errors[`items.${i}.rejectedQty`] = 'Số lượng không đạt phải từ 0 trở lên.';
    else if (received > 0 && rejected > received) errors[`items.${i}.rejectedQty`] = 'Không vượt quá số lượng nhận.';
    if (rejected > 0 && !String(it.note || '').trim()) errors[`items.${i}.note`] = 'Ghi lý do không đạt chất lượng.';
    if (it.expiryDate && !isDate(it.expiryDate)) errors[`items.${i}.expiryDate`] = 'Hạn sử dụng không hợp lệ.';
  });
  return errors;
};

/** UC 6.25: the received quantity of every issued item. */
export const validateIngredientReceipt = (items) => {
  const errors = {};
  (items || []).forEach((it, i) => {
    const q = num(it.receivedQty);
    if (!(q >= 0)) errors[`items.${i}.receivedQty`] = 'Nhập số lượng thực nhận (từ 0 trở lên).';
    if (tooLong(it.note)) errors[`items.${i}.note`] = `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
  });
  return errors;
};

/** UC 6.19: ingredient, affected quantity, meal or date and a description. */
export const validateMissingFood = (payload, today) => {
  const errors = {};
  if (!isDate(payload.date)) errors.date = 'Chọn ngày cần thực phẩm.';
  else if (today && payload.date < today) errors.date = 'Chỉ báo thiếu cho hôm nay hoặc ngày sau.';
  if (payload.session && !MEAL_SESSIONS.includes(payload.session)) errors.session = 'Bữa ăn không hợp lệ.';
  if (!payload.foodId) errors.foodId = 'Chọn thực phẩm bị thiếu.';
  if (!(num(payload.quantity) > 0)) errors.quantity = 'Nhập số lượng thiếu lớn hơn 0.';
  if (!String(payload.description || '').trim()) errors.description = 'Mô tả tình trạng thiếu.';
  else if (tooLong(payload.description)) errors.description = `Mô tả tối đa ${NOTE_MAX} ký tự.`;
  return errors;
};

/** UC 6.17: date, session and a status that does not move back (GBR "only moves forward"). */
export const validatePreparationUpdate = (payload, currentStatus, today) => {
  const errors = {};
  if (!isDate(payload.date)) errors.date = 'Chọn ngày.';
  else if (today && payload.date > today) errors.date = 'Không cập nhật cho ngày sau hôm nay.';
  if (!MEAL_SESSIONS.includes(payload.session)) errors.session = 'Chọn bữa ăn.';
  const next = PREP_STATUS_ORDER.indexOf(payload.status);
  if (next === -1) errors.status = 'Chọn trạng thái chế biến.';
  else if (currentStatus && next < PREP_STATUS_ORDER.indexOf(currentStatus))
    errors.status = 'Trạng thái chỉ được chuyển tiếp, không quay lại.';
  else if (currentStatus === payload.status && !String(payload.note || '').trim())
    errors.note = 'Trạng thái không đổi: nhập ghi chú cần cập nhật.';
  if (tooLong(payload.note)) errors.note = `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
  return errors;
};

/** Index errors of item rows: errors['items.2.receivedQty'] → itemError(errors, 2, 'receivedQty'). */
export const itemError = (errors, index, field) => errors?.[`items.${index}.${field}`];
