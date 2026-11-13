import { isIsoDate } from '@/utils/format';

/*
 * Ô nhập của bản dự trù và kiểm nhận hàng tươi. Chỉ gom và kiểm định dạng ô; số lượng, kết quả, lần kiểm nào mở được do BE quyết.
 */
const blank = (v) => v === '' || v == null;

export const emptyForecastForm = ({ campusId, today }) => ({ campusId, periodFrom: today, periodTo: today, note: '', counts: null });

/** Số trẻ theo nhóm tuổi BE trả -> ô nhập (chuỗi) để sửa số dự kiến. */
export const countsToForm = (counts = []) =>
  counts.map(({ ageGroupId, ageGroupName, enrolledCount, expectedCount }) => ({
    ageGroupId,
    ageGroupName,
    enrolledCount,
    expectedCount: String(expectedCount ?? ''),
  }));

/** Khóa các ô quyết định bảng dự trù (kỳ + số trẻ dự kiến); ghi chú không ảnh hưởng số lượng nên không tính. */
export const forecastInputKey = (form) =>
  JSON.stringify([form.campusId, form.periodFrom, form.periodTo, (form.counts || []).map((c) => [c.ageGroupId, c.expectedCount])]);

/** Lỗi theo ô: kỳ phải là ngày đủ và đúng thứ tự, số trẻ dự kiến là số nguyên từ 0. Độ dài kỳ do BE kiểm. */
export const validateForecastForm = (form) => {
  const errors = {};
  if (!isIsoDate(form.periodFrom)) errors.periodFrom = 'Chọn ngày bắt đầu kỳ dự trù';
  if (!isIsoDate(form.periodTo)) errors.periodTo = 'Chọn ngày kết thúc kỳ dự trù';
  if (!errors.periodFrom && !errors.periodTo && form.periodFrom > form.periodTo) errors.periodTo = 'Đến ngày phải sau Từ ngày';
  (form.counts || []).forEach((count, i) => {
    const n = Number(count.expectedCount);
    if (blank(count.expectedCount) || !Number.isInteger(n) || n < 0) errors[`counts.${i}`] = 'Nhập số nguyên từ 0';
  });
  return errors;
};

/** Lần kiểm BE trả -> ô nhập (số thực nhận theo đơn vị mua). */
export const roundToForm = (round) => ({
  note: round?.note || '',
  lines: (round?.lines || []).map((line) => ({
    foodId: line.food.id,
    receivedQty: line.purchaseReceivedQty == null ? '' : String(line.purchaseReceivedQty),
    result: line.result || '',
    note: line.note || '',
  })),
});

/** Mỗi thực phẩm phải có kết quả; số thực nhận có thể bỏ trống nhưng đã nhập thì là số không âm. */
export const validateRoundForm = (form) => {
  const errors = {};
  form.lines.forEach((line, i) => {
    if (!line.result) errors[`lines.${i}.result`] = 'Chọn kết quả';
    if (!blank(line.receivedQty) && !(Number(line.receivedQty) >= 0)) errors[`lines.${i}.receivedQty`] = 'Nhập số không âm';
  });
  return errors;
};

/**
 * Chia dòng cần nhận thành các nhóm thực phẩm (rau, thịt...) để bảng hiện hai cấp. `groupOfFood` = Map(foodId -> mã nhóm);
 * thực phẩm chưa rõ nhóm vào "Khác". Nhóm theo thứ tự danh mục; `index` giữ vị trí dòng để khớp ô nhập.
 */
export const groupRoundLines = (lines, groupOfFood, labels) => {
  const keys = Object.keys(labels);
  const buckets = new Map();
  lines.forEach((line, index) => {
    const raw = groupOfFood?.get(String(line.food.id));
    const key = keys.includes(raw) ? raw : 'OTHER';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ line, index });
  });
  return keys.filter((key) => buckets.has(key)).map((key) => ({ key, label: labels[key], rows: buckets.get(key) }));
};

/** Đếm số dòng theo kết quả đã chọn trong ô nhập, để báo lại trong hộp xác nhận. */
export const tallyResults = (form) =>
  form.lines.reduce((acc, line) => (line.result ? { ...acc, [line.result]: (acc[line.result] || 0) + 1 } : acc), {});

/** Sửa lại lần đã ghi: lý do được ghi vào đầu ghi chú chung (BE chưa có field riêng). */
export const withEditReason = (note, reason) => {
  const head = `Sửa lại: ${String(reason).trim()}`;
  return note?.trim() ? `${head}. ${note.trim()}` : head;
};

/** Mã trạng thái hiển thị của một lần kiểm từ cờ BE trả. */
export const roundState = (round) => {
  if (round.recorded) return 'RECORDED';
  return round.available ? 'PENDING' : 'UNAVAILABLE';
};
