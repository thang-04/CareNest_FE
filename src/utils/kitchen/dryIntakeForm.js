import { emptyLine, mapReceiptErrors } from './stockReceiptForm';

/*
 * Form một đợt hàng khô giao trong ngày (kiểm nhận hàng hôm nay): dòng như phiếu nhập kho, thêm Đạt / Không đạt và ghi chú.
 * Kiểm tra chỉ nhắc nhập đủ ô; dòng nào vào kho, đủ/thiếu so với lượng đặt do BE quyết (BE: NUT-11, NUT-12).
 */
export const emptyIntakeLine = () => emptyLine({ passed: true, note: '' });

export const emptyDryIntakeForm = () => ({ supplierId: '', note: '', lines: [emptyIntakeLine()] });

const blank = (v) => v === '' || v == null;

/** Lỗi theo ô như phiếu nhập; dòng không đạt cần ghi biện pháp xử lý. Rỗng = đủ để gửi. */
export const validateDryIntakeForm = (form) => {
  const errors = {};
  if (blank(form.supplierId)) errors.supplierId = 'Chọn nhà cung cấp';
  if (!form.lines.length) errors.lines = 'Thêm ít nhất một thực phẩm';
  form.lines.forEach((line, i) => {
    if (blank(line.foodId)) errors[`lines.${i}.foodId`] = 'Chọn thực phẩm';
    if (blank(line.lotNo)) errors[`lines.${i}.lotNo`] = 'Nhập số lô';
    if (blank(line.expiryDate)) errors[`lines.${i}.expiryDate`] = 'Chọn hạn sử dụng';
    if (blank(line.purchaseQty) || !(Number(line.purchaseQty) > 0)) errors[`lines.${i}.purchaseQty`] = 'Nhập số lượng lớn hơn 0';
    if (blank(line.unitPrice) || !(Number(line.unitPrice) >= 0)) errors[`lines.${i}.unitPrice`] = 'Nhập đơn giá';
    if (!line.passed && !String(line.note || '').trim()) errors[`lines.${i}.note`] = 'Ghi biện pháp xử lý (trả lại, tiêu hủy...)';
  });
  return errors;
};

export const mapDryIntakeErrors = mapReceiptErrors;
