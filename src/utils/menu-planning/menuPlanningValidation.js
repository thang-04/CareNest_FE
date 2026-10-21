import { normalizeText } from '@/utils/format';
import {
  isMonday,
  sessionsOf,
  MEAL_SESSION_LABELS,
  DISH_TYPE_LABELS,
  FOOD_GROUP_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';
import { applyReplacements, byId, missingPortionGroups, restrictedConflicts } from '@/utils/menu-planning/menuCalculations';

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
  // BA 02: tỷ lệ quy đổi không được bằng 0 hoặc âm (chỉ kiểm khi form có khai đơn vị kho)
  if (form.stockUnit !== undefined) {
    if (!String(form.stockUnit || '').trim()) e.stockUnit = REQUIRED;
    if (!isNum(form.purchaseToStock) || Number(form.purchaseToStock) <= 0) e.purchaseToStock = 'Nhập số lớn hơn 0.';
    if (!isNum(form.stockUnitSize) || Number(form.stockUnitSize) <= 0) e.stockUnitSize = 'Nhập số lớn hơn 0.';
  }
  if (form.unitPrice !== '' && form.unitPrice != null && (!isNum(form.unitPrice) || Number(form.unitPrice) < 0))
    e.unitPrice = 'Nhập giá hợp lệ (không âm).';
  if (form.storage && !['FRESH', 'DRY'].includes(form.storage)) e.storage = 'Chọn Tươi hoặc Khô.';
  if (form.wastePct !== '' && form.wastePct != null && (!isNum(form.wastePct) || Number(form.wastePct) < 0 || Number(form.wastePct) > 90))
    e.wastePct = 'Nhập từ 0 đến 90%.';
  ['kcal', 'protein', 'lipid', 'glucid'].forEach((k) => {
    const v = form.nutrition?.[k];
    if (v === '' || v === null || v === undefined) return;
    if (!isNum(v) || Number(v) < 0) e[k] = 'Nhập số không âm.';
    else if (k !== 'kcal' && Number(v) > 100) e[k] = 'Tối đa 100 g trên 100 g thực phẩm.';
    else if (k === 'kcal' && Number(v) > 900) e[k] = 'Tối đa 900 kcal trên 100 g.';
  });
  return e;
};

/**
 * `requireGroups` [{ id, name }]: món chuyển từ Nháp (hoặc tạo mới) sang dùng cho thực đơn phải đủ định lượng
 * mọi nhóm tuổi đang áp dụng (user chốt 20/10/2026); lưu nháp thì không truyền.
 */
export const validateDish = (form, others = [], { requireGroups = null } = {}) => {
  const e = {};
  if (!form.name?.trim()) e.name = REQUIRED;
  else if (form.name.trim().length > 100) e.name = 'Tên món tối đa 100 ký tự.';
  else if (others.some((d) => d.id !== form.id && sameName(d.name, form.name))) e.name = 'Đã có món cùng tên. Hãy xem món đã có.';
  if (!DISH_TYPE_LABELS[form.type]) e.type = REQUIRED;
  const rows = form.ingredients || [];
  if (!rows.length) e.ingredients = 'Thêm ít nhất một thực phẩm cho món.';
  const badQty = (v) => !isNum(v) || Number(v) <= 0 || Number(v) > 1000;
  rows.forEach((r, i) => {
    if (!r.foodId) e[`ing_${i}`] = 'Chọn thực phẩm.';
    else if (rows.findIndex((x) => x.foodId === r.foodId) !== i) e[`ing_${i}`] = 'Thực phẩm bị lặp, hãy gộp định lượng.';
    if (r.portions) {
      // Ô trống = nhóm tuổi chưa có định lượng (cảnh báo, không chặn lưu); ô đã nhập phải hợp lệ
      const filled = Object.entries(r.portions).filter(([, v]) => v !== '' && v != null);
      filled.forEach(([ag, v]) => badQty(v) && (e[`ing_${i}_${ag}`] = 'Từ 0 đến 1000.'));
      if (!filled.length && !e[`ing_${i}`]) e[`ing_${i}`] = 'Nhập định lượng cho ít nhất một nhóm tuổi.';
    } else if (r.foodId && badQty(r.quantity)) e[`ing_${i}`] = 'Định lượng từ 0 đến 1000.';
  });
  if (requireGroups && rows.length) {
    const missing = missingPortionGroups(
      form,
      requireGroups.map((g) => g.id),
    );
    if (missing.length)
      e.status = `Chưa đủ định lượng cho ${requireGroups
        .filter((g) => missing.includes(g.id))
        .map((g) => g.name)
        .join(', ')}: nhập đủ hoặc lưu nháp.`;
  }
  return e;
};

const overlaps = (a, b) => a.effectiveFrom <= (b.effectiveTo || '9999-12-31') && b.effectiveFrom <= (a.effectiveTo || '9999-12-31');

const PERCENT_KEYS = ['protein', 'lipid', 'glucid'];

/**
 * Thiết lập dinh dưỡng (hỗ trợ nhập liệu; BE kiểm tra lại). Khóa lỗi: effectiveFrom,
 * `${ageGroupId}.price`, `${ageGroupId}.meals`, `${ageGroupId}.meals.${i}.name|countAs`, `${ageGroupId}.norms.${key}`.
 */
export const validateNutritionSetup = (form, today) => {
  const e = {};
  if (!form.effectiveFrom) e.effectiveFrom = REQUIRED;
  else if (form.effectiveFrom < today) e.effectiveFrom = 'Giá chỉ áp dụng từ hôm nay trở đi.';
  (form.groups || []).forEach((g) => {
    const key = g.ageGroupId;
    const meals = g.meals || [];
    const base = sessionsOf(key);
    if (!isNum(g.price) || Number(g.price) <= 0 || !Number.isInteger(Number(g.price)))
      e[`${key}.price`] = 'Nhập giá suất ăn một ngày (số tiền lớn hơn 0).';
    if (base.some((code) => !meals.some((m) => m.code === code))) e[`${key}.meals`] = 'Không bỏ được bữa gốc của nhóm tuổi.';
    meals.forEach((m, i) => {
      const name = String(m.name || '').trim();
      if (!name) e[`${key}.meals.${i}.name`] = REQUIRED;
      else if (name.length > 50) e[`${key}.meals.${i}.name`] = 'Tối đa 50 ký tự.';
      else if (meals.some((o, j) => j < i && sameName(o.name, name))) e[`${key}.meals.${i}.name`] = 'Trùng tên bữa khác.';
      if (!base.includes(m.code) && !base.includes(m.countAs)) e[`${key}.meals.${i}.countAs`] = 'Chọn bữa dùng để tính số suất.';
    });
    // Chuẩn tạm: để trống cả bốn = chưa nhập (chưa đánh giá); đã nhập thì phải đủ từng khoảng
    const blank = (v) => v === '' || v == null;
    const norms = Object.entries(g.norms || {});
    if (norms.every(([, range]) => (range || []).every(blank))) return;
    norms.forEach(([k, range]) => {
      const [min, max] = range || [];
      if (!isNum(min) || !isNum(max)) e[`${key}.norms.${k}`] = 'Nhập đủ hai số.';
      else if (Number(min) < 0 || Number(min) > Number(max)) e[`${key}.norms.${k}`] = 'Số đầu phải nhỏ hơn hoặc bằng số sau.';
      else if (PERCENT_KEYS.includes(k) && Number(max) > 100) e[`${key}.norms.${k}`] = 'Tỷ lệ tối đa 100%.';
      else if (k === 'kcal' && Number(min) === 0) e[`${key}.norms.${k}`] = 'Năng lượng phải lớn hơn 0.';
    });
  });
  return e;
};

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

/**
 * Sample daily menu: every meal of the age group (Thiết lập) has at least one dish. meals = [{ code, name }].
 * allowEmptyMeals: ngày của tuần nháp được để trống bữa (đủ món chỉ kiểm khi xuất bản tuần).
 */
export const validateMenu = (form, others = [], meals, { allowEmptyMeals = false } = {}) => {
  const e = {};
  if (!form.name?.trim()) e.name = REQUIRED;
  else if (others.some((m) => m.id !== form.id && m.ageGroupId === form.ageGroupId && sameName(m.name, form.name)))
    e.name = 'Nhóm tuổi này đã có thực đơn cùng tên.';
  if (!form.ageGroupId) e.ageGroupId = REQUIRED;
  else
    (meals || sessionsOf(form.ageGroupId).map((code) => ({ code, name: MEAL_SESSION_LABELS[code] }))).forEach(({ code: s, name }) => {
      const items = (form.meals || []).find((m) => m.session === s)?.items || [];
      if (!allowEmptyMeals && !items.filter((i) => i.dishId).length) e[`meal_${s}`] = `${name}: chọn ít nhất một món.`;
      items.forEach((i) => {
        if (i.dishId && (!isNum(i.portion) || Number(i.portion) < 0.1 || Number(i.portion) > 3))
          e[`meal_${s}`] = `${name}: hệ số khẩu phần từ 0,1 đến 3.`;
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
