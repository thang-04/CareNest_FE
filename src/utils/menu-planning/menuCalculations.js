import { normalizeText } from '@/utils/format';
import {
  NORM_STATUS,
  NUTRITION_NORMS,
  REPEAT_WINDOW_DAYS,
  DISH_TYPE,
  SESSION_ORDER,
  addDays,
  portionFactorOf,
} from '@/models/menu-planning/menuPlanningConstants';

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

/**
 * Nutrition and cost of one dish for `multiplier` standard portions.
 * missing = names of ingredients without nutrition values (the total is then incomplete).
 */
export const dishTotals = (dish, foodById, multiplier = 1) => {
  const totals = zero();
  const missing = [];
  let cost = 0;
  (dish?.ingredients || []).forEach((ing) => {
    const food = foodById[ing.foodId];
    const qty = (Number(ing.quantity) || 0) * multiplier;
    if (!food) {
      missing.push('Thực phẩm đã xóa');
      return;
    }
    if (hasNutrition(food)) NUTRIENTS.forEach((k) => (totals[k] += (food.nutrition[k] * qty) / 100));
    else if (!missing.includes(food.name)) missing.push(food.name);
    if (food.unitPrice && food.purchaseUnitSize) cost += (food.unitPrice / food.purchaseUnitSize) * qty;
  });
  NUTRIENTS.forEach((k) => (totals[k] = round1(totals[k])));
  return { totals, missing, cost: Math.round(cost) };
};

/** Totals of a day (list of meals) for one child of the age group. */
export const mealsTotals = (meals, dishById, foodById, ageGroupId) => {
  const factor = portionFactorOf(ageGroupId);
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
      const r = dishTotals(dish, foodById, (Number(item.portion) || 0) * factor);
      NUTRIENTS.forEach((k) => (s[k] += r.totals[k]));
      r.missing.forEach((m) => !missing.includes(m) && missing.push(m));
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
 */
export const compareToNorm = (totals, ageGroupId, incomplete = false) => {
  const norm = NUTRITION_NORMS[ageGroupId];
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

/** Sorts meals by session order and drops empty sessions not in `sessions`. */
export const normalizeMeals = (meals, sessions) =>
  SESSION_ORDER.filter((s) => sessions.includes(s)).map((session) => ({
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
