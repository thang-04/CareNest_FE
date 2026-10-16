import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { buildSeedMenuPlanning, topUpRecentWeeklyMenus } from '@/mocks/menuPlanningSeed';
import { buildReferenceLibrary } from '@/mocks/menuReferenceSeed';
import { buildSeedSchoolConfig } from '@/mocks/schoolConfigSeed';
import { uid } from '@/utils/id';
import { formatDate, normalizeText, todayInput } from '@/utils/format';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { ROLES } from '@/models/User';
import { ageGroupById } from '@/models/School';
import {
  AI_DRAFT_KIND,
  AI_DRAFT_STATUS,
  DISH_TYPE,
  NUTRITION_NORMS,
  RECORD_STATUS,
  WEEKLY_STATUS,
  addDays,
  defaultStorageOf,
  mondayOf,
  portionFactorOf,
  weekDates,
  weekLabel,
} from '@/models/menu-planning/menuPlanningConstants';
import {
  allergyContext,
  applyReplacements,
  byId,
  compareToNorm,
  dishAllergens,
  dishTotals,
  ingredientQty,
  mealsTotals,
  normalizeMeals,
  priceOn,
  repeatedMainDishes,
  sameAllergen,
} from '@/utils/menu-planning/menuCalculations';
import {
  validateAllergyMenu,
  validateDish,
  validateFood,
  validateMealPrice,
  validateMenu,
  validateNutritionSetup,
  validateWeeklyMenu,
  hasErrors,
} from '@/utils/menu-planning/menuPlanningValidation';
import { canReadPublishedMenu, canViewMenuPlan } from '@/utils/menu-planning/menuPlanningPermissions';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';

/*
 * Fake backend of menu planning (UC 6.1, 6.3–6.9, 6.11; GBR-GEN-10, GBR-MENU-01..05, GBR-AI-01/04).
 * Only the Vice Principal with the shared school-service assignment changes data; the Principal
 * and kitchens read published menus. The Spring Boot API must enforce the same rules.
 */

const COLLECTIONS = ['foods', 'dishes', 'mealPrices', 'nutritionSetups', 'menus', 'allergyMenus', 'weeklyMenus', 'menuAiDrafts'];
const now = () => new Date().toISOString();
const fail = (status, message, details) => {
  throw new ApiError(status, message, details);
};
const MSG = {
  denied: 'Bạn không có quyền thực hiện thao tác này.',
  sharedOnly: 'Chỉ Phó hiệu trưởng phụ trách dịch vụ chung (bán trú toàn trường) được thay đổi dữ liệu thực đơn.',
  invalid: 'Không lưu được thay đổi. Hãy kiểm tra các trường được đánh dấu.',
  inUse: 'Không thể xóa vì bản ghi đang được sử dụng ở dữ liệu liên quan hoặc lịch sử.',
};

const ensure = (db) => {
  const seed = buildSeedMenuPlanning();
  COLLECTIONS.forEach((key) => {
    db[key] ||= clone(seed[key]);
  });
  return db;
};

/** Databases saved before this module existed get the demo data once. */
const seeded = () => {
  const db = readDb();
  if (COLLECTIONS.some((k) => !db[k])) writeDb(ensure);
  // Bổ sung thực đơn tuần mẫu của những tuần gần đây (một lần mỗi tuần, khi còn thiếu)
  if (topUpRecentWeeklyMenus(clone(readDb()), todayInput())) writeDb((d) => topUpRecentWeeklyMenus(d, todayInput()));
  return readDb();
};

const requireUser = (user) => user || fail(401, 'Bạn chưa đăng nhập');

/** Shared-service assignment is managed by school-config (db.vpAssignments). */
const isSharedServiceVp = (db, user) => {
  if (user?.role !== ROLES.VICE_PRINCIPAL) return false;
  const assignments = db.vpAssignments || buildSeedSchoolConfig().vpAssignments;
  return assignments.some((a) => a.userId === user.id && a.sharedService);
};

const requireManager = (db, user) => {
  requireUser(user);
  if (user.role !== ROLES.VICE_PRINCIPAL) fail(403, MSG.denied);
  if (!isSharedServiceVp(db, user)) fail(403, MSG.sharedOnly);
};

const requireVp = (user) => {
  requireUser(user);
  if (user.role !== ROLES.VICE_PRINCIPAL) fail(403, MSG.denied);
};

/** Catalog readers: planners, the Principal (menu plan) and kitchens (quantities). */
const requireCatalogReader = (user) => {
  requireUser(user);
  if (!canReadPublishedMenu(user)) fail(403, MSG.denied);
};

const addHistory = (rec, action, user, note = '') => {
  rec.history ||= [];
  rec.history.push({ id: uid('h'), action, userId: user.id, at: now(), note });
};

/** Next running number after the trailing digits of codes that start with `prefix`. */
const nextCode = (list, prefix, width = 3) => {
  const max = list
    .filter((x) => String(x.code || '').startsWith(prefix))
    .reduce((m, x) => Math.max(m, parseInt(String(x.code).match(/(\d+)$/)?.[1], 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(width, '0')}`;
};

const find = (list, id, label) => list.find((x) => x.id === id) || fail(404, `Không tìm thấy ${label}`);
const matches = (text, keyword) => !keyword || normalizeText(text).includes(normalizeText(keyword).trim());
const numOrNull = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const groupName = (id) => ageGroupById(id)?.shortName || id;

/* ---------------- foods ---------------- */

const sanitizeFood = (p) => ({
  name: String(p.name || '').trim(),
  group: p.group,
  unit: p.unit,
  purchaseUnit: String(p.purchaseUnit || '').trim(),
  purchaseUnitSize: Number(p.purchaseUnitSize),
  unitPrice: numOrNull(p.unitPrice),
  wastePct: Number(p.wastePct) || 0,
  favorite: !!p.favorite,
  storage: ['FRESH', 'DRY'].includes(p.storage) ? p.storage : defaultStorageOf(p.group),
  nutrition: {
    kcal: numOrNull(p.nutrition?.kcal),
    protein: numOrNull(p.nutrition?.protein),
    lipid: numOrNull(p.nutrition?.lipid),
    glucid: numOrNull(p.nutrition?.glucid),
  },
  allergens: [...new Set((p.allergens || []).map((a) => String(a).trim()).filter(Boolean))],
  note: String(p.note || '').trim(),
  status: p.status === RECORD_STATUS.INACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
});

/* ---------------- nutrition setup ---------------- */

/** Bữa của nhóm tuổi theo Thiết lập [{ code, name }]. */
const mealsOfDb = (db, ageGroupId) => mealsOf(db.nutritionSetups, ageGroupId);
const mealCodesDb = (db, ageGroupId) => mealsOfDb(db, ageGroupId).map((m) => m.code);

/** Định mức đã lưu ở Thiết lập; chưa có thì dùng giá trị mặc định. */
const normsOf = (db, ageGroupId) => db.nutritionSetups?.find((x) => x.ageGroupId === ageGroupId)?.norms || NUTRITION_NORMS[ageGroupId];

const sanitizeSetup = (g) => ({
  enabled: g.enabled !== false,
  price: Number(g.price),
  meals: (g.meals || []).map((m) => ({
    code: m.code || uid('meal'),
    name: String(m.name || '').trim(),
    countAs: m.countAs || m.code,
  })),
  norms: Object.fromEntries(Object.entries(g.norms || {}).map(([k, range]) => [k, (range || []).map(Number)])),
});

/** Định lượng theo nhóm tuổi; `quantity` (khẩu phần chuẩn, hệ số 1) giữ cho dữ liệu cũ. */
const sanitizeIngredient = (r) => {
  if (!r.portions) return { foodId: r.foodId, quantity: Number(r.quantity) };
  const portions = Object.fromEntries(Object.entries(r.portions).map(([ag, v]) => [ag, v === '' || v == null ? null : Number(v)]));
  const std = Object.entries(portions).find(([, v]) => v != null);
  const quantity = portions['ag-4'] ?? (std ? Math.round((std[1] / portionFactorOf(std[0])) * 10) / 10 : 0);
  return { foodId: r.foodId, quantity, portions };
};

/* ---------------- reference dish library (read-only, illustrative data) ---------------- */

const sameFoodName = (a, b) => normalizeText(a).trim() === normalizeText(b).trim();
// Tỷ lệ thải bỏ mặc định khi thêm thực phẩm từ thư viện (giống dữ liệu mẫu theo nhóm)
const DEFAULT_WASTE = { GRAIN: 0, MEAT: 5, SEAFOOD: 20, EGG_DAIRY: 12, LEGUME: 2, VEGETABLE: 15, FRUIT: 25, FAT_SUGAR: 0, OTHER: 0 };

/** Món tham khảo kèm thông tin đối chiếu với danh mục của trường. */
const referenceView = (lib, db, d) => {
  const foodOf = (name) => lib.foods.find((f) => sameFoodName(f.name, name));
  const ingredients = d.ingredients.map((i) => ({
    ...i,
    unit: foodOf(i.foodName)?.unit || 'g',
    inCatalog: db.foods.some((f) => sameFoodName(f.name, i.foodName)),
  }));
  const kcal = Object.fromEntries(
    Object.keys(d.ingredients[0]?.portions || {}).map((ag) => [
      ag,
      Math.round(d.ingredients.reduce((sum, i) => sum + ((foodOf(i.foodName)?.nutrition.kcal || 0) * (i.portions[ag] || 0)) / 100, 0)),
    ]),
  );
  return {
    ...d,
    ingredients,
    kcal,
    allergens: [...new Set(d.ingredients.flatMap((i) => foodOf(i.foodName)?.allergens || []))],
    inCatalog: db.dishes.some((x) => sameFoodName(x.name, d.name)),
  };
};

/* ---------------- AI suggestion (rule-based fallback generator) ---------------- */

/** Dữ liệu cho kiểm tra tự động (cùng quy tắc với màn hình) từ DB mock. */
const checkCatalogOf = (db) => ({
  dishById: byId(db.dishes),
  foodById: byId(db.foods),
  mealPrices: db.mealPrices,
  nutritionSetups: db.nutritionSetups,
  norms: Object.fromEntries((db.nutritionSetups || []).map((x) => [x.ageGroupId, x.norms])),
});
const lower = (t) => t.charAt(0).toLowerCase() + t.slice(1);
/** Tham số dị ứng của kiểm tra tự động: số trẻ tổng hợp của nhóm và suất thay thế đã có của thực đơn mẫu. */
const allergyArgsOf = (db, ageGroupId, menuId) => ({
  allergyRows: allergyContext(db.classes, db.children, ageGroupId),
  allergyMenus: menuId ? db.allergyMenus.filter((a) => a.baseMenuId === menuId) : [],
});

/**
 * Weekly arrangement: mỗi ngày chọn thực đơn mẫu đạt kiểm tra tự động, không lặp món mặn 7 ngày, ít trùng mẫu.
 * Ngày không có mẫu nào đạt thì chọn mẫu gần đạt nhất và nói rõ để người soạn bổ sung thực đơn mẫu.
 */
const suggestWeek = (db, { ageGroupId, weekStart }) => {
  const menus = db.menus.filter((m) => m.ageGroupId === ageGroupId && m.status === RECORD_STATUS.ACTIVE);
  if (!menus.length) fail(422, 'Chưa có thực đơn mẫu đang sử dụng cho nhóm tuổi này. Hãy tạo thực đơn mẫu trước khi nhờ AI soạn tuần.');
  const catalog = checkCatalogOf(db);
  const { dishById } = catalog;
  const prev = db.weeklyMenus.find(
    (w) => w.ageGroupId === ageGroupId && w.weekStart === addDays(weekStart, -7) && w.status === WEEKLY_STATUS.PUBLISHED,
  );
  const history = (prev?.days || []).filter((d) => !d.holiday);
  const offset = Number(weekStart.replace(/\D/g, '')) % menus.length;
  const used = {};
  const reasons = {};
  let shortage = 0;
  const days = weekDates(weekStart).map((date) => {
    const ranked = menus
      .map((m, i) => {
        const trial = [...history, { date, holiday: false, meals: m.meals }];
        const repeats = repeatedMainDishes(trial, dishById).filter((x) => x.dates.includes(date));
        const problems = checkDayMenu({ meals: m.meals, ageGroupId, catalog, date, ...allergyArgsOf(db, ageGroupId, m.id) }).problems;
        const score =
          problems.length * 20 + repeats.length * 10 + (used[m.id] || 0) * 3 + ((i - offset + menus.length) % menus.length) / 100;
        return { m, repeats, problems, score };
      })
      .sort((a, b) => a.score - b.score);
    const { m: pick, repeats, problems } = ranked[0];
    used[pick.id] = (used[pick.id] || 0) + 1;
    const day = { date, holiday: false, note: '', menuId: pick.id, meals: clone(pick.meals) };
    history.push(day);
    const mains = pick.meals
      .flatMap((x) => x.items)
      .map((i) => dishById[i.dishId])
      .filter((x) => x?.type === DISH_TYPE.MAIN)
      .map((x) => x.name);
    if (!problems.length && !repeats.length)
      reasons[date] = `Đủ chất, trong tiền ăn${mains.length ? `; ${mains.join(', ')} chưa ăn trong 7 ngày` : ''}.`;
    else if (!problems.length) {
      shortage += 1;
      reasons[date] = `Đủ chất, trong tiền ăn; nhưng món ${repeats.map((x) => x.name).join(', ')} lặp lại vì chưa đủ thực đơn mẫu khác.`;
    } else {
      shortage += 1;
      const left = [...problems.map((x) => lower(x.text)), ...repeats.map((x) => `món ${x.name} lặp lại`)];
      reasons[date] = `Không có thực đơn mẫu nào đạt cho ngày này; đã chọn mẫu gần đạt nhất (${left.join('; ')}).`;
    }
    return day;
  });
  return {
    days,
    reasons,
    shortage,
    note: shortage
      ? `Thực đơn mẫu hiện có chưa đủ để ${shortage} ngày đạt chuẩn. Nên thêm hoặc sửa thực đơn mẫu, hoặc dùng bản này rồi sửa từng ngày.`
      : '',
    sourceMenuIds: [...new Set(days.map((d) => d.menuId))],
  };
};

/**
 * Đề xuất sửa một ngày theo lỗi kiểm tra tự động (bộ sinh theo quy tắc của bản mock; AI thật ở BE):
 * bữa trống ⇒ thêm món; thiếu/thừa năng lượng ⇒ đổi một món cùng loại; vượt giá ⇒ đổi món đắt nhất sang món rẻ hơn.
 * Trả { proposal: { session, fromDishId, toDishId }, reason, deltaKcal, deltaCost }.
 */
const suggestDayFix = (db, { ageGroupId, date, meals, menuId, recentMainIds = [] }) => {
  const dishById = byId(db.dishes);
  const foodById = byId(db.foods);
  const norms = { [ageGroupId]: normsOf(db, ageGroupId) };
  const price = priceOn(db.mealPrices, ageGroupId, date)?.price ?? null;
  const day = normalizeMeals(meals, mealCodesDb(db, ageGroupId));
  const one = (d) => dishTotals(d, foodById, 1, ageGroupId);
  const allergy = allergyArgsOf(db, ageGroupId, menuId);
  const kidAllergens = (d) => dishAllergens(d, foodById).filter((a) => allergy.allergyRows.some((r) => sameAllergen(r.allergen, a)));
  const uncovered = (d) =>
    kidAllergens(d).filter((a) => !allergy.allergyMenus.some((m) => (m.restrictions || []).some((x) => sameAllergen(x, a)))).length;
  const active = db.dishes.filter((d) => d.status === RECORD_STATUS.ACTIVE && !one(d).noQuantity && !kidAllergens(d).length);
  const used = new Set(day.flatMap((m) => m.items.map((i) => i.dishId)));

  // Độ lệch của một ngày: khoảng cách tới khoảng định mức (chuẩn hóa) + vượt giá + món mặn lặp 7 ngày
  const assess = (ms) => {
    const t = mealsTotals(ms, dishById, foodById, ageGroupId);
    let score = 0;
    compareToNorm(t.totals, ageGroupId, false, norms).forEach((r) => {
      const v = r.key === 'kcal' ? r.value : r.percent;
      if (r.min == null || v == null) return;
      const width = Math.max(1, r.max - r.min);
      const d = v < r.min ? (r.min - v) / width : v > r.max ? (v - r.max) / width : 0;
      score += d;
    });
    if (price != null && t.cost > price) score += ((t.cost - price) / price) * 4;
    score += ms.flatMap((m) => m.items).filter((i) => recentMainIds.includes(i.dishId)).length;
    score += ms.flatMap((m) => m.items).reduce((n, i) => n + (dishById[i.dishId] ? uncovered(dishById[i.dishId]) : 0), 0);
    return { score, t };
  };
  const swap = (session, fromId, toId) =>
    day.map((m) => (m.session !== session ? m : { ...m, items: m.items.map((i) => (i.dishId === fromId ? { ...i, dishId: toId } : i)) }));

  const empty = day.find((m) => !m.items.length);
  if (empty) {
    const pick = active.find(
      (d) => !used.has(d.id) && (empty.session === 'LUNCH' ? d.type === DISH_TYPE.MAIN : d.type === DISH_TYPE.SNACK),
    );
    if (pick)
      return {
        proposal: { session: empty.session, fromDishId: null, toDishId: pick.id },
        reason: `${mealsOfDb(db, ageGroupId).find((x) => x.code === empty.session)?.name || 'Bữa này'} đang trống nên thêm một món.`,
        deltaKcal: Math.round(one(pick).totals.kcal),
        deltaCost: one(pick).cost,
      };
  }
  const base = assess(day);
  let best = null;
  day.forEach((m) =>
    m.items.forEach((i) => {
      const from = dishById[i.dishId];
      if (!from) return;
      active
        .filter((d) => d.type === from.type && d.id !== from.id && !used.has(d.id) && !recentMainIds.includes(d.id))
        .forEach((d) => {
          const next = assess(swap(m.session, from.id, d.id));
          if (!best || next.score < best.next.score) best = { session: m.session, from, to: d, next };
        });
    }),
  );
  if (best && best.next.score < base.score - 0.01) {
    const nextMeals = swap(best.session, best.from.id, best.to.id);
    const after = checkDayMenu({ meals: nextMeals, ageGroupId, catalog: checkCatalogOf(db), date, ...allergy }).problems;
    if (nextMeals.flatMap((m) => m.items).some((i) => recentMainIds.includes(i.dishId))) after.push({ text: 'Còn món mặn lặp lại' });
    return {
      proposal: { session: best.session, fromDishId: best.from.id, toDishId: best.to.id },
      reason: after.length ? `Sau khi đổi đỡ hơn, còn: ${after.map((x) => lower(x.text)).join('; ')}.` : 'Sau khi đổi, ngày này đạt hết.',
      deltaKcal: Math.round(best.next.t.totals.kcal - base.t.totals.kcal),
      deltaCost: best.next.t.cost - base.t.cost,
    };
  }
  return fail(422, 'AI chưa tìm được món thay phù hợp cho ngày này. Bạn sửa tay trong bảng.');
};

/**
 * Daily combination: mỗi loại món một món đang dùng (tránh thành phần trẻ dị ứng), chỉnh khẩu phần cơm/cháo cho gần
 * giữa định mức; thử nhiều tổ hợp và giữ tổ hợp đạt kiểm tra tự động (hoặc ít vấn đề nhất).
 */
const suggestDay = (db, { ageGroupId, avoidAllergens }) => {
  const foodById = byId(db.foods);
  const dishById = byId(db.dishes);
  const catalog = checkCatalogOf(db);
  const restrictions = avoidAllergens ? allergyContext(db.classes, db.children, ageGroupId).map((r) => r.allergen) : [];
  const ok = (d) =>
    d.status === RECORD_STATUS.ACTIVE &&
    !dishTotals(d, foodById, 1, ageGroupId).noQuantity &&
    !dishAllergens(d, foodById).some((a) => restrictions.some((r) => sameAllergen(r, a)));
  const pool = (type) => db.dishes.filter((d) => d.type === type && ok(d));
  const nursery = ageGroupId === 'ag-2';
  const carbs = pool(DISH_TYPE.CARB).filter((d) => (nursery ? /cháo/i.test(d.name) : !/cháo/i.test(d.name)));
  const carbPool = carbs.length ? carbs : pool(DISH_TYPE.CARB);
  const [lo, hi] = normsOf(db, ageGroupId)?.kcal || [0, 0];
  const today = todayInput();
  const codes = mealCodesDb(db, ageGroupId);
  const item = (d) => (d ? [{ dishId: d.id, portion: 1 }] : []);

  const build = (seed) => {
    const pickFrom = (list, skip = []) => {
      const avail = list.filter((d) => !skip.includes(d.id));
      return avail.length ? avail[seed % avail.length] : null;
    };
    const carb = pickFrom(carbPool);
    const main = pickFrom(pool(DISH_TYPE.MAIN));
    const soup = pickFrom(pool(DISH_TYPE.SOUP));
    const dessert = pickFrom(pool(DISH_TYPE.DESSERT));
    const snack = pickFrom(pool(DISH_TYPE.SNACK));
    const dessert2 = pickFrom(pool(DISH_TYPE.DESSERT), [dessert?.id]);
    if (!carb || !main || !snack) return null;
    const meals = normalizeMeals(
      [
        { session: 'MORNING', items: item(dessert2 || dessert) },
        { session: 'LUNCH', items: [...item(carb), ...(nursery ? [] : item(main)), ...item(soup), ...item(dessert)] },
        { session: 'AFTERNOON', items: [...item(snack), ...item(dessert2)] },
        // Bữa thêm ở Thiết lập: một món bữa chiều khác (hoặc tráng miệng)
        ...codes
          .filter((code) => !['MORNING', 'LUNCH', 'AFTERNOON'].includes(code))
          .map((code) => ({ session: code, items: item(pickFrom(pool(DISH_TYPE.SNACK), [snack?.id]) || dessert) })),
      ],
      codes,
    );
    // Chỉnh khẩu phần cơm/cháo để năng lượng gần giữa khoảng định mức
    let best = null;
    for (let p = 0.8; p <= 1.41; p += 0.1) {
      const portion = Math.round(p * 10) / 10;
      const trial = meals.map((m) => ({ ...m, items: m.items.map((i) => (i.dishId === carb.id ? { ...i, portion } : i)) }));
      const gap = Math.abs(mealsTotals(trial, dishById, foodById, ageGroupId).totals.kcal - (lo + hi) / 2);
      if (!best || gap < best.gap) best = { meals: trial, gap };
    }
    return { meals: best.meals, problems: checkDayMenu({ meals: best.meals, ageGroupId, catalog, date: today }).problems };
  };

  const start = db.menuAiDrafts.length + db.menus.length;
  let chosen = null;
  for (let k = 0; k < 24 && !(chosen && !chosen.problems.length); k += 1) {
    const next = build(start + k);
    if (next && (!chosen || next.problems.length < chosen.problems.length)) chosen = next;
  }
  if (!chosen) fail(422, 'Không đủ món phù hợp (cơm/cháo, món mặn, món bữa chiều) sau khi tránh các thành phần trẻ dị ứng.');
  const reasons = [
    restrictions.length
      ? `Không dùng ${restrictions.map((x) => x.toLowerCase()).join(', ')} vì nhóm có trẻ dị ứng.`
      : 'Nhóm không có trẻ dị ứng cần tránh.',
    'Bữa trưa có đủ cơm, món mặn, canh, tráng miệng; bữa chiều có món nhẹ.',
    chosen.problems.length
      ? `Món hiện có chưa ghép được thực đơn đạt hết; còn: ${chosen.problems.map((x) => lower(x.text)).join('; ')}.`
      : 'Đủ chất và trong tiền ăn.',
  ];
  return {
    meals: chosen.meals,
    restrictions,
    reasons,
    sourceDishIds: [...new Set(chosen.meals.flatMap((m) => m.items.map((i) => i.dishId)))],
  };
};

/* ---------------- weekly menus ---------------- */

const weekEnded = (weekStart) => addDays(weekStart, 4) < todayInput();

/** Builds the 5 school days of the week, keeping adjusted meals when the sample menu did not change. */
const buildDays = (db, form, existing) => {
  const menuById = byId(db.menus);
  return weekDates(form.weekStart).map((date) => {
    const input = (form.days || []).find((d) => d.date === date) || {};
    const before = existing?.days?.find((d) => d.date === date);
    if (input.holiday) return { date, holiday: true, note: String(input.note || '').trim(), menuId: null, meals: [] };
    const menuId = input.menuId || null;
    if (!menuId) return { date, holiday: false, note: String(input.note || '').trim(), menuId: null, meals: [] };
    const menu = menuById[menuId] || fail(422, 'Thực đơn mẫu đã chọn không còn tồn tại.');
    if (menu.ageGroupId !== form.ageGroupId) fail(422, 'Thực đơn mẫu không thuộc nhóm tuổi đã chọn.');
    const keep = input.meals?.length ? input.meals : before && before.menuId === menuId ? before.meals : menu.meals;
    return {
      date,
      holiday: false,
      note: String(input.note || '').trim(),
      menuId,
      meals: normalizeMeals(keep, mealCodesDb(db, form.ageGroupId)),
    };
  });
};

const notifyPublished = (db, wm, isReplacement) => {
  const title = isReplacement ? 'Thực đơn tuần đã thay đổi' : 'Thực đơn tuần đã được xuất bản';
  const message = `${groupName(wm.ageGroupId)} – tuần ${weekLabel(wm.weekStart)}${isReplacement ? ` (phiên bản ${wm.version})` : ''}.`;
  const classTeachers = new Set(
    (db.classes || []).filter((c) => c.ageGroupId === wm.ageGroupId).flatMap((c) => [...(c.teacherIds || []), c.homeroomTeacherId]),
  );
  (db.users || []).forEach((u) => {
    if (u.role === ROLES.PRINCIPAL) pushNotification(db, { userId: u.id, type: 'MENU', title, message, link: `/menu/weekly?id=${wm.id}` });
    // GBR-MENU-05: both kitchens work from the current published menu.
    if (u.role === ROLES.KITCHEN_STAFF) pushNotification(db, { userId: u.id, type: 'MENU', title, message });
    if ([ROLES.TEACHER, ROLES.TEAM_LEADER].includes(u.role) && classTeachers.has(u.id))
      pushNotification(db, { userId: u.id, type: 'MENU', title, message });
  });
};

const visibleWeekly = (user, wm) => user.role === ROLES.VICE_PRINCIPAL || wm.status === WEEKLY_STATUS.PUBLISHED;

/** Day of a published menu resolved for the kitchen: dish details and quantity per child. */
const resolveMeals = (meals, ageGroupId, dishById, foodById) => {
  return (meals || []).map((m) => ({
    session: m.session,
    items: m.items.map((i) => {
      const dish = dishById[i.dishId];
      return {
        dishId: i.dishId,
        dishName: dish?.name || 'Món đã xóa',
        dishType: dish?.type || null,
        portion: i.portion,
        allergens: dish ? dishAllergens(dish, foodById) : [],
        ingredients: (dish?.ingredients || []).map((ing) => ({
          foodId: ing.foodId,
          foodName: foodById[ing.foodId]?.name || '',
          unit: foodById[ing.foodId]?.unit || 'g',
          quantityPerChild: Math.round((ingredientQty(ing, ageGroupId) ?? 0) * i.portion * 10) / 10,
        })),
      };
    }),
  }));
};

export const menuPlanningMockRepository = {
  /* ----- access ----- */
  async getAccess(user) {
    await delay(60);
    requireUser(user);
    const db = seeded();
    return { sharedService: isSharedServiceVp(db, user) };
  },

  async getCatalog(user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    return {
      foods: clone(db.foods),
      dishes: clone(db.dishes),
      menus: clone(db.menus),
      allergyMenus: clone(db.allergyMenus),
      mealPrices: clone(db.mealPrices),
      nutritionSetups: clone(db.nutritionSetups),
      norms: Object.fromEntries(db.nutritionSetups.map((x) => [x.ageGroupId, clone(x.norms)])),
    };
  },

  async getAllergyContext(ageGroupId, user) {
    await delay(80);
    requireUser(user);
    if (![ROLES.VICE_PRINCIPAL, ROLES.PRINCIPAL].includes(user.role)) fail(403, MSG.denied);
    const db = seeded();
    return allergyContext(db.classes, db.children, ageGroupId || null);
  },

  /* ----- foods (#69–#71) ----- */
  async listFoods(filters = {}, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    return clone(
      db.foods.filter(
        (f) =>
          matches(`${f.code} ${f.name}`, filters.keyword) &&
          (!filters.group || f.group === filters.group) &&
          (!filters.status || f.status === filters.status) &&
          (!filters.allergen || f.allergens.some((a) => sameAllergen(a, filters.allergen))),
      ),
    );
  },

  async getFood(id, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    const food = clone(find(db.foods, id, 'thực phẩm'));
    food.usedInDishes = db.dishes.filter((d) => d.ingredients.some((i) => i.foodId === id)).map((d) => ({ id: d.id, name: d.name }));
    return food;
  },

  async saveFood(id, payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const data = sanitizeFood(payload);
      const errors = validateFood({ ...payload, ...data, id }, db.foods);
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      let food;
      if (id) {
        food = find(db.foods, id, 'thực phẩm');
        Object.assign(food, data, { updatedAt: now() });
        addHistory(food, 'UPDATED', user);
      } else {
        food = {
          id: uid('f'),
          code: nextCode(db.foods, 'TP'),
          ...data,
          createdBy: user.id,
          createdAt: now(),
          updatedAt: now(),
          history: [],
        };
        addHistory(food, 'CREATED', user);
        db.foods.unshift(food);
      }
      return clone(food);
    });
  },

  /**
   * Lưu nhiều thực phẩm một lần (sửa hàng loạt, nhập khẩu): items [{ key, id?, data }].
   * Có id: chỉ ghi các trường gửi lên; không id: thêm mới. Lỗi một dòng thì không ghi dòng nào (lỗi theo `${key}.${field}`).
   */
  async saveFoodsBulk(items, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const errors = {};
      const others = [...db.foods];
      const plans = (items || []).map((it) => {
        const before = it.id ? db.foods.find((f) => f.id === it.id) : null;
        if (it.id && !before) {
          errors[`${it.key}.code`] = 'Không tìm thấy thực phẩm.';
          return null;
        }
        const merged = before
          ? { ...before, ...it.data, nutrition: { ...before.nutrition, ...(it.data.nutrition || {}) } }
          : { purchaseUnit: 'kg', purchaseUnitSize: 1000, unit: 'g', allergens: [], note: '', status: RECORD_STATUS.ACTIVE, ...it.data };
        const data = sanitizeFood(merged);
        const rowErrors = validateFood({ ...merged, ...data, id: before?.id }, others);
        Object.entries(rowErrors).forEach(([field, msg]) => (errors[`${it.key}.${field}`] = msg));
        if (!before) others.push({ ...data, id: `new-${it.key}` });
        return { before, data };
      });
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      let created = 0;
      let updated = 0;
      plans.forEach(({ before, data }) => {
        if (before) {
          Object.assign(before, data, { updatedAt: now() });
          addHistory(before, 'UPDATED', user, 'Sửa hàng loạt / nhập khẩu');
          updated += 1;
        } else {
          const food = {
            id: uid('f'),
            code: nextCode(db.foods, 'TP'),
            ...data,
            createdBy: user.id,
            createdAt: now(),
            updatedAt: now(),
            history: [],
          };
          addHistory(food, 'CREATED', user, 'Nhập khẩu');
          db.foods.unshift(food);
          created += 1;
        }
      });
      return { created, updated };
    });
  },

  /** Đánh dấu "Hay dùng" để lọc nhanh, không ghi lịch sử sửa thực phẩm. */
  async setFoodFavorite(id, favorite, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const food = find(db.foods, id, 'thực phẩm');
      food.favorite = !!favorite;
      return clone(food);
    });
  },

  async deleteFood(id, user) {
    await delay();
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      find(db.foods, id, 'thực phẩm');
      if (db.dishes.some((d) => d.ingredients.some((i) => i.foodId === id))) fail(409, `${MSG.inUse} Hãy chuyển sang "Ngừng sử dụng".`);
      db.foods = db.foods.filter((f) => f.id !== id);
    });
  },

  /* ----- dishes (#72–#74) ----- */
  async listDishes(filters = {}, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    const foodById = byId(db.foods);
    return clone(
      db.dishes.filter(
        (d) =>
          matches(`${d.code} ${d.name}`, filters.keyword) &&
          (!filters.type || d.type === filters.type) &&
          (!filters.status || d.status === filters.status) &&
          (!filters.allergen || dishAllergens(d, foodById).some((a) => sameAllergen(a, filters.allergen))),
      ),
    );
  },

  async getDish(id, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    const dish = clone(find(db.dishes, id, 'món ăn'));
    dish.usedInMenus = db.menus
      .filter((m) => m.meals.some((ml) => ml.items.some((i) => i.dishId === id)))
      .map((m) => ({ id: m.id, name: m.name }));
    return dish;
  },

  async saveDish(id, payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const before = id ? find(db.dishes, id, 'món ăn') : null;
      const data = {
        name: String(payload.name || '').trim(),
        type: payload.type,
        description: String(payload.description || '').trim(),
        ingredients: (payload.ingredients || []).map(sanitizeIngredient),
        status: payload.status === RECORD_STATUS.INACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
      };
      const errors = validateDish({ ...data, id }, db.dishes);
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      const foodById = byId(db.foods);
      data.ingredients.forEach((r) => {
        const food = foodById[r.foodId] || fail(422, 'Thực phẩm đã chọn không còn tồn tại.');
        const isNew = !before?.ingredients.some((x) => x.foodId === r.foodId);
        if (isNew && food.status === RECORD_STATUS.INACTIVE) fail(422, `${food.name} đã ngừng sử dụng, không thêm được vào món.`);
      });
      let dish;
      if (before) {
        dish = Object.assign(before, data, { updatedAt: now() });
        addHistory(dish, 'UPDATED', user);
      } else {
        dish = {
          id: uid('d'),
          code: nextCode(db.dishes, 'MA'),
          ...data,
          createdBy: user.id,
          createdAt: now(),
          updatedAt: now(),
          history: [],
        };
        addHistory(dish, 'CREATED', user);
        db.dishes.unshift(dish);
      }
      return clone(dish);
    });
  },

  async deleteDish(id, user) {
    await delay();
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      find(db.dishes, id, 'món ăn');
      const inMeals = (meals) => (meals || []).some((m) => m.items.some((i) => i.dishId === id));
      const used =
        db.menus.some((m) => inMeals(m.meals)) ||
        db.allergyMenus.some((a) => a.replacements.some((r) => r.originalDishId === id || r.replacementDishId === id)) ||
        db.weeklyMenus.some((w) => w.days.some((d) => inMeals(d.meals)));
      if (used) fail(409, `${MSG.inUse} Hãy chuyển sang "Ngừng sử dụng".`);
      db.dishes = db.dishes.filter((d) => d.id !== id);
    });
  },

  /* ----- meal prices (#75–#76) ----- */
  async listMealPrices(filters = {}, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    return clone(db.mealPrices.filter((p) => !filters.ageGroupId || p.ageGroupId === filters.ageGroupId));
  },

  async getMealPrice(id, user) {
    await delay();
    requireVp(user);
    return clone(find(seeded().mealPrices, id, 'giá suất ăn'));
  },

  async saveMealPrice(id, payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const data = {
        ageGroupId: payload.ageGroupId,
        price: Number(payload.price),
        effectiveFrom: payload.effectiveFrom,
        effectiveTo: payload.effectiveTo || null,
        note: String(payload.note || '').trim(),
      };
      const errors = validateMealPrice({ ...data, id }, db.mealPrices);
      const before = id ? find(db.mealPrices, id, 'giá suất ăn') : null;
      // GBR-GEN-06: a price already in force keeps its trace; changing it needs a reason.
      if (before && before.effectiveFrom <= todayInput() && !String(payload.reason || '').trim())
        errors.reason = 'Giá này đã được áp dụng. Hãy nhập lý do thay đổi.';
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      let rec;
      if (before) {
        const note = `${before.price.toLocaleString('vi-VN')} đ → ${data.price.toLocaleString('vi-VN')} đ${
          payload.reason ? ` · ${payload.reason.trim()}` : ''
        }`;
        rec = Object.assign(before, data, { updatedAt: now() });
        addHistory(rec, 'UPDATED', user, note);
      } else {
        rec = { id: uid('mp'), ...data, createdBy: user.id, createdAt: now(), updatedAt: now(), history: [] };
        addHistory(rec, 'CREATED', user);
        db.mealPrices.unshift(rec);
      }
      return clone(rec);
    });
  },

  async deleteMealPrice(id, user) {
    await delay();
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const rec = find(db.mealPrices, id, 'giá suất ăn');
      if (rec.effectiveFrom <= todayInput()) fail(409, `${MSG.inUse} Giá đã áp dụng chỉ có thể kết thúc bằng ngày hết hiệu lực.`);
      db.mealPrices = db.mealPrices.filter((p) => p.id !== id);
    });
  },

  /* ----- reference dish library: read-only list, copy one dish (and missing foods) into the school catalog ----- */
  async listReferenceDishes(filters = {}, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    const lib = buildReferenceLibrary();
    return lib.dishes
      .filter((d) => matches(d.name, filters.keyword) && (!filters.type || d.type === filters.type))
      .map((d) => referenceView(lib, db, d));
  },

  async copyReferenceDish(id, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const lib = buildReferenceLibrary();
      const ref = lib.dishes.find((d) => d.id === id) || fail(404, 'Không tìm thấy món trong thư viện.');
      if (db.dishes.some((x) => sameFoodName(x.name, ref.name))) fail(409, `Danh mục của trường đã có món "${ref.name}".`);
      const addedFoods = [];
      const ingredients = ref.ingredients.map((i) => {
        let food = db.foods.find((f) => sameFoodName(f.name, i.foodName));
        if (!food) {
          // Thực phẩm còn thiếu: thêm với dinh dưỡng của thư viện, chưa có đơn giá để PHT bổ sung
          const src = lib.foods.find((f) => sameFoodName(f.name, i.foodName));
          food = {
            id: uid('f'),
            code: nextCode(db.foods, 'TP'),
            name: src.name,
            group: src.group,
            unit: src.unit,
            purchaseUnit: src.unit === 'ml' ? 'lít' : 'kg',
            purchaseUnitSize: 1000,
            unitPrice: null,
            wastePct: DEFAULT_WASTE[src.group] ?? 0,
            favorite: false,
            storage: defaultStorageOf(src.group),
            nutrition: { ...src.nutrition },
            allergens: [...src.allergens],
            note: 'Thêm từ thư viện món tham khảo – cần bổ sung đơn giá.',
            status: RECORD_STATUS.ACTIVE,
            createdBy: user.id,
            createdAt: now(),
            updatedAt: now(),
            history: [],
          };
          addHistory(food, 'CREATED', user, 'Thêm từ thư viện món tham khảo');
          db.foods.unshift(food);
          addedFoods.push(food.name);
        }
        return sanitizeIngredient({ foodId: food.id, portions: i.portions });
      });
      const dish = {
        id: uid('d'),
        code: nextCode(db.dishes, 'MA'),
        name: ref.name,
        type: ref.type,
        description: ref.description,
        ingredients,
        status: RECORD_STATUS.ACTIVE,
        createdBy: user.id,
        createdAt: now(),
        updatedAt: now(),
        history: [],
      };
      addHistory(dish, 'CREATED', user, 'Chép từ thư viện món tham khảo');
      db.dishes.unshift(dish);
      return { dish: clone(dish), addedFoods };
    });
  },

  /* ----- nutrition setup: meals, unit price per meal, daily reference ranges ----- */
  async listNutritionSetups(user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    // Số trẻ đang học của nhóm tuổi (đếm theo lớp), chỉ để hiển thị trên Thiết lập
    const classAge = Object.fromEntries((db.classes || []).map((c) => [c.id, c.ageGroupId]));
    const childCount = (ag) => (db.children || []).filter((ch) => ch.status === 'ACTIVE' && classAge[ch.classId] === ag).length;
    return db.nutritionSetups.map((x) => ({
      ...clone(x),
      // Dữ liệu cũ lưu giá theo từng bữa: giá ngày = tổng
      price: x.price ?? (x.meals || []).reduce((sum, m) => sum + (m.unitPrice || 0), 0),
      childCount: childCount(x.ageGroupId),
      prices: clone(
        db.mealPrices.filter((p) => p.ageGroupId === x.ageGroupId).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)),
      ),
    }));
  },

  /** payload: { effectiveFrom, reason, basis, groups: [{ ageGroupId, enabled, meals, norms }] } – giá mới áp dụng từ effectiveFrom. */
  async saveNutritionSetups(payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const today = todayInput();
      const effectiveFrom = payload.effectiveFrom;
      const groups = (payload.groups || []).filter((g) => db.nutritionSetups.some((x) => x.ageGroupId === g.ageGroupId));
      const errors = validateNutritionSetup({ effectiveFrom, groups }, today);
      const reason = String(payload.reason || '').trim();
      const plans = groups.map((g) => {
        const data = sanitizeSetup(g);
        const total = data.price;
        const current = priceOn(db.mealPrices, g.ageGroupId, effectiveFrom);
        const later = db.mealPrices.find((p) => p.ageGroupId === g.ageGroupId && p.effectiveFrom > effectiveFrom);
        // So với mức giá mới nhất (có thể là giá đã hẹn ngày sau), không phải giá hôm nay
        const latest = later
          ? db.mealPrices.filter((p) => p.ageGroupId === g.ageGroupId).sort((x, y) => (x.effectiveFrom < y.effectiveFrom ? 1 : -1))[0]
          : current;
        const changed = !latest || latest.price !== total;
        if (changed && later)
          errors[`${g.ageGroupId}.meals`] =
            `Đã có giá áp dụng từ ${formatDate(later.effectiveFrom)}. Hãy chọn ngày áp dụng từ ngày đó trở đi.`;
        // GBR-GEN-06: sửa giá đang áp dụng từ chính ngày này phải có lý do
        if (changed && current?.effectiveFrom === effectiveFrom && effectiveFrom <= today && !reason)
          errors.reason = 'Giá này đã được áp dụng. Hãy nhập lý do thay đổi.';
        return { g, data, total, current, changed };
      });
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      const basis = String(payload.basis || '').trim();
      const snapshot = (x) => JSON.stringify([x.enabled, x.price, x.meals, x.norms, x.basis]);
      plans.forEach(({ g, data, total, current, changed }) => {
        const setup = db.nutritionSetups.find((x) => x.ageGroupId === g.ageGroupId);
        const before = snapshot(setup);
        Object.assign(setup, data, { basis });
        if (snapshot(setup) !== before) {
          Object.assign(setup, { updatedBy: user.id, updatedAt: now() });
          addHistory(setup, 'UPDATED', user, reason);
        }
        if (!changed) return;
        if (current?.effectiveFrom === effectiveFrom) {
          const note = `${current.price.toLocaleString('vi-VN')} đ → ${total.toLocaleString('vi-VN')} đ${reason ? ` · ${reason}` : ''}`;
          Object.assign(current, { price: total, updatedAt: now() });
          addHistory(current, 'UPDATED', user, note);
          return;
        }
        if (current) current.effectiveTo = addDays(effectiveFrom, -1);
        const rec = {
          id: uid('mp'),
          ageGroupId: g.ageGroupId,
          price: total,
          effectiveFrom,
          effectiveTo: null,
          note: reason,
          createdBy: user.id,
          createdAt: now(),
          updatedAt: now(),
          history: [],
        };
        addHistory(rec, 'CREATED', user);
        db.mealPrices.unshift(rec);
      });
      return clone(db.nutritionSetups);
    });
  },

  /* ----- sample daily menus (#77–#79) ----- */
  async listMenus(filters = {}, user) {
    await delay();
    requireVp(user);
    const db = seeded();
    return clone(
      db.menus.filter(
        (m) =>
          matches(`${m.code} ${m.name}`, filters.keyword) &&
          (!filters.ageGroupId || m.ageGroupId === filters.ageGroupId) &&
          (!filters.status || m.status === filters.status),
      ),
    );
  },

  async getMenu(id, user) {
    await delay();
    requireVp(user);
    const db = seeded();
    const menu = clone(find(db.menus, id, 'thực đơn'));
    menu.allergyMenus = clone(db.allergyMenus.filter((a) => a.baseMenuId === id));
    menu.usedInWeeks = db.weeklyMenus
      .filter((w) => w.days.some((d) => d.menuId === id))
      .map((w) => ({ id: w.id, code: w.code, weekStart: w.weekStart, status: w.status, version: w.version }));
    return menu;
  },

  async saveMenu(id, payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const before = id ? find(db.menus, id, 'thực đơn') : null;
      const ageGroupId = before ? before.ageGroupId : payload.ageGroupId;
      const data = {
        name: String(payload.name || '').trim(),
        ageGroupId,
        meals: ageGroupId ? normalizeMeals(payload.meals, mealCodesDb(db, ageGroupId)) : [],
        note: String(payload.note || '').trim(),
        status: payload.status === RECORD_STATUS.INACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
      };
      const errors = validateMenu({ ...data, id }, db.menus, mealsOfDb(db, data.ageGroupId));
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      const dishById = byId(db.dishes);
      const oldIds = (before?.meals || []).flatMap((m) => m.items.map((i) => i.dishId));
      data.meals.forEach((m) =>
        m.items.forEach((i) => {
          const dish = dishById[i.dishId] || fail(422, 'Món đã chọn không còn tồn tại.');
          if (!oldIds.includes(i.dishId) && dish.status === RECORD_STATUS.INACTIVE) fail(422, `${dish.name} đã ngừng sử dụng.`);
        }),
      );
      let menu;
      if (before) {
        menu = Object.assign(before, data, { updatedAt: now() });
        addHistory(menu, 'UPDATED', user);
      } else {
        const prefix = { 'ag-2': 'TD-NT-', 'ag-3': 'TD-MGB-', 'ag-4': 'TD-MGN-', 'ag-5': 'TD-MGL-' }[ageGroupId] || 'TD-';
        const code = nextCode(
          db.menus.filter((m) => m.ageGroupId === ageGroupId),
          prefix,
          2,
        );
        menu = { id: uid('mn'), code, ...data, createdBy: user.id, createdAt: now(), updatedAt: now(), history: [] };
        addHistory(menu, 'CREATED', user);
        db.menus.unshift(menu);
      }
      if (payload.aiDraftId) {
        const draft = db.menuAiDrafts.find((d) => d.id === payload.aiDraftId);
        if (draft) Object.assign(draft, { status: AI_DRAFT_STATUS.APPLIED, appliedTo: menu.id, reviewedBy: user.id, reviewedAt: now() });
        addHistory(menu, 'AI_APPLIED', user, 'Bản nháp AI đã được người dùng xem xét và chỉnh sửa trước khi lưu.');
      }
      return clone(menu);
    });
  },

  async deleteMenu(id, user) {
    await delay();
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      find(db.menus, id, 'thực đơn');
      if (db.weeklyMenus.some((w) => w.days.some((d) => d.menuId === id)) || db.allergyMenus.some((a) => a.baseMenuId === id))
        fail(409, `${MSG.inUse} Hãy chuyển sang "Ngừng sử dụng".`);
      db.menus = db.menus.filter((m) => m.id !== id);
    });
  },

  /* ----- alternative menus (#80–#82) ----- */
  async listAllergyMenus(filters = {}, user) {
    await delay();
    requireVp(user);
    const db = seeded();
    return clone(
      db.allergyMenus.filter(
        (a) =>
          matches(`${a.code} ${a.name}`, filters.keyword) &&
          (!filters.ageGroupId || a.ageGroupId === filters.ageGroupId) &&
          (!filters.baseMenuId || a.baseMenuId === filters.baseMenuId) &&
          (!filters.restriction || a.restrictions.some((r) => sameAllergen(r, filters.restriction))),
      ),
    );
  },

  async getAllergyMenu(id, user) {
    await delay();
    requireVp(user);
    return clone(find(seeded().allergyMenus, id, 'thực đơn thay thế'));
  },

  async saveAllergyMenu(id, payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const before = id ? find(db.allergyMenus, id, 'thực đơn thay thế') : null;
      const base = find(db.menus, before ? before.baseMenuId : payload.baseMenuId, 'thực đơn mẫu');
      const inBase = (r) => base.meals.some((m) => m.session === r.session && m.items.some((i) => i.dishId === r.originalDishId));
      const data = {
        name: String(payload.name || '').trim(),
        baseMenuId: base.id,
        ageGroupId: base.ageGroupId,
        groupType: payload.groupType === 'DIET' ? 'DIET' : 'ALLERGY',
        restrictions: [...new Set((payload.restrictions || []).map((r) => String(r).trim()).filter(Boolean))],
        replacements: (payload.replacements || []).filter(inBase).map((r) => ({
          session: r.session,
          originalDishId: r.originalDishId,
          replacementDishId: r.replacementDishId || null,
          portion: Number(r.portion) || 1,
        })),
        note: String(payload.note || '').trim(),
        status: payload.status === RECORD_STATUS.INACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
      };
      const errors = validateAllergyMenu(data, { menus: db.menus, dishes: db.dishes, foods: db.foods });
      if (hasErrors(errors)) fail(422, errors.replacements || MSG.invalid, errors);
      let rec;
      if (before) {
        rec = Object.assign(before, data, { updatedAt: now() });
        addHistory(rec, 'UPDATED', user);
      } else {
        rec = {
          id: uid('am'),
          code: nextCode(db.allergyMenus, 'TDT-', 2),
          ...data,
          createdBy: user.id,
          createdAt: now(),
          updatedAt: now(),
          history: [],
        };
        addHistory(rec, 'CREATED', user);
        db.allergyMenus.unshift(rec);
      }
      return clone(rec);
    });
  },

  async deleteAllergyMenu(id, user) {
    await delay();
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const rec = find(db.allergyMenus, id, 'thực đơn thay thế');
      const live = db.weeklyMenus.some((w) => w.status === WEEKLY_STATUS.PUBLISHED && w.days.some((d) => d.menuId === rec.baseMenuId));
      if (live) fail(409, `${MSG.inUse} Thực đơn mẫu gốc đang nằm trong thực đơn tuần đã xuất bản; hãy chuyển sang "Ngừng sử dụng".`);
      db.allergyMenus = db.allergyMenus.filter((a) => a.id !== id);
    });
  },

  /* ----- weekly menus (#84–#86) ----- */
  async listWeeklyMenus(filters = {}, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    return clone(
      db.weeklyMenus
        .filter((w) => visibleWeekly(user, w))
        .filter(
          (w) =>
            (!filters.ageGroupId || w.ageGroupId === filters.ageGroupId) &&
            (!filters.status || w.status === filters.status) &&
            (!filters.from || w.weekStart >= mondayOf(filters.from)) &&
            (!filters.to || w.weekStart <= filters.to) &&
            matches(`${w.code} ${weekLabel(w.weekStart)}`, filters.keyword),
        )
        .sort((a, b) => (a.weekStart === b.weekStart ? b.version - a.version : a.weekStart < b.weekStart ? 1 : -1)),
    );
  },

  async getWeeklyMenu(id, user) {
    await delay();
    requireCatalogReader(user);
    const db = seeded();
    const wm = find(db.weeklyMenus, id, 'thực đơn tuần');
    if (!visibleWeekly(user, wm) && !(canViewMenuPlan(user) && wm.status === WEEKLY_STATUS.REPLACED)) fail(403, MSG.denied);
    const out = clone(wm);
    out.replacedBy = db.weeklyMenus.find((w) => w.replacesId === id)?.id || null;
    out.previousWeek = clone(
      db.weeklyMenus.find(
        (w) => w.ageGroupId === wm.ageGroupId && w.weekStart === addDays(wm.weekStart, -7) && w.status === WEEKLY_STATUS.PUBLISHED,
      ) || null,
    );
    return out;
  },

  async saveWeeklyMenu(id, payload, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const before = id ? find(db.weeklyMenus, id, 'thực đơn tuần') : null;
      if (before && before.status !== WEEKLY_STATUS.DRAFT)
        fail(409, 'Thực đơn đã xuất bản không sửa trực tiếp. Hãy tạo phiên bản thay thế.');
      // A replacement keeps the week and age group of the published version.
      const form = {
        ageGroupId: before?.replacesId ? before.ageGroupId : payload.ageGroupId,
        weekStart: before?.replacesId ? before.weekStart : payload.weekStart,
        days: payload.days,
      };
      const errors = validateWeeklyMenu(form);
      if (hasErrors(errors)) fail(422, MSG.invalid, errors);
      if (!before?.replacesId && weekEnded(form.weekStart)) fail(422, 'Không lập thực đơn cho tuần đã qua.');
      const clash = db.weeklyMenus.find(
        (w) =>
          w.id !== id &&
          w.id !== before?.replacesId &&
          w.ageGroupId === form.ageGroupId &&
          w.weekStart === form.weekStart &&
          w.status !== WEEKLY_STATUS.REPLACED,
      );
      if (clash) fail(409, `Nhóm tuổi này đã có thực đơn tuần ${clash.code} cho tuần đã chọn. Hãy mở bản đã có.`, { existingId: clash.id });
      const data = { ...form, days: buildDays(db, form, before), note: String(payload.note || '').trim() };
      let wm;
      if (before) {
        wm = Object.assign(before, data, { updatedAt: now() });
        addHistory(wm, 'UPDATED', user);
      } else {
        wm = {
          id: uid('wm'),
          code: nextCode(db.weeklyMenus, `TT-${form.weekStart.slice(0, 4)}-`, 2),
          ...data,
          status: WEEKLY_STATUS.DRAFT,
          version: 1,
          replacesId: null,
          aiDraftId: payload.aiDraftId || null,
          createdBy: user.id,
          createdAt: now(),
          updatedAt: now(),
          publishedBy: null,
          publishedAt: null,
          history: [],
        };
        addHistory(wm, 'CREATED', user);
        db.weeklyMenus.unshift(wm);
      }
      if (payload.aiDraftId) {
        const draft = db.menuAiDrafts.find((d) => d.id === payload.aiDraftId);
        if (draft && draft.status === AI_DRAFT_STATUS.PENDING_REVIEW) {
          Object.assign(draft, { status: AI_DRAFT_STATUS.APPLIED, appliedTo: wm.id, reviewedBy: user.id, reviewedAt: now() });
          wm.aiDraftId = draft.id;
          addHistory(wm, 'AI_APPLIED', user, 'Bản nháp AI đã được người dùng xem xét trước khi lưu.');
        }
      }
      return clone(wm);
    });
  },

  async saveDayAdjustment(id, date, meals, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const wm = find(db.weeklyMenus, id, 'thực đơn tuần');
      if (wm.status !== WEEKLY_STATUS.DRAFT) fail(409, 'Thực đơn đã xuất bản không sửa trực tiếp. Hãy tạo phiên bản thay thế.');
      const day = wm.days.find((d) => d.date === date && !d.holiday) || fail(404, 'Ngày này không có thực đơn.');
      const normalized = normalizeMeals(meals, mealCodesDb(db, wm.ageGroupId));
      const errors = validateMenu({ name: 'x', ageGroupId: wm.ageGroupId, meals: normalized }, [], mealsOfDb(db, wm.ageGroupId));
      if (hasErrors(errors)) fail(422, Object.values(errors)[0], errors);
      const dishById = byId(db.dishes);
      normalized.forEach((m) => m.items.forEach((i) => dishById[i.dishId] || fail(422, 'Món đã chọn không còn tồn tại.')));
      day.meals = normalized;
      wm.updatedAt = now();
      addHistory(wm, 'ADJUSTED', user, `Điều chỉnh món/khẩu phần ngày ${date.split('-').reverse().join('/')}`);
      return clone(wm);
    });
  },

  async publishWeeklyMenu(id, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const wm = find(db.weeklyMenus, id, 'thực đơn tuần');
      if (wm.status !== WEEKLY_STATUS.DRAFT) fail(409, 'Chỉ xuất bản được thực đơn đang ở trạng thái nháp.');
      const errors = validateWeeklyMenu(wm, { forPublish: true });
      wm.days.forEach((d, i) => {
        if (!d.holiday && !(d.meals || []).some((m) => m.items.length)) errors[`day_${i}`] = 'Ngày học chưa có món.';
      });
      if (hasErrors(errors)) fail(422, 'Chưa xuất bản được: còn ngày học chưa có thực đơn.', errors);
      if (!wm.replacesId && weekEnded(wm.weekStart)) fail(422, 'Tuần này đã qua, không xuất bản được.');
      const old = wm.replacesId ? db.weeklyMenus.find((w) => w.id === wm.replacesId) : null;
      if (old) {
        old.status = WEEKLY_STATUS.REPLACED;
        addHistory(old, 'REPLACED', user, `Thay bằng phiên bản ${wm.version}`);
      }
      wm.status = WEEKLY_STATUS.PUBLISHED;
      wm.publishedBy = user.id;
      wm.publishedAt = now();
      addHistory(wm, 'PUBLISHED', user);
      notifyPublished(db, wm, !!old);
      return clone(wm);
    });
  },

  async createReplacement(id, reason, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const wm = find(db.weeklyMenus, id, 'thực đơn tuần');
      if (wm.status !== WEEKLY_STATUS.PUBLISHED) fail(409, 'Chỉ tạo phiên bản thay thế cho thực đơn đã xuất bản.');
      if (!String(reason || '').trim()) fail(422, 'Hãy nhập lý do thay đổi thực đơn đã xuất bản.', { reason: 'Trường này là bắt buộc.' });
      const existing = db.weeklyMenus.find((w) => w.replacesId === id && w.status === WEEKLY_STATUS.DRAFT);
      if (existing) return clone(existing);
      const copy = {
        ...clone(wm),
        id: uid('wm'),
        status: WEEKLY_STATUS.DRAFT,
        version: wm.version + 1,
        replacesId: wm.id,
        changeReason: reason.trim(),
        createdBy: user.id,
        createdAt: now(),
        updatedAt: now(),
        publishedBy: null,
        publishedAt: null,
        history: [],
      };
      addHistory(copy, 'REPLACEMENT_CREATED', user, reason.trim());
      db.weeklyMenus.unshift(copy);
      return clone(copy);
    });
  },

  async deleteWeeklyMenu(id, user) {
    await delay();
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const wm = find(db.weeklyMenus, id, 'thực đơn tuần');
      if (wm.status !== WEEKLY_STATUS.DRAFT) fail(409, MSG.inUse);
      db.weeklyMenus = db.weeklyMenus.filter((w) => w.id !== id);
    });
  },

  /* ----- AI suggestion (#83) ----- */
  async generateAiSuggestion(params, user) {
    await delay(700);
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const ageGroupId = params?.ageGroupId || fail(422, 'Chọn nhóm tuổi.', { ageGroupId: 'Trường này là bắt buộc.' });
      const kind = params.kind === AI_DRAFT_KIND.DAILY ? AI_DRAFT_KIND.DAILY : AI_DRAFT_KIND.WEEKLY;
      let result;
      if (params.kind === AI_DRAFT_KIND.DAY_FIX) {
        if (!params.date || !params.meals) fail(422, 'Thiếu ngày cần sửa.');
        const draft = {
          id: uid('ai'),
          kind: AI_DRAFT_KIND.DAY_FIX,
          ageGroupId,
          date: params.date,
          weeklyMenuId: params.weeklyMenuId || null,
          ...suggestDayFix(db, {
            ageGroupId,
            date: params.date,
            meals: params.meals,
            menuId: params.menuId || null,
            recentMainIds: params.recentMainIds || [],
          }),
          generator: 'RULE_BASED_FALLBACK',
          status: AI_DRAFT_STATUS.PENDING_REVIEW,
          createdBy: user.id,
          createdAt: now(),
        };
        db.menuAiDrafts.unshift(draft);
        db.menuAiDrafts = db.menuAiDrafts.slice(0, 30);
        return clone(draft);
      }
      if (kind === AI_DRAFT_KIND.WEEKLY) {
        if (!params.weekStart) fail(422, 'Chọn tuần cần gợi ý.', { weekStart: 'Trường này là bắt buộc.' });
        result = suggestWeek(db, { ageGroupId, weekStart: mondayOf(params.weekStart) });
        result.allergyCounts = allergyContext(db.classes, db.children, ageGroupId).map((r) => ({
          allergen: r.allergen,
          childCount: r.childCount,
        }));
      } else {
        result = suggestDay(db, { ageGroupId, avoidAllergens: params.avoidAllergens !== false });
      }
      const draft = {
        id: uid('ai'),
        kind,
        ageGroupId,
        weekStart: kind === AI_DRAFT_KIND.WEEKLY ? mondayOf(params.weekStart) : null,
        ...result,
        // Điều kiện người soạn gửi kèm (mùa, mong muốn) — bản mock chưa dùng, AI thật ở BE sẽ dùng
        conditions: { season: params.season || '', wishes: String(params.wishes || '').trim(), noRepeatDays: params.noRepeatDays || null },
        mealPrice: priceOn(db.mealPrices, ageGroupId, params.weekStart || todayInput())?.price ?? null,
        // UC 6.9 alternative flow: no verified model is connected, so the rule-based fallback is labelled as such.
        generator: 'RULE_BASED_FALLBACK',
        status: AI_DRAFT_STATUS.PENDING_REVIEW,
        createdBy: user.id,
        createdAt: now(),
      };
      db.menuAiDrafts.unshift(draft);
      db.menuAiDrafts = db.menuAiDrafts.slice(0, 30);
      return clone(draft);
    });
  },

  async getAiDraft(id, user) {
    await delay(80);
    requireVp(user);
    return clone(find(seeded().menuAiDrafts, id, 'bản nháp AI'));
  },

  /** Người duyệt áp dụng đề xuất sửa ngày vào bản nháp thực đơn tuần (ghi vết bản nháp AI đã dùng). */
  async applyDayFix(id, weeklyMenuId, user) {
    await delay();
    return writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const draft = find(db.menuAiDrafts, id, 'bản nháp AI');
      if (draft.kind !== AI_DRAFT_KIND.DAY_FIX || draft.status !== AI_DRAFT_STATUS.PENDING_REVIEW) fail(409, 'Đề xuất này đã được xử lý.');
      const wm = find(db.weeklyMenus, weeklyMenuId, 'thực đơn tuần');
      if (wm.status !== WEEKLY_STATUS.DRAFT) fail(409, 'Thực đơn đã xuất bản không sửa trực tiếp. Hãy tạo phiên bản thay thế.');
      const day = wm.days.find((d) => d.date === draft.date && !d.holiday) || fail(404, 'Ngày này không có thực đơn.');
      const { session, fromDishId, toDishId } = draft.proposal;
      const meals = normalizeMeals(day.meals, mealCodesDb(db, wm.ageGroupId)).map((m) => {
        if (m.session !== session) return m;
        if (!fromDishId) return { ...m, items: [...m.items, { dishId: toDishId, portion: 1 }] };
        return { ...m, items: m.items.map((i) => (i.dishId === fromDishId ? { ...i, dishId: toDishId } : i)) };
      });
      day.meals = meals;
      wm.updatedAt = now();
      Object.assign(draft, { status: AI_DRAFT_STATUS.APPLIED, appliedTo: wm.id, reviewedBy: user.id, reviewedAt: now() });
      addHistory(wm, 'AI_APPLIED', user, `Áp dụng đề xuất AI cho ngày ${formatDate(draft.date)}.`);
      return clone(wm);
    });
  },

  async dismissAiDraft(id, user) {
    await delay(80);
    writeDb((db) => {
      ensure(db);
      requireManager(db, user);
      const d = find(db.menuAiDrafts, id, 'bản nháp AI');
      if (d.status === AI_DRAFT_STATUS.PENDING_REVIEW)
        Object.assign(d, { status: AI_DRAFT_STATUS.DISMISSED, reviewedBy: user.id, reviewedAt: now() });
    });
  },

  /* ----- read API for other modules (kitchen-stock) and the Principal (#88–#89) ----- */
  async getPublishedWeeklyMenu(_campusId, date, user) {
    await delay(80);
    requireCatalogReader(user);
    const db = seeded();
    // Menus are planned once for the whole school (entity Menu), so every campus gets the same menu.
    return clone(db.weeklyMenus.filter((w) => w.status === WEEKLY_STATUS.PUBLISHED && w.weekStart === mondayOf(date)));
  },

  async getPublishedDailyMenu(campusId, date, user) {
    await delay(80);
    requireCatalogReader(user);
    const db = seeded();
    const dishById = byId(db.dishes);
    const foodById = byId(db.foods);
    const weeks = db.weeklyMenus.filter((w) => w.status === WEEKLY_STATUS.PUBLISHED && w.weekStart === mondayOf(date));
    return {
      date,
      campusId: campusId || null,
      ageGroups: weeks
        .map((w) => {
          const day = w.days.find((d) => d.date === date);
          if (!day) return null;
          return {
            ageGroupId: w.ageGroupId,
            weeklyMenuId: w.id,
            weeklyMenuCode: w.code,
            version: w.version,
            publishedAt: w.publishedAt,
            holiday: !!day.holiday,
            menuId: day.menuId,
            portionFactor: portionFactorOf(w.ageGroupId),
            meals: day.holiday ? [] : resolveMeals(day.meals, w.ageGroupId, dishById, foodById),
            allergyMenus: day.holiday
              ? []
              : db.allergyMenus
                  .filter((a) => a.baseMenuId === day.menuId && a.status === RECORD_STATUS.ACTIVE)
                  .map((a) => ({
                    id: a.id,
                    code: a.code,
                    name: a.name,
                    restrictions: a.restrictions,
                    meals: resolveMeals(applyReplacements(day.meals, a.replacements), w.ageGroupId, dishById, foodById),
                  })),
          };
        })
        .filter(Boolean),
    };
  },

  async listMenuPlans(filters = {}, user) {
    await delay();
    requireUser(user);
    if (!canViewMenuPlan(user)) fail(403, MSG.denied);
    const db = seeded();
    return clone(
      db.weeklyMenus
        .filter((w) => w.status === WEEKLY_STATUS.PUBLISHED)
        .filter(
          (w) =>
            (!filters.ageGroupId || w.ageGroupId === filters.ageGroupId) &&
            (!filters.month || w.weekStart.slice(0, 7) === filters.month || addDays(w.weekStart, 4).slice(0, 7) === filters.month),
        )
        .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
    );
  },
};
