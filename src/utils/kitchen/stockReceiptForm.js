import { toPurchaseQuantity } from './stockUnits';

/* Form phiếu nhập kho khô: số lượng nhập theo đơn vị mua. Kiểm tra chỉ để nhắc nhập đủ ô; BE kiểm tra thật khi lưu/xác nhận. */
let lineSeq = 0;
export const emptyLine = (over = {}) => ({
  key: `line-${(lineSeq += 1)}`,
  foodId: '',
  lotNo: '',
  expiryDate: '',
  purchaseQty: '',
  unitPrice: '',
  ...over,
});

export const emptyReceiptForm = ({ campusId = '', today = '', foodId = '' } = {}) => ({
  campusId,
  supplierId: '',
  receivedDate: today,
  note: '',
  lines: [emptyLine({ foodId })],
});

/** Phiếu BE -> giá trị form (số lượng đổi sang đơn vị mua). */
export const receiptToForm = (receipt) => ({
  campusId: String(receipt.campusId ?? ''),
  supplierId: String(receipt.supplierId ?? ''),
  receivedDate: receipt.receivedDate || '',
  note: receipt.note || '',
  lines: (receipt.lines || []).map((line) =>
    emptyLine({
      foodId: String(line.food?.id ?? ''),
      lotNo: line.lotNo || '',
      expiryDate: line.expiryDate || '',
      purchaseQty: String(toPurchaseQuantity(line.quantity, line.food)),
      unitPrice: line.unitPrice == null ? '' : String(line.unitPrice),
    }),
  ),
});

const blank = (v) => v === '' || v == null;

/** Lỗi theo ô: { campusId, supplierId, receivedDate, lines, 'lines.0.purchaseQty', … }. Rỗng = đủ để gửi. */
export const validateReceiptForm = (form) => {
  const errors = {};
  if (blank(form.campusId)) errors.campusId = 'Chọn điểm trường';
  if (blank(form.supplierId)) errors.supplierId = 'Chọn nhà cung cấp';
  if (blank(form.receivedDate)) errors.receivedDate = 'Chọn ngày nhập kho';
  if (!form.lines.length) errors.lines = 'Thêm ít nhất một thực phẩm';
  form.lines.forEach((line, i) => {
    if (blank(line.foodId)) errors[`lines.${i}.foodId`] = 'Chọn thực phẩm';
    if (blank(line.lotNo)) errors[`lines.${i}.lotNo`] = 'Nhập số lô';
    if (blank(line.expiryDate)) errors[`lines.${i}.expiryDate`] = 'Chọn hạn sử dụng';
    if (blank(line.purchaseQty) || !(Number(line.purchaseQty) > 0)) errors[`lines.${i}.purchaseQty`] = 'Nhập số lượng lớn hơn 0';
    if (blank(line.unitPrice) || !(Number(line.unitPrice) >= 0)) errors[`lines.${i}.unitPrice`] = 'Nhập đơn giá';
  });
  return errors;
};

// Tên ô trong lỗi BE (lines[0].quantity) -> ô trên form (lines.0.purchaseQty)
const LINE_FIELD = { quantity: 'purchaseQty' };

/** Lỗi 400 của BE (details theo tên field DTO) -> khóa ô của form; phần không nhận ra gom vào `_form`. */
export const mapReceiptErrors = (details = {}) =>
  Object.fromEntries(
    Object.entries(details).map(([key, message]) => {
      const line = /^lines\[(\d+)\]\.(\w+)$/.exec(key);
      if (line) return [`lines.${line[1]}.${LINE_FIELD[line[2]] || line[2]}`, message];
      return [key, message];
    }),
  );
