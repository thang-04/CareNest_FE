import {
  FRESH_RESULT,
  ALL_MEAL_SESSIONS as MEAL_SESSIONS,
  MEAL_SESSIONS as LEGACY_PREP_SESSIONS,
  PREP_STATUS_ORDER,
  NOTE_MAX,
} from '@/models/kitchen/kitchenConstants';

/* Each validator returns { field: message }; empty object = valid. Used by forms and by the mock repository (422). */

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const tooLong = (v, max = NOTE_MAX) => String(v || '').length > max;

const PHONE = /^(\+84|0)\d{9,10}$/;
const TAX_CODE = /^\d{10}(-\d{3})?$/;

/** NCC (BA 01): bắt buộc tên; SĐT, mã số thuế chỉ kiểm định dạng khi có nhập. Mã do hệ thống sinh nên không kiểm. */
export const validateSupplier = (payload) => {
  const errors = {};
  const name = String(payload.name || '').trim();
  if (!name) errors.name = 'Nhập tên nhà cung cấp.';
  else if (name.length > 150) errors.name = 'Tối đa 150 ký tự.';
  if (tooLong(payload.address, 255)) errors.address = 'Tối đa 255 ký tự.';
  if (tooLong(payload.contactName, 100)) errors.contactName = 'Tối đa 100 ký tự.';
  const phone = String(payload.phone || '').replace(/[\s.-]/g, '');
  if (phone && !PHONE.test(phone)) errors.phone = 'Số điện thoại gồm 10–11 chữ số, bắt đầu bằng 0 hoặc +84.';
  const taxCode = String(payload.taxCode || '').trim();
  if (taxCode && !TAX_CODE.test(taxCode)) errors.taxCode = 'Mã số thuế gồm 10 chữ số, chi nhánh thêm "-" và 3 chữ số.';
  return errors;
};

/**
 * Phiếu nhập: nháp chỉ cần ngày, thực phẩm, số lượng; xác nhận (mặc định) bắt buộc NCC, lô, NSX, HSD, đơn giá theo BA.
 * Dòng không đạt chất lượng phải có lý do. Khóa lỗi theo dòng `items.i.field`.
 */
export const validateStockReceipt = (payload, today, { confirm = true } = {}) => {
  const errors = {};
  if (!isDate(payload.date)) errors.date = 'Chọn ngày nhập kho.';
  else if (today && payload.date > today) errors.date = 'Ngày nhập kho không được sau hôm nay.';
  if (tooLong(payload.note)) errors.note = `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
  if (confirm && !payload.supplierId) errors.supplierId = 'Chọn nhà cung cấp.';
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
    if (tooLong(it.lotNo, 50)) errors[`items.${i}.lotNo`] = 'Tối đa 50 ký tự.';
    else if (confirm && !String(it.lotNo || '').trim()) errors[`items.${i}.lotNo`] = 'Nhập số lô.';
    if (it.mfgDate && !isDate(it.mfgDate)) errors[`items.${i}.mfgDate`] = 'Ngày sản xuất không hợp lệ.';
    else if (confirm && !isDate(it.mfgDate)) errors[`items.${i}.mfgDate`] = 'Nhập ngày sản xuất.';
    else if (it.mfgDate && today && it.mfgDate > today) errors[`items.${i}.mfgDate`] = 'Ngày sản xuất không được sau hôm nay.';
    if (it.expiryDate && !isDate(it.expiryDate)) errors[`items.${i}.expiryDate`] = 'Hạn sử dụng không hợp lệ.';
    else if (confirm && !isDate(it.expiryDate)) errors[`items.${i}.expiryDate`] = 'Nhập hạn sử dụng.';
    else if (isDate(it.mfgDate) && isDate(it.expiryDate) && it.expiryDate < it.mfgDate)
      errors[`items.${i}.expiryDate`] = 'Hạn sử dụng phải sau ngày sản xuất.';
    const price = num(it.unitPrice);
    if (it.unitPrice !== '' && it.unitPrice != null && !(price >= 0)) errors[`items.${i}.unitPrice`] = 'Đơn giá từ 0 trở lên.';
    else if (confirm && !(price >= 0)) errors[`items.${i}.unitPrice`] = 'Nhập đơn giá (từ 0).';
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

/** Kiểm nhận hàng tươi: số giao, thực nhận từ 0; dòng thiếu / trả lại cần lý do. Gửi PHT thì cần số phiếu giao hàng. */
export const validateFreshReceipt = ({ header, lines }, { submit = false } = {}) => {
  const errors = {};
  if (submit && !String(header?.deliveryNote || '').trim()) errors.deliveryNote = 'Nhập số phiếu giao hàng.';
  if (tooLong(header?.deliveryNote, 50)) errors.deliveryNote = 'Số phiếu tối đa 50 ký tự.';
  if (tooLong(header?.supplierName, 150)) errors.supplierName = 'Tên NCC tối đa 150 ký tự.';
  (lines || []).forEach((l, i) => {
    if (!(num(l.delivered) >= 0)) errors[`items.${i}.delivered`] = 'Nhập số giao (từ 0).';
    if (!(num(l.received) >= 0)) errors[`items.${i}.received`] = 'Nhập số thực nhận (từ 0).';
    if (!Object.values(FRESH_RESULT).includes(l.result)) errors[`items.${i}.result`] = 'Chọn kết quả.';
    else if (l.result !== FRESH_RESULT.OK && !String(l.reason || '').trim()) errors[`items.${i}.reason`] = 'Ghi lý do thiếu hoặc trả lại.';
    if (tooLong(l.reason, 200)) errors[`items.${i}.reason`] = 'Lý do tối đa 200 ký tự.';
  });
  return errors;
};

/** Lưu mẫu (Mẫu 5): ngày không sau hôm nay, giờ lấy HH:MM, mỗi món có khối lượng / thể tích; khóa lỗi `dishes.i.field`. */
export const validateFoodSample = (payload, today) => {
  const errors = {};
  if (!isDate(payload.date)) errors.date = 'Chọn ngày.';
  else if (today && payload.date > today) errors.date = 'Không ghi lưu mẫu cho ngày sau hôm nay.';
  if (!MEAL_SESSIONS.includes(payload.session)) errors.session = 'Bữa ăn không hợp lệ.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.takenAt || '')) errors.takenAt = 'Nhập giờ lấy mẫu.';
  const dishes = payload.dishes || [];
  if (!dishes.length) errors.dishes = 'Bữa chưa có món để lưu mẫu.';
  dishes.forEach((d, i) => {
    if (!String(d.weight || '').trim()) errors[`dishes.${i}.weight`] = 'Nhập khối lượng / thể tích.';
    else if (tooLong(d.weight, 30)) errors[`dishes.${i}.weight`] = 'Tối đa 30 ký tự.';
    if (tooLong(d.container, 100)) errors[`dishes.${i}.container`] = 'Tối đa 100 ký tự.';
    if (tooLong(d.temperature, 30)) errors[`dishes.${i}.temperature`] = 'Tối đa 30 ký tự.';
    if (tooLong(d.note, 200)) errors[`dishes.${i}.note`] = 'Tối đa 200 ký tự.';
  });
  return errors;
};

/** Dự trù tuần: mỗi ô là số suất nguyên từ 0; khóa lỗi `classId|date`. Giới hạn theo số trẻ đăng ký do service kiểm. */
export const validateForecastCells = (cells) => {
  const errors = {};
  Object.entries(cells || {}).forEach(([classId, byDate]) =>
    Object.entries(byDate || {}).forEach(([date, raw]) => {
      const n = num(raw);
      if (!isDate(date)) errors[`${classId}|${date}`] = 'Ngày không hợp lệ.';
      else if (!Number.isInteger(n) || n < 0) errors[`${classId}|${date}`] = 'Nhập số nguyên từ 0.';
    }),
  );
  return errors;
};

/** Index errors of item rows: errors['items.2.receivedQty'] → itemError(errors, 2, 'receivedQty'). */
export const itemError = (errors, index, field) => errors?.[`items.${index}.${field}`];

export const validatePreparationUpdate = (payload, currentStatus, today) => {
  const errors = {};
  if (!isDate(payload.date)) errors.date = 'Chọn ngày.';
  else if (today && payload.date > today) errors.date = 'Không cập nhật cho ngày sau hôm nay.';
  if (!LEGACY_PREP_SESSIONS.includes(payload.session)) errors.session = 'Chọn bữa ăn.';
  const next = PREP_STATUS_ORDER.indexOf(payload.status);
  if (next === -1) errors.status = 'Chọn trạng thái chế biến.';
  else if (currentStatus && next < PREP_STATUS_ORDER.indexOf(currentStatus))
    errors.status = 'Trạng thái chỉ được chuyển tiếp, không quay lại.';
  else if (currentStatus === payload.status && !String(payload.note || '').trim())
    errors.note = 'Trạng thái không đổi: nhập ghi chú cần cập nhật.';
  if (tooLong(payload.note)) errors.note = `Ghi chú tối đa ${NOTE_MAX} ký tự.`;
  return errors;
};
