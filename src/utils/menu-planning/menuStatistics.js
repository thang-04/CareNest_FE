/*
 * Chọn món một ngày để gửi BE thống kê (`POST /nutrition/menu-statistics`). Chỉ lọc theo khối/ngày của lưới đã có;
 * mọi số lượng, tiền, dinh dưỡng do BE tính.
 */

/** Khối chứa nhóm tuổi theo danh sách `blocks` BE trả cho kế hoạch tuần. */
export const blockOfAgeGroup = (blocks, ageGroupId) =>
  (blocks || []).find((b) => (b.ageGroupIds || []).some((id) => String(id) === String(ageGroupId)))?.block || null;

/** Món của khối nhóm tuổi trong ngày `date` của kế hoạch tuần; ngày nghỉ hoặc nhóm không thuộc khối nào ⇒ rỗng. */
export function planDayItems(plan, date, ageGroupId) {
  const block = blockOfAgeGroup(plan?.blocks, ageGroupId);
  const day = (plan?.days || []).find((d) => d.date === date);
  if (!block || !day || day.off) return [];
  return day.items.filter((i) => i.block === block).map((i) => ({ session: i.session, dishId: Number(i.dishId) }));
}

/** Toàn bộ món của ngày, giữ khối để BE không tính món nhà trẻ cho mẫu giáo và ngược lại. */
export function allDayItems(plan, date) {
  const day = (plan?.days || []).find((d) => d.date === date);
  if (!day || day.off) return [];
  return (day.items || []).map((i) => ({ session: i.session, block: i.block, dishId: Number(i.dishId) }));
}

/** Món của bộ mẫu ở tuần `weekNo` (1–4), thứ `weekday` (1 = thứ Hai). */
export const templateDayItems = (template) => (template?.items || []).map((i) => ({ session: i.session, dishId: Number(i.dishId) }));

/** Lựa chọn nhóm tuổi theo id BE trả, tên lấy từ danh mục nhóm tuổi. */
export const ageGroupOptions = (ids, ageGroups) =>
  (ids || []).map((id) => ({
    id: String(id),
    name: (ageGroups || []).find((g) => String(g.id) === String(id))?.name || `Nhóm tuổi ${id}`,
  }));

/** Dinh dưỡng một suất của món theo nhóm tuổi, BE tính sẵn trong danh mục món; danh mục ghi nhóm tuổi bằng id hoặc mã. */
export const dishNutrition = (dish, ageGroup) =>
  (dish?.nutritionByAgeGroup || []).find((n) =>
    [ageGroup?.id, ageGroup?.code].some((key) => key != null && String(n.ageGroupId) === String(key)),
  ) || null;

/** Link mở trang thống kê từ kế hoạch tuần hoặc bộ mẫu. */
export const statisticsHref = (source) =>
  `/menu/statistics?${new URLSearchParams(Object.entries(source).filter(([, v]) => v != null && v !== '')).toString()}`;

/**
 * Dòng thành phần dự phòng từ danh mục món khi BE chưa trả `dishIngredients`: chỉ tên thực phẩm, lượng ăn, thải bỏ.
 * Lượng mua, đơn giá, thành tiền để trống vì do BE tính (không tự tính ở FE).
 */
export const catalogIngredientLines = (items, dishes, foods, groupCode) => {
  if (!groupCode) return [];
  const dishById = new Map((dishes || []).map((d) => [String(d.id), d]));
  const foodById = new Map((foods || []).map((f) => [String(f.id), f]));
  return (items || []).flatMap((item) =>
    (dishById.get(String(item.dishId))?.ingredients || [])
      .filter((r) => Number(r.portions?.[groupCode]) > 0)
      .map((r) => {
        const food = foodById.get(String(r.foodId));
        return {
          session: item.session,
          dishId: String(item.dishId),
          foodId: r.foodId,
          foodName: food?.name || 'Thực phẩm đã xóa',
          gramsPerChild: r.portions[groupCode],
          wastePct: food?.wastePct ?? null,
          purchasePerChild: null,
          unitPrice: null,
          purchaseUnit: null,
          costPerChild: null,
        };
      }),
  );
};

/** Tên nhóm thực phẩm theo nơi lấy (NUT-10): hàng tươi đặt NCC giao trong ngày, hàng khô lấy từ kho. */
export const STORAGE_GROUPS = [
  { key: 'FRESH', title: 'Cần mua (hàng tươi)', totalKey: 'freshCost' },
  { key: 'DRY', title: 'Lấy từ kho khô', totalKey: 'dryCost' },
];

/**
 * Chia bảng thực phẩm thành "Cần mua (hàng tươi)" / "Lấy từ kho khô" theo `ingredients[].storage` và tổng nhóm
 * `freshCost` / `dryCost` BE trả. Response chưa có đủ các trường đó (BE cũ) ⇒ null, màn giữ một bảng; không tự cộng tổng.
 */
export function storageGroups(stats) {
  const rows = stats?.ingredients || [];
  const ready = rows.length > 0 && rows.every((r) => r.storage) && STORAGE_GROUPS.every((g) => stats[g.totalKey] != null);
  if (!ready) return null;
  return STORAGE_GROUPS.map((g) => ({ ...g, rows: rows.filter((r) => r.storage === g.key), total: stats[g.totalKey] })).filter(
    (g) => g.rows.length,
  );
}

export const NO_SUPPLIER = 'Chưa gán nhà cung cấp';

/**
 * Chia bảng theo nhà cung cấp tại ngày thống kê (`ingredients[].supplierId`) với tổng từng NCC `supplierCosts` BE trả —
 * danh sách đặt hàng gửi từng NCC. BE cũ chưa trả `supplierCosts` ⇒ null; không tự cộng tổng.
 */
export function supplierGroups(stats) {
  const rows = stats?.ingredients || [];
  if (!rows.length || !Array.isArray(stats.supplierCosts)) return null;
  return stats.supplierCosts
    .map((s) => ({
      key: `S${s.supplierId ?? 'none'}`,
      title: s.supplierName || NO_SUPPLIER,
      contractStatus: s.supplierId == null ? null : s.contractStatus,
      rows: rows.filter((r) => (r.supplierId ?? null) === (s.supplierId ?? null)),
      total: s.cost,
    }))
    .filter((g) => g.rows.length);
}

/** Lượng mua đã là ĐVT cân đo của đơn vị gốc (g → kg, ml → lít) ⇒ cột "Lượng mua" đủ, không cần dòng phụ g/ml. */
export const BIG_UNITS = { g: 'kg', ml: 'lít' };
export const buysInBaseUnit = (r) => !!r.purchaseUnit && BIG_UNITS[r.unit] === String(r.purchaseUnit).toLowerCase();

/** Dòng Excel của bảng thực phẩm (số lấy nguyên từ BE); có nhóm Tươi/Khô thì thêm dòng tiêu đề và tổng từng nhóm. */
export function statisticsExportRows(stats, title, groupBy = 'storage') {
  if (stats.groups?.length) {
    return [
      [title],
      ['Tổng toàn trường'],
      ['Số trẻ', stats.children],
      ['Tiền ăn 1 trẻ', stats.costPerChild],
      ['Ngân sách thực phẩm cao nhất', stats.foodBudget ?? stats.mealPrice ?? 'Chưa đặt'],
      ['Tổng tiền', stats.totalCost],
      [],
      ...stats.groups.flatMap((group) => [...statisticsExportRows(group, `${title} · ${group.ageGroupName}`, groupBy), []]),
    ];
  }
  const n = stats.children;
  const head = [
    'STT',
    'Tên thực phẩm',
    'Nhà cung cấp',
    'Lượng ăn 1 trẻ',
    `Lượng ăn ${n} trẻ`,
    'Thải bỏ (%)',
    `Lượng mua ${n} trẻ (gốc)`,
    `Lượng mua ${n} trẻ`,
    'ĐVT',
    'Đơn giá',
    `Tiền ăn ${n} trẻ (theo lượng dùng)`,
  ];
  const line = (r, i) => [
    i + 1,
    r.foodName,
    r.supplierName || '',
    r.gramsPerChild,
    r.eatenTotal,
    r.wastePct,
    r.purchaseTotal,
    r.purchaseQty,
    r.purchaseUnit,
    r.unitPrice,
    r.cost,
  ];
  const pad = (label, value) => ['', label, '', '', '', '', '', '', '', '', value];
  const groups = groupBy === 'supplier' ? supplierGroups(stats) : storageGroups(stats);
  const body = groups
    ? groups.flatMap((g) => [
        [g.title],
        ...g.rows.map(line),
        pad(`Tổng ${groupBy === 'supplier' ? g.title : g.title.toLowerCase()}`, g.total),
      ])
    : stats.ingredients.map(line);
  return [[title], head, ...body, pad(`Tổng tiền ăn ${n} trẻ`, stats.totalCost)];
}
