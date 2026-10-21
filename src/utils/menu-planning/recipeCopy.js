import { ingredientQty } from '@/utils/menu-planning/menuCalculations';

const cell = (v) => (v == null ? '' : String(v));

/** Dòng form công thức từ thành phần đã lưu: mỗi nhóm tuổi một ô chuỗi ('' = chưa nhập). */
export const recipeRow = (ing, ageGroupIds) => ({
  foodId: ing.foodId,
  portions: Object.fromEntries(ageGroupIds.map((ag) => [ag, cell(ingredientQty(ing, ag))])),
});

/** Form món mới chép từ món gốc (BA 03 "Nhân bản"): bản sao độc lập, món gốc không đổi; mặc định để Nháp. */
export const duplicateDishForm = (dish, ageGroupIds, draftStatus) => ({
  name: `${dish.name} (bản sao)`,
  type: dish.type,
  description: dish.description || '',
  status: draftStatus,
  ingredients: (dish.ingredients || []).map((ing) => recipeRow(ing, ageGroupIds)),
});

/** Số ô đã nhập của nhóm đích sẽ bị đổi khi chép cột nguồn sang (để hỏi trước, không tự ghi đè). */
export const countReplacedCells = (rows, fromId, toId) =>
  rows.filter((r) => cell(r.portions?.[toId]) !== '' && cell(r.portions?.[toId]) !== cell(r.portions?.[fromId])).length;

/** Chép nguyên cột định lượng của nhóm nguồn sang nhóm đích (ô nguồn trống ⇒ ô đích trống). */
export const copyPortions = (rows, fromId, toId) =>
  rows.map((r) => ({ ...r, portions: { ...r.portions, [toId]: cell(r.portions?.[fromId]) } }));
