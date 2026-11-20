export const NO_SUPPLIER_LABEL = 'Chưa gán nhà cung cấp';

/**
 * Dòng đi chợ gom theo NCC BE trả tại ngày (NUT-27) để đặt hàng từng nhà cung cấp: thứ tự NCC theo lần xuất hiện đầu,
 * nhóm chưa gán NCC để cuối. Chỉ xếp lại dòng, không cộng tiền (BE không trả tổng theo NCC cho màn này).
 */
export function dayMarketSupplierGroups(lines = []) {
  const groups = new Map();
  lines.forEach((line) => {
    const key = line.supplierId == null ? 'none' : String(line.supplierId);
    if (!groups.has(key)) groups.set(key, { key, label: line.supplierId == null ? NO_SUPPLIER_LABEL : line.supplierName, lines: [] });
    groups.get(key).lines.push(line);
  });
  const none = groups.get('none');
  groups.delete('none');
  return none ? [...groups.values(), none] : [...groups.values()];
}
