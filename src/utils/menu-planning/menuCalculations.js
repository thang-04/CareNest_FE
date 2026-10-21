import { normalizeText } from '@/utils/format';
import { NORM_STATUS, REPEAT_WINDOW_DAYS, DISH_TYPE, addDays } from '@/models/menu-planning/menuPlanningConstants';

/*
 * Deterministic menu calculations (GBR-AI-04, GBR-MENU-02/03/04): nutrition totals, cost,
 * allergens and repeated dishes. Used by the screens (live preview) and by the mock backend
 * (the Spring Boot API must compute the same values).
 */

export const NUTRIENTS = ['kcal', 'protein', 'lipid', 'glucid'];
const zero = () => ({ kcal: 0, protein: 0, lipid: 0, glucid: 0 });
const round1 = (n) => Math.round(n * 10) / 10;

export const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));

export const hasNutrition = (food) => NUTRIENTS.every((k) => typeof food?.nutrition?.[k] === 'number');

export const sameAllergen = (a, b) => normalizeText(a).trim() === normalizeText(b).trim();

/** Allergens of a dish, derived from its ingredients. */
export const dishAllergens = (dish, foodById) => {
  const found = [];
  (dish?.ingredients || []).forEach((ing) =>
    (foodById[ing.foodId]?.allergens || []).forEach((a) => {
      if (!found.some((x) => sameAllergen(x, a))) found.push(a);
    }),
  );
  return found;
};

/** Định lượng một trẻ của nhóm tuổi: chỉ lấy số đã nhập theo nhóm, chưa nhập = null (không suy từ hệ số giả định). */
export const ingredientQty = (ing, ageGroupId) => {
  const v = ing?.portions?.[ageGroupId];
  return v === '' || v == null ? null : Number(v);
};

/** Nhóm tuổi mà món còn thành phần chưa nhập định lượng. */
export const missingPortionGroups = (dish, ageGroupIds) =>
  ageGroupIds.filter((ag) => (dish?.ingredients || []).some((ing) => ingredientQty(ing, ag) == null));

/**
 * Nutrition and cost of one dish for `multiplier` portions — of the age group when given, else of the standard portion.
 * missing = names of ingredients without nutrition values; noQuantity = có thành phần chưa nhập định lượng của nhóm.
 */
export const dishTotals = (dish, foodById, multiplier = 1, ageGroupId) => {
  const totals = zero();
  const missing = [];
  let cost = 0;
  let noQuantity = false;
  (dish?.ingredients || []).forEach((ing) => {
    const food = foodById[ing.foodId];
    const base = ageGroupId ? ingredientQty(ing, ageGroupId) : Number(ing.quantity) || 0;
    if (base == null) {
      noQuantity = true;
      return;
    }
    const qty = base * multiplier;
    if (!food) {
      missing.push('Thực phẩm đã xóa');
      return;
    }
    if (hasNutrition(food)) NUTRIENTS.forEach((k) => (totals[k] += (food.nutrition[k] * qty) / 100));
    else if (!missing.includes(food.name)) missing.push(food.name);
    if (food.unitPrice && food.purchaseUnitSize) cost += (food.unitPrice / food.purchaseUnitSize) * qty;
  });
  NUTRIENTS.forEach((k) => (totals[k] = round1(totals[k])));
  return { totals, missing, noQuantity, cost: Math.round(cost) };
};

/**
 * Hàm lượng từng thành phần của một món cho một trẻ của nhóm tuổi (cùng công thức với dishTotals để không lệch số).
 * Trả { rows: [{ foodId, food, qty, kcal, protein, lipid, glucid, cost, noNutrition }], total: { qty, kcal, protein, lipid, glucid, cost } };
 * qty = null khi chưa nhập định lượng; total chỉ cộng các dòng đã có định lượng.
 */
export const ingredientBreakdown = (dish, foodById, ageGroupId) => {
  const total = { qty: 0, ...zero(), cost: 0 };
  const rows = (dish?.ingredients || []).map((ing) => {
    const food = foodById[ing.foodId] || null;
    const qty = ingredientQty(ing, ageGroupId);
    const row = { foodId: ing.foodId, food, qty, ...zero(), cost: 0, noNutrition: !hasNutrition(food) };
    if (qty == null || !food) return row;
    if (!row.noNutrition) NUTRIENTS.forEach((k) => (row[k] = (food.nutrition[k] * qty) / 100));
    if (food.unitPrice && food.purchaseUnitSize) row.cost = (food.unitPrice / food.purchaseUnitSize) * qty;
    total.qty += qty;
    NUTRIENTS.forEach((k) => (total[k] += row[k]));
    total.cost += row.cost;
    return row;
  });
  NUTRIENTS.forEach((k) => (total[k] = round1(total[k])));
  total.qty = round1(total.qty);
  total.cost = Math.round(total.cost);
  return { rows, total };
};

/** Tỷ lệ năng lượng từ đạm, béo, bột (%), làm tròn; tổng năng lượng bằng 0 thì trả 0. */
export const energyShares = ({ protein = 0, lipid = 0, glucid = 0 }) => {
  const e = protein * 4 + lipid * 9 + glucid * 4;
  return e ? [protein * 4, lipid * 9, glucid * 4].map((x) => Math.round((x * 100) / e)) : [0, 0, 0];
};

/** Totals of a day (list of meals) for one child of the age group. */
export const mealsTotals = (meals, dishById, foodById, ageGroupId) => {
  const totals = zero();
  const missing = [];
  const bySession = {};
  let cost = 0;
  (meals || []).forEach((meal) => {
    const s = zero();
    (meal.items || []).forEach((item) => {
      const dish = dishById[item.dishId];
      if (!dish) {
        if (!missing.includes('Món đã xóa')) missing.push('Món đã xóa');
        return;
      }
      const r = dishTotals(dish, foodById, Number(item.portion) || 0, ageGroupId);
      NUTRIENTS.forEach((k) => (s[k] += r.totals[k]));
      r.missing.forEach((m) => !missing.includes(m) && missing.push(m));
      if (r.noQuantity && !missing.includes(`Định lượng ${dish.name}`)) missing.push(`Định lượng ${dish.name}`);
      cost += r.cost;
    });
    NUTRIENTS.forEach((k) => {
      s[k] = round1(s[k]);
      totals[k] += s[k];
    });
    bySession[meal.session] = s;
  });
  NUTRIENTS.forEach((k) => (totals[k] = round1(totals[k])));
  return { totals, missing, bySession, cost: Math.round(cost) };
};

/**
 * Compares day totals with the age-group reference (energy in kcal, other nutrients as % of energy).
 * Returns one row per nutrient: { key, value, percent, min, max, status }.
 * norms = chuẩn tạm đã nhập ở Thiết lập (catalog.norms); chưa nhập thì mọi dòng NA (BA: không tự áp chuẩn).
 */
export const compareToNorm = (totals, ageGroupId, incomplete = false, norms) => {
  const norm = isNormConfigured(norms?.[ageGroupId]) ? norms[ageGroupId] : null;
  const kcal = totals?.kcal || 0;
  return NUTRIENTS.map((key) => {
    const value = totals?.[key] || 0;
    const [min, max] = norm?.[key] || [null, null];
    const energyShare = key === 'kcal' ? null : kcal ? round1(((key === 'lipid' ? 9 : 4) * value * 100) / kcal) : null;
    const measured = key === 'kcal' ? value : energyShare;
    let status = NORM_STATUS.NA;
    if (norm && measured != null && kcal > 0 && !incomplete) {
      status = measured < min ? NORM_STATUS.LOW : measured > max ? NORM_STATUS.HIGH : NORM_STATUS.OK;
    }
    return { key, value, percent: energyShare, min, max, status };
  });
};

/** Đủ cả 4 khoảng định mức dạng số thì mới đánh giá được. */
export const isNormConfigured = (norm) =>
  NUTRIENTS.every(
    (k) => Array.isArray(norm?.[k]) && norm[k].length === 2 && norm[k].every((v) => v !== '' && v != null && Number.isFinite(Number(v))),
  );

export const normIssues = (rows) => rows.filter((r) => r.status === 'LOW' || r.status === 'HIGH');

/** Allergens present in a day: [{ allergen, dishes: [{ dishId, name, session }] }]. */
export const mealsAllergens = (meals, dishById, foodById) => {
  const out = [];
  (meals || []).forEach((meal) =>
    (meal.items || []).forEach((item) => {
      const dish = dishById[item.dishId];
      if (!dish) return;
      dishAllergens(dish, foodById).forEach((a) => {
        let row = out.find((x) => sameAllergen(x.allergen, a));
        if (!row) out.push((row = { allergen: a, dishes: [] }));
        if (!row.dishes.some((d) => d.dishId === dish.id)) row.dishes.push({ dishId: dish.id, name: dish.name, session: meal.session });
      });
    }),
  );
  return out;
};

/** Effective meals of an alternative menu: base meals with the replacements applied. */
export const applyReplacements = (meals, replacements) =>
  (meals || []).map((meal) => ({
    session: meal.session,
    items: (meal.items || []).flatMap((item) => {
      const r = (replacements || []).find((x) => x.session === meal.session && x.originalDishId === item.dishId);
      if (!r) return [item];
      if (!r.replacementDishId) return [];
      return [{ dishId: r.replacementDishId, portion: Number(r.portion) || item.portion }];
    }),
  }));

/** Allergens of `meals` that are in `restrictions`. */
export const restrictedConflicts = (meals, restrictions, dishById, foodById) =>
  mealsAllergens(meals, dishById, foodById).filter((row) => (restrictions || []).some((r) => sameAllergen(r, row.allergen)));

/**
 * Main dishes repeated within REPEAT_WINDOW_DAYS (GBR-MENU-04).
 * days: [{ date, holiday, meals }] in date order; earlier published days can be prepended for context.
 */
export const repeatedMainDishes = (days, dishById) => {
  const seen = {};
  const repeats = [];
  (days || [])
    .filter((d) => !d.holiday)
    .forEach((day) =>
      (day.meals || []).forEach((meal) =>
        (meal.items || []).forEach((item) => {
          const dish = dishById[item.dishId];
          if (!dish || dish.type !== DISH_TYPE.MAIN) return;
          const last = seen[dish.id];
          if (last && last !== day.date && addDays(last, REPEAT_WINDOW_DAYS) > day.date) {
            let row = repeats.find((r) => r.dishId === dish.id);
            if (!row) repeats.push((row = { dishId: dish.id, name: dish.name, dates: [last] }));
            if (!row.dates.includes(day.date)) row.dates.push(day.date);
          }
          seen[dish.id] = day.date;
        }),
      ),
    );
  return repeats;
};

/** Xếp bữa theo danh sách mã bữa của nhóm tuổi (thứ tự ở Thiết lập); bữa không còn trong danh sách bị bỏ. */
export const normalizeMeals = (meals, sessions) =>
  sessions.map((session) => ({
    session,
    items: ((meals || []).find((m) => m.session === session)?.items || [])
      .filter((i) => i.dishId)
      .map((i) => ({ dishId: i.dishId, portion: Number(i.portion) || 1 })),
  }));

/** Meal price in force for an age group on a date. */
export const priceOn = (prices, ageGroupId, date) =>
  (prices || [])
    .filter((p) => p.ageGroupId === ageGroupId && p.effectiveFrom <= date && (!p.effectiveTo || p.effectiveTo >= date))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0] || null;

/**
 * Children concerned by allergens (GBR-MENU-03): only counts and class names, never child names.
 * classes/children come from the shared school structure.
 */
export const allergyContext = (classes, children, ageGroupId) => {
  const classById = byId(classes);
  const rows = [];
  (children || [])
    .filter((ch) => ch.status === 'ACTIVE' && (ch.allergies || []).length)
    .forEach((ch) => {
      const cls = classById[ch.classId];
      if (!cls || (ageGroupId && cls.ageGroupId !== ageGroupId)) return;
      ch.allergies.forEach((a) => {
        let row = rows.find((r) => sameAllergen(r.allergen, a));
        if (!row) rows.push((row = { allergen: a, childCount: 0, classes: [] }));
        row.childCount += 1;
        let c = row.classes.find((x) => x.classId === cls.id);
        if (!c)
          row.classes.push((c = { classId: cls.id, className: cls.name, campusId: cls.campusId, ageGroupId: cls.ageGroupId, count: 0 }));
        c.count += 1;
      });
    });
  return rows;
};
