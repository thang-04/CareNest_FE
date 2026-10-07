import { normalizeText } from '@/utils/format';
import {
  isMonday,
  sessionsOf,
  MEAL_SESSION_LABELS,
  DISH_TYPE_LABELS,
  FOOD_GROUP_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';
import { applyReplacements, byId, restrictedConflicts } from '@/utils/menu-planning/menuCalculations';

/*
 * Field checks shared by the forms (instant feedback) and the mock backend (422).
 * Each function returns { field: message }; empty object = valid.
 * Messages follow MSG02 (required), MSG19 (invalid value), MSG20 (duplicate), MSG40 (allergen conflict).
 */

const REQUIRED = 'Trường này là bắt buộc.';
const sameName = (a, b) => normalizeText(a).trim() === normalizeText(b).trim();
const isNum = (v) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;
export const firstError = (errors) => Object.values(errors || {})[0];

export const validateFood = (form, others = []) => {
  const e = {};
  if (!form.name?.trim()) e.name = REQUIRED;
  else if (form.name.trim().length > 100) e.name = 'Tên thực phẩm tối đa 100 ký tự.';
  else if (others.some((f) => f.id !== form.id && sameName(f.name, form.name)))
    e.name = 'Đã có thực phẩm cùng tên. Hãy xem thực phẩm đã có.';
  if (!FOOD_GROUP_LABELS[form.group]) e.group = REQUIRED;
  if (!['g', 'ml'].includes(form.unit)) e.unit = REQUIRED;
  if (!form.purchaseUnit?.trim()) e.purchaseUnit = REQUIRED;
  if (!isNum(form.purchaseUnitSize) || Number(form.purchaseUnitSize) <= 0) e.purchaseUnitSize = 'Nhập số lớn hơn 0.';
  if (form.unitPrice !== '' && form.unitPrice != null && (!isNum(form.unitPrice) || Number(form.unitPrice) < 0))
    e.unitPrice = 'Nhập giá hợp lệ (không âm).';
  ['kcal', 'protein', 'lipid', 'glucid'].forEach((k) => {
    const v = form.nutrition?.[k];
    if (v === '' || v === null || v === undefined) return;
    if (!isNum(v) || Number(v) < 0) e[k] = 'Nhập số không âm.';
    else if (k !== 'kcal' && Number(v) > 100) e[k] = 'Tối đa 100 g trên 100 g thực phẩm.';
    else if (k === 'kcal' && Number(v) > 900) e[k] = 'Tối đa 900 kcal trên 100 g.';
  });
  return e;
};

export const validateDish = (form, others = []) => {
  const e = {};
  if (!form.name?.trim()) e.name = REQUIRED;
  else if (form.name.trim().length > 100) e.name = 'Tên món tối đa 100 ký tự.';
  else if (others.some((d) => d.id !== form.id && sameName(d.name, form.name))) e.name = 'Đã có món cùng tên. Hãy xem món đã có.';
  if (!DISH_TYPE_LABELS[form.type]) e.type = REQUIRED;
  const rows = form.ingredients || [];
  if (!rows.length) e.ingredients = 'Thêm ít nhất một thực phẩm cho món.';
  rows.forEach((r, i) => {
    if (!r.foodId) e[`ing_${i}`] = 'Chọn thực phẩm.';
    else if (!isNum(r.quantity) || Number(r.quantity) <= 0 || Number(r.quantity) > 1000) e[`ing_${i}`] = 'Định lượng từ 0 đến 1000.';
    else if (rows.findIndex((x) => x.foodId === r.foodId) !== i) e[`ing_${i}`] = 'Thực phẩm bị lặp, hãy gộp định lượng.';
  });
  return e;
};

const overlaps = (a, b) => a.effectiveFrom <= (b.effectiveTo || '9999-12-31') && b.effectiveFrom <= (a.effectiveTo || '9999-12-31');

export const validateMealPrice = (form, others = []) => {
  const e = {};
  if (!form.ageGroupId) e.ageGroupId = REQUIRED;
  if (!isNum(form.price) || Number(form.price) <= 0) e.price = 'Nhập giá suất ăn lớn hơn 0.';
  else if (Number(form.price) > 500000) e.price = 'Giá suất ăn tối đa 500.000 đ.';
  if (!form.effectiveFrom) e.effectiveFrom = REQUIRED;
  if (form.effectiveTo && form.effectiveFrom && form.effectiveTo < form.effectiveFrom)
    e.effectiveTo = 'Ngày kết thúc phải sau ngày bắt đầu.';
  if (!e.ageGroupId && !e.effectiveFrom && !e.effectiveTo) {
    const clash = others.find((p) => p.id !== form.id && p.ageGroupId === form.ageGroupId && overlaps(p, form));
    if (clash) e.effectiveFrom = 'Thời gian áp dụng trùng với một mức giá khác của nhóm tuổi này.';
  }
  return e;
};

/** Sample daily menu: every session of the age group has at least one dish. */
export const validateMenu = (form, others = []) => {
  const e = {};
  if (!form.name?.trim()) e.name = REQUIRED;
  else if (others.some((m) => m.id !== form.id && m.ageGroupId === form.ageGroupId && sameName(m.name, form.name)))
    e.name = 'Nhóm tuổi này đã có thực đơn cùng tên.';
  if (!form.ageGroupId) e.ageGroupId = REQUIRED;
  else
    sessionsOf(form.ageGroupId).forEach((s) => {
      const items = (form.meals || []).find((m) => m.session === s)?.items || [];
      if (!items.filter((i) => i.dishId).length) e[`meal_${s}`] = `${MEAL_SESSION_LABELS[s]}: chọn ít nhất một món.`;
      items.forEach((i) => {
        if (i.dishId && (!isNum(i.portion) || Number(i.portion) < 0.1 || Number(i.portion) > 3))
          e[`meal_${s}`] = `${MEAL_SESSION_LABELS[s]}: hệ số khẩu phần từ 0,1 đến 3.`;
      });
    });
  return e;
};

/** Alternative menu: no restricted allergen may remain (MSG40). */
export const validateAllergyMenu = (form, ctx) => {
  const e = {};
  if (!form.name?.trim()) e.name = REQUIRED;
  if (!form.baseMenuId) e.baseMenuId = REQUIRED;
  if (!(form.restrictions || []).length) e.restrictions = 'Chọn ít nhất một thành phần cần tránh.';
  const base = ctx?.menus?.find((m) => m.id === form.baseMenuId);
  if (base && !e.restrictions) {
    const effective = applyReplacements(base.meals, form.replacements);
    const conflicts = restrictedConflicts(effective, form.restrictions, byId(ctx.dishes), byId(ctx.foods));
    if (conflicts.length)
      e.replacements = `Phát hiện xung đột chế độ ăn: ${conflicts
        .map((c) => `${c.allergen} (${c.dishes.map((d) => d.name).join(', ')})`)
        .join('; ')}. Hãy chọn món thay thế.`;
    (form.replacements || []).forEach((r) => {
      if (r.replacementDishId && (!isNum(r.portion) || Number(r.portion) < 0.1 || Number(r.portion) > 3))
        e.replacements = 'Hệ số khẩu phần của món thay thế từ 0,1 đến 3.';
    });
  }
  return e;
};

/** Weekly menu: saving a draft needs the week and age group; publishing needs every school day. */
export const validateWeeklyMenu = (form, { forPublish = false } = {}) => {
  const e = {};
  if (!form.ageGroupId) e.ageGroupId = REQUIRED;
  if (!form.weekStart) e.weekStart = REQUIRED;
  else if (!isMonday(form.weekStart)) e.weekStart = 'Tuần phải bắt đầu vào Thứ Hai.';
  (form.days || []).forEach((d, i) => {
    if (d.holiday && !d.note?.trim()) e[`day_${i}`] = 'Ghi rõ lý do nghỉ (ví dụ: nghỉ lễ).';
    if (forPublish && !d.holiday && !d.menuId) e[`day_${i}`] = 'Chọn thực đơn cho ngày học này.';
  });
  if (forPublish && (form.days || []).every((d) => d.holiday)) e.days = 'Tuần không có ngày học nào để xuất bản.';
  return e;
};
