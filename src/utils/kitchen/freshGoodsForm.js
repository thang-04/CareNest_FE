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

/** Lỗi theo ô: kỳ phải là ngày đủ, số trẻ dự kiến là số nguyên từ 0. Thứ tự ngày và độ dài kỳ do BE kiểm. */
export const validateForecastForm = (form) => {
  const errors = {};
  if (!isIsoDate(form.periodFrom)) errors.periodFrom = 'Chọn ngày bắt đầu kỳ dự trù';
  if (!isIsoDate(form.periodTo)) errors.periodTo = 'Chọn ngày kết thúc kỳ dự trù';
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

/** Mã trạng thái hiển thị của một lần kiểm từ cờ BE trả. */
export const roundState = (round) => {
  if (round.recorded) return 'RECORDED';
  return round.available ? 'PENDING' : 'UNAVAILABLE';
};
