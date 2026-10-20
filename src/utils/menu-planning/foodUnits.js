/*
 * Đơn vị của thực phẩm (BA 02 "Units & Conversions"): đơn vị công thức (g/ml), đơn vị kho, đơn vị mua.
 * 1 đơn vị mua = purchaseToStock đơn vị kho; 1 đơn vị kho = stockUnitSize g/ml. Không tự đổi lít ↔ gram.
 * Thực phẩm cũ chưa khai đơn vị kho: đơn vị kho = đơn vị mua (tỷ lệ 1), giữ nguyên số tồn/xuất đã có.
 */
export const UNIT_KIND = { PURCHASE: 'PURCHASE', STOCK: 'STOCK' };

const positive = (v) => (Number(v) > 0 ? Number(v) : null);
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Đơn vị đã chuẩn hóa của một thực phẩm (đọc được cả thực phẩm cũ). */
export const foodUnits = (food = {}) => {
  const recipeUnit = food.unit || 'g';
  const purchaseUnitSize = positive(food.purchaseUnitSize) || 1;
  const declared = String(food.stockUnit || '').trim();
  const purchaseUnit = String(food.purchaseUnit || '').trim() || declared || recipeUnit;
  if (!declared) return { recipeUnit, purchaseUnit, stockUnit: purchaseUnit, purchaseToStock: 1, stockUnitSize: purchaseUnitSize };
  const purchaseToStock = positive(food.purchaseToStock) || 1;
  return {
    recipeUnit,
    purchaseUnit,
    stockUnit: declared,
    purchaseToStock,
    stockUnitSize: positive(food.stockUnitSize) || purchaseUnitSize / purchaseToStock,
  };
};

/** Số g/ml trong một đơn vị mua = tỷ lệ mua→kho × tỷ lệ kho→công thức (giữ `purchaseUnitSize` cho chỗ tính giá, đi chợ). */
export const purchaseUnitSizeOf = (purchaseToStock, stockUnitSize) => r3(Number(purchaseToStock) * Number(stockUnitSize));

/** Lượng trên dòng phiếu nhập (theo đơn vị mua hoặc kho) đổi sang đơn vị kho. Dòng cũ không ghi loại = đơn vị kho. */
export const toStockQty = (food, qty, unitKind) =>
  unitKind === UNIT_KIND.PURCHASE ? r3(Number(qty) * foodUnits(food).purchaseToStock) : r3(Number(qty));

/** Tên đơn vị của dòng phiếu nhập. */
export const lineUnitName = (food, unitKind) =>
  unitKind === UNIT_KIND.PURCHASE ? foodUnits(food).purchaseUnit : foodUnits(food).stockUnit;

/** Đơn vị mua khác đơn vị kho ⇒ dòng phiếu nhập cho chọn đơn vị. */
export const hasPurchaseConversion = (food) => {
  const u = foodUnits(food);
  return u.purchaseUnit !== u.stockUnit || u.purchaseToStock !== 1;
};
