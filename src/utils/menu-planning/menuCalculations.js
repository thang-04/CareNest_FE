import { normalizeText } from '@/utils/format';
import { NORM_STATUS, REPEAT_WINDOW_DAYS, DISH_TYPE, addDays } from '@/models/menu-planning/menuPlanningConstants';

/*
 * Deterministic menu calculations (GBR-AI-04, GBR-MENU-02/03/04): nutrition totals, cost,
 * allergens and repeated dishes. Used by the screens (live preview) and by the mock backend
 * (the Spring Boot API must compute the same values).
 */

/** Số liệu của thực phẩm, tính trên 100 g/ml ăn được. */
export const NUTRIENTS = ['kcal', 'protein', 'lipid', 'glucid'];
/** Sáu chỉ số cân đối khẩu phần của món / bữa / ngày (g, riêng năng lượng là kcal). */
export const INDICATORS = ['animalProtein', 'plantProtein', 'animalLipid', 'plantLipid', 'glucid', 'kcal'];
// Phần đạm/béo của thực phẩm chưa có nguồn gốc: vẫn cộng vào tổng nhưng không chia động vật/thực vật
const SUM_KEYS = ['kcal', 'glucid', 'animalProtein', 'plantProtein', 'otherProtein', 'animalLipid', 'plantLipid', 'otherLipid'];
const OUT_KEYS = [...NUTRIENTS, 'animalProtein', 'plantProtein', 'animalLipid', 'plantLipid'];
const acc0 = () => Object.fromEntries(SUM_KEYS.map((k) => [k, 0]));
const zero = () => Object.fromEntries(OUT_KEYS.map((k) => [k, 0]));
const round1 = (n) => Math.round(n * 10) / 10;

export const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));

export const hasNutrition = (food) => NUTRIENTS.every((k) => typeof food?.nutrition?.[k] === 'number');
export const hasOrigin = (food) => food?.origin === 'ANIMAL' || food?.origin === 'PLANT';
/** Đủ số liệu để cân đối khẩu phần: có cả 4 giá trị dinh dưỡng và nguồn gốc. */
export const isNutritionComplete = (food) => hasNutrition(food) && hasOrigin(food);

/** Cộng dinh dưỡng của `qty` g/ml thực phẩm vào bộ đếm; đạm, béo vào phần động vật/thực vật theo nguồn gốc. */
const addFood = (acc, food, qty) => {
  const n = food.nutrition;
  acc.kcal += (n.kcal * qty) / 100;
  acc.glucid += (n.glucid * qty) / 100;
  const side = food.origin === 'ANIMAL' ? 'animal' : food.origin === 'PLANT' ? 'plant' : 'other';
  acc[`${side}Protein`] += (n.protein * qty) / 100;
  acc[`${side}Lipid`] += (n.lipid * qty) / 100;
};

/** Bộ đếm → kết quả làm tròn 0,1; tổng đạm = đạm động vật + thực vật (+ phần chưa rõ nguồn gốc), béo tương tự. */
const finalize = (acc) => {
  const r = Object.fromEntries(SUM_KEYS.map((k) => [k, round1(acc[k])]));
  return {
    kcal: r.kcal,
    protein: round1(r.animalProtein + r.plantProtein + r.otherProtein),
    lipid: round1(r.animalLipid + r.plantLipid + r.otherLipid),
    glucid: r.glucid,
    animalProtein: r.animalProtein,
    plantProtein: r.plantProtein,
    animalLipid: r.animalLipid,
    plantLipid: r.plantLipid,
  };
};

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

/** Ô định lượng thử không hợp lệ (trống là hợp lệ = chưa nhập). */
export const badPortionQty = (v) => v !== '' && (Number.isNaN(Number(v)) || Number(v) <= 0 || Number(v) > 1000);

/** Món với định lượng thử { foodId: chuỗi g/trẻ } của nhóm tuổi đè lên định lượng đã lưu; ô sai giữ số cũ, ô trống = chưa nhập. */
export const withPortionDraft = (dish, draft, ageGroupId) =>
  !draft
    ? dish
    : {
        ...dish,
        ingredients: (dish.ingredients || []).map((ing) => {
          const v = draft[ing.foodId];
          if (v === undefined || badPortionQty(v)) return ing;
          return { ...ing, portions: { ...(ing.portions || {}), [ageGroupId]: v === '' ? null : Number(v) } };
        }),
      };

/** Nhóm tuổi mà món còn thành phần chưa nhập định lượng. */
export const missingPortionGroups = (dish, ageGroupIds) =>
  ageGroupIds.filter((ag) => (dish?.ingredients || []).some((ing) => ingredientQty(ing, ag) == null));

/**
 * Nutrition and cost of one dish for `multiplier` portions — of the age group when given, else of the standard portion.
 * totals: 6 chỉ số (animalProtein, plantProtein, animalLipid, plantLipid, glucid, kcal) + tổng protein, lipid.
 * missing = tên thực phẩm thiếu số liệu dinh dưỡng hoặc nguồn gốc (vẫn cộng phần đã biết, không đánh giá);
 * noQuantity = có thành phần chưa nhập định lượng của nhóm. Chi phí chỉ phụ thuộc định lượng và đơn giá.
 */
export const dishTotals = (dish, foodById, multiplier = 1, ageGroupId) => {
  const acc = acc0();
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
    if (hasNutrition(food)) addFood(acc, food, qty);
    if (!isNutritionComplete(food) && !missing.includes(food.name)) missing.push(food.name);
    if (food.unitPrice && food.purchaseUnitSize) cost += (food.unitPrice / food.purchaseUnitSize) * qty;
  });
  return { totals: finalize(acc), missing, noQuantity, cost: Math.round(cost) };
};

/**
 * Hàm lượng từng thành phần của một món cho một trẻ của nhóm tuổi (cùng công thức với dishTotals để không lệch số).
 * rows: [{ foodId, food, qty, kcal, protein, lipid, glucid, animalProtein, plantProtein, animalLipid, plantLipid, cost,
 * noNutrition, noOrigin }]; total cùng các khóa + qty. qty = null khi chưa nhập định lượng; total chỉ cộng dòng đã có định lượng.
 */
export const ingredientBreakdown = (dish, foodById, ageGroupId) => {
  const acc = acc0();
  let qtySum = 0;
  let costSum = 0;
  const rows = (dish?.ingredients || []).map((ing) => {
    const food = foodById[ing.foodId] || null;
    const qty = ingredientQty(ing, ageGroupId);
    const row = { foodId: ing.foodId, food, qty, ...zero(), cost: 0, noNutrition: !hasNutrition(food), noOrigin: !hasOrigin(food) };
    if (qty == null || !food) return row;
    if (!row.noNutrition) {
      const one = acc0();
      addFood(one, food, qty);
      addFood(acc, food, qty);
      Object.assign(row, {
        kcal: one.kcal,
        glucid: one.glucid,
        protein: one.animalProtein + one.plantProtein + one.otherProtein,
        lipid: one.animalLipid + one.plantLipid + one.otherLipid,
        animalProtein: one.animalProtein,
        plantProtein: one.plantProtein,
        animalLipid: one.animalLipid,
        plantLipid: one.plantLipid,
      });
    }
    if (food.unitPrice && food.purchaseUnitSize) row.cost = (food.unitPrice / food.purchaseUnitSize) * qty;
    qtySum += qty;
    costSum += row.cost;
    return row;
  });
  return { rows, total: { qty: round1(qtySum), ...finalize(acc), cost: Math.round(costSum) } };
};

/** Tỷ lệ năng lượng từ đạm, béo, bột (%), làm tròn; tổng năng lượng bằng 0 thì trả 0. */
export const energyShares = ({ protein = 0, lipid = 0, glucid = 0 }) => {
  const e = protein * 4 + lipid * 9 + glucid * 4;
  return e ? [protein * 4, lipid * 9, glucid * 4].map((x) => Math.round((x * 100) / e)) : [0, 0, 0];
};

/** Tỷ lệ cơ cấu (%): đạm động vật / tổng đạm, béo động vật / tổng béo; tổng bằng 0 thì null. */
export const structureShares = (totals) => ({
  animalProteinPct: totals?.protein ? round1(((totals.animalProtein || 0) * 100) / totals.protein) : null,
  animalLipidPct: totals?.lipid ? round1(((totals.animalLipid || 0) * 100) / totals.lipid) : null,
});

/** Totals of a day (list of meals) for one child of the age group; bySession cùng dạng totals cho từng bữa. */
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
      OUT_KEYS.forEach((k) => (s[k] += r.totals[k]));
      r.missing.forEach((m) => !missing.includes(m) && missing.push(m));
      if (r.noQuantity && !missing.includes(`Định lượng ${dish.name}`)) missing.push(`Định lượng ${dish.name}`);
      cost += r.cost;
    });
    OUT_KEYS.forEach((k) => {
      s[k] = round1(s[k]);
      totals[k] += s[k];
    });
    bySession[meal.session] = s;
  });
  OUT_KEYS.forEach((k) => (totals[k] = round1(totals[k])));
  return { totals, missing, bySession, cost: Math.round(cost) };
};

const isRange = (r) => Array.isArray(r) && r.length === 2 && r.every((v) => v !== '' && v != null && Number.isFinite(Number(v)));
const mid = ([a, b]) => (Number(a) + Number(b)) / 2;
const ENERGY_FACTOR = { protein: 4, lipid: 9, glucid: 4 };
/** Định mức tỷ lệ cơ cấu (không bắt buộc): phần động vật trong tổng đạm, tổng béo (%). */
export const SHARE_KEYS = ['animalProteinPct', 'animalLipidPct'];

const judge = (measured, min, max) => (measured < min ? NORM_STATUS.LOW : measured > max ? NORM_STATUS.HIGH : NORM_STATUS.OK);

/**
 * So số liệu của phạm vi bữa trường phục vụ với định mức của nhóm tuổi (Thiết lập). Ba loại số tách riêng:
 * value = lượng thực tế (kcal, g; dòng tỷ lệ cơ cấu là %), percent = tỷ lệ % (năng lượng từ đạm/béo/bột hoặc phần động vật),
 * attainment = % đạt định mức = thực tế / mục tiêu (mục tiêu = giữa khoảng; đạm/béo/bột quy ra g từ định mức năng lượng).
 * Dòng: kcal, protein, lipid, glucid (cần đủ 4 khoảng — isNormConfigured), animalProteinPct, animalLipidPct (optional).
 * status: NA khi dòng chưa đặt định mức; INCOMPLETE khi thiếu số liệu thực phẩm (incomplete) hoặc chưa có năng lượng.
 */
export const compareToNorm = (totals, ageGroupId, incomplete = false, norms) => {
  const raw = norms?.[ageGroupId] || {};
  const core = isNormConfigured(raw) ? raw : null;
  const kcal = totals?.kcal || 0;
  const kcalTarget = core ? mid(core.kcal) : null;
  const status = (configured, measured, min, max) => {
    if (!configured) return NORM_STATUS.NA;
    if (incomplete || measured == null || !kcal) return NORM_STATUS.INCOMPLETE;
    return judge(measured, min, max);
  };
  const coreRows = NUTRIENTS.map((key) => {
    const value = totals?.[key] || 0;
    const [min, max] = core ? core[key].map(Number) : [null, null];
    if (key === 'kcal') {
      const attainment = kcalTarget ? Math.round((value * 100) / kcalTarget) : null;
      return {
        key,
        value,
        percent: null,
        min,
        max,
        target: kcalTarget,
        attainment,
        status: status(!!core, value, min, max),
        optional: false,
      };
    }
    const percent = kcal ? round1((ENERGY_FACTOR[key] * value * 100) / kcal) : null;
    const target = core ? round1((kcalTarget * mid(core[key])) / 100 / ENERGY_FACTOR[key]) : null;
    const attainment = target ? Math.round((value * 100) / target) : null;
    return { key, value, percent, min, max, target, attainment, status: status(!!core, percent, min, max), optional: false };
  });
  const shares = structureShares(totals);
  const shareRows = SHARE_KEYS.map((key) => {
    const configured = isRange(raw[key]);
    const [min, max] = configured ? raw[key].map(Number) : [null, null];
    const value = shares[key];
    return {
      key,
      value,
      percent: value,
      min,
      max,
      target: null,
      attainment: null,
      status: status(configured, value, min, max),
      optional: true,
    };
  });
  return [...coreRows, ...shareRows];
};

/** Đủ cả 4 khoảng định mức chính (năng lượng, tỷ lệ đạm/béo/bột) dạng số thì mới đánh giá được. */
export const isNormConfigured = (norm) => NUTRIENTS.every((k) => isRange(norm?.[k]));

export const normIssues = (rows) => rows.filter((r) => r.status === 'LOW' || r.status === 'HIGH');

/**
 * Trạng thái chung của các dòng compareToNorm: thiếu dữ liệu > chưa đặt định mức chính > thấp/cao > đạt.
 * Dòng tỷ lệ cơ cấu chưa đặt định mức (không bắt buộc) bị bỏ qua.
 */
export const overallNormStatus = (rows) => {
  const counted = (rows || []).filter((r) => !(r.optional && r.status === NORM_STATUS.NA));
  if (counted.some((r) => r.status === NORM_STATUS.INCOMPLETE)) return NORM_STATUS.INCOMPLETE;
  if (counted.some((r) => r.status === NORM_STATUS.NA)) return NORM_STATUS.NA;
  return counted.find((r) => r.status === NORM_STATUS.LOW || r.status === NORM_STATUS.HIGH)?.status || NORM_STATUS.OK;
};

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
