import { formatQty } from '@/utils/format';

/*
 * Kho khô lưu số lượng theo đơn vị gốc của thực phẩm (g hoặc ml); phiếu nhập và các màn hình hiện theo đơn vị mua
 * (kg, quả, hộp…). `purchaseUnitSize` = số đơn vị gốc trong một đơn vị mua; đơn giá luôn tính trên một đơn vị mua.
 */
const round3 = (n) => Math.round(n * 1000) / 1000;

const sizeOf = (food) => {
  const size = Number(food?.purchaseUnitSize);
  return Number.isFinite(size) && size > 0 ? size : 1;
};

/** Số nhập theo đơn vị mua -> số gửi BE theo đơn vị gốc. */
export const toBaseQuantity = (purchaseQty, food) => round3(Number(purchaseQty) * sizeOf(food));

/** Số BE theo đơn vị gốc -> số hiện theo đơn vị mua. */
export const toPurchaseQuantity = (quantity, food) => round3(Number(quantity) / sizeOf(food));

/** "2,5 kg" từ số lượng đơn vị gốc của BE. */
export const formatPurchaseQty = (quantity, food) => `${formatQty(toPurchaseQuantity(quantity, food))} ${food?.purchaseUnit || ''}`.trim();

const BIG_UNITS = { g: 'kg', ml: 'lít' };

/** Biến động dễ đọc theo đơn vị gốc: "−502 g", "−5,29 kg", "+1,5 lít"; đơn vị khác giữ theo đơn vị mua. */
export const formatStockChange = (quantity, food) => {
  const unit = String(food?.unit || '').toLowerCase();
  if (!BIG_UNITS[unit]) return formatSignedPurchaseQty(quantity, food);
  const sign = Number(quantity) < 0 ? '−' : '+';
  const abs = Math.abs(Number(quantity));
  if (abs < 1000) return `${sign}${Math.round(abs).toLocaleString('vi-VN')} ${unit}`;
  return `${sign}${(abs / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ${BIG_UNITS[unit]}`;
};

/** Biến động có dấu: "+2 kg" hoặc "−0,5 kg". */
export const formatSignedPurchaseQty = (quantity, food) => {
  const sign = Number(quantity) < 0 ? '−' : '+';
  return `${sign}${formatPurchaseQty(Math.abs(Number(quantity)), food)}`;
};
