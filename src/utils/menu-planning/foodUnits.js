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

const norm = (s) =>
  String(s || '')
    .trim()
    .toLowerCase();
// Đơn vị kho phổ thông ⇒ [đơn vị công thức, số g/ml trong 1 đơn vị kho]; tên khác thì người dùng tự nhập
const KNOWN_STOCK_UNITS = new Map([
  ['kg', ['g', 1000]],
  ['g', ['g', 1]],
  ['lít', ['ml', 1000]],
  ['lit', ['ml', 1000]],
  ['l', ['ml', 1000]],
  ['ml', ['ml', 1]],
]);

/** Đơn vị đo chuẩn có tỷ lệ cố định; chỉ bao gói như hộp, chai, gói mới cần nhập dung lượng. */
export const fixedPurchaseUnit = (purchaseUnit) => {
  const known = KNOWN_STOCK_UNITS.get(norm(purchaseUnit));
  return known ? { unit: known[0], size: known[1] } : null;
};

/** Form tạo mới: đổi đơn vị chuẩn thì đồng bộ toàn bộ tỷ lệ; đổi sang bao gói thì yêu cầu nhập lại dung lượng. */
export const selectNewFoodPurchaseUnit = (food, purchaseUnit) => {
  if (purchaseUnit === food.purchaseUnit) return food;
  const fixed = fixedPurchaseUnit(purchaseUnit);
  if (fixed)
    return {
      ...food,
      unit: fixed.unit,
      purchaseUnit,
      purchaseUnitSize: fixed.size,
      stockUnit: purchaseUnit,
      stockUnitSize: fixed.size,
      purchaseToStock: 1,
    };
  return { ...food, purchaseUnit, purchaseUnitSize: '', purchaseToStock: '' };
};

/** Bao gói đổi từ khối lượng sang thể tích (hoặc ngược lại) phải nhập lại dung lượng, không tự đổi g ↔ ml. */
export const selectNewFoodBaseUnit = (food, unit) => {
  if (fixedPurchaseUnit(food.purchaseUnit) || unit === food.unit) return food;
  return {
    ...food,
    unit,
    stockUnit: unit === 'ml' ? 'lít' : 'kg',
    stockUnitSize: 1000,
    purchaseUnitSize: '',
    purchaseToStock: '',
  };
};

/** Tỷ lệ hiển nhiên không cần nhập: mua trùng kho ⇒ 1; kg/lít ↔ g/ml ⇒ 1000. Chỉ trả ô nào suy ra được. */
export const autoUnitRatios = ({ unit, purchaseUnit, stockUnit }) => {
  const stock = norm(stockUnit);
  const auto = {};
  if (stock && stock === norm(purchaseUnit)) auto.purchaseToStock = 1;
  const known = KNOWN_STOCK_UNITS.get(stock);
  if (known && known[0] === unit) auto.stockUnitSize = known[1];
  return auto;
};

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

/** Nhãn đơn vị gốc của thực phẩm cho bảng cân đối: nhỏ g / ml, lớn kg / lít (thiếu đơn vị ⇒ g). */
export const baseUnitLabels = (unit) =>
  String(unit || '').toLowerCase() === 'ml' ? { small: 'ml', big: 'lít' } : { small: 'g', big: 'kg' };
