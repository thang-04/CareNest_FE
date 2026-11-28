/*
 * Hàm phụ của thực đơn ngày: nhóm tuổi, dinh dưỡng món từ danh mục, chuyển hướng link cũ. Mọi số do BE tính.
 */

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

/** Đích của link cũ `/menu/statistics` (màn đã bỏ): mẫu ⇒ trang mẫu; còn lại ⇒ Cân đối khẩu phần cùng tuần/ngày. */
export const legacyStatisticsTarget = (search) => {
  const params = new URLSearchParams(search);
  const template = params.get('template');
  if (template) return `/menu/templates/${encodeURIComponent(template)}`;
  const next = new URLSearchParams();
  ['week', 'date'].forEach((key) => params.get(key) && next.set(key, params.get(key)));
  const query = next.toString();
  return query ? `/menu/nutrition?${query}` : '/menu/nutrition';
};

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
