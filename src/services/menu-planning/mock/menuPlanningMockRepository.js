import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { buildSeedMenuPlanning } from '@/mocks/menuPlanningSeed';
import { buildSeedSchoolConfig } from '@/mocks/schoolConfigSeed';
import { uid } from '@/utils/id';
import { normalizeText, todayInput } from '@/utils/format';
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
  mondayOf,
  portionFactorOf,
  sessionsOf,
  weekDates,
  weekLabel,
} from '@/models/menu-planning/menuPlanningConstants';
import {
  allergyContext,
  applyReplacements,
  byId,
  dishAllergens,
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
  validateWeeklyMenu,
  hasErrors,
} from '@/utils/menu-planning/menuPlanningValidation';
import { canReadPublishedMenu, canViewMenuPlan } from '@/utils/menu-planning/menuPlanningPermissions';

/*
 * Fake backend of menu planning (UC 6.1, 6.3–6.9, 6.11; GBR-GEN-10, GBR-MENU-01..05, GBR-AI-01/04).
 * Only the Vice Principal with the shared school-service assignment changes data; the Principal
 * and kitchens read published menus. The Spring Boot API must enforce the same rules.
 */

const COLLECTIONS = ['foods', 'dishes', 'mealPrices', 'menus', 'allergyMenus', 'weeklyMenus', 'menuAiDrafts'];
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

/* ---------------- AI suggestion (rule-based fallback generator) ---------------- */

/** Weekly arrangement: rotate active sample menus, avoiding main dishes repeated within 7 days. */
const suggestWeek = (db, { ageGroupId, weekStart }) => {
  const menus = db.menus.filter((m) => m.ageGroupId === ageGroupId && m.status === RECORD_STATUS.ACTIVE);
  if (!menus.length) fail(422, 'Chưa có thực đơn mẫu đang sử dụng cho nhóm tuổi này. Hãy tạo thực đơn mẫu trước khi yêu cầu gợi ý.');
  const dishById = byId(db.dishes);
  const prev = db.weeklyMenus.find(
    (w) => w.ageGroupId === ageGroupId && w.weekStart === addDays(weekStart, -7) && w.status === WEEKLY_STATUS.PUBLISHED,
  );
  const history = (prev?.days || []).filter((d) => !d.holiday);
  const offset = Number(weekStart.replace(/\D/g, '')) % menus.length;
  const used = {};
  const days = weekDates(weekStart).map((date) => {
    const ranked = menus
      .map((m, i) => {
        const trial = [...history, { date, holiday: false, meals: m.meals }];
        const repeats = repeatedMainDishes(trial, dishById).filter((r) => r.dates.includes(date)).length;
        return { m, score: repeats * 10 + (used[m.id] || 0) * 3 + ((i - offset + menus.length) % menus.length) / 100 };
      })
      .sort((a, b) => a.score - b.score);
    const pick = ranked[0].m;
    used[pick.id] = (used[pick.id] || 0) + 1;
    const day = { date, holiday: false, note: '', menuId: pick.id, meals: clone(pick.meals) };
    history.push(day);
    return day;
  });
  return { days, sourceMenuIds: [...new Set(days.map((d) => d.menuId))] };
};

/** Daily combination: one dish per course from active dishes, then the rice / porridge portion is tuned to the energy reference. */
const suggestDay = (db, { ageGroupId, avoidAllergens }) => {
  const foodById = byId(db.foods);
  const restrictions = avoidAllergens ? allergyContext(db.classes, db.children, ageGroupId).map((r) => r.allergen) : [];
  const ok = (d) =>
    d.status === RECORD_STATUS.ACTIVE && !dishAllergens(d, foodById).some((a) => restrictions.some((r) => sameAllergen(r, a)));
  const pool = (type) => db.dishes.filter((d) => d.type === type && ok(d));
  const seedNo = db.menuAiDrafts.length + db.menus.length;
  const pickFrom = (list, skip = []) => {
    const avail = list.filter((d) => !skip.includes(d.id));
    return avail.length ? avail[seedNo % avail.length] : null;
  };
  const nursery = ageGroupId === 'ag-2';
  const carbs = pool(DISH_TYPE.CARB).filter((d) => (nursery ? /cháo/i.test(d.name) : !/cháo/i.test(d.name)));
  const carb = pickFrom(carbs.length ? carbs : pool(DISH_TYPE.CARB));
  const main = pickFrom(pool(DISH_TYPE.MAIN));
  const soup = pickFrom(pool(DISH_TYPE.SOUP));
  const dessert = pickFrom(pool(DISH_TYPE.DESSERT));
  const snack = pickFrom(pool(DISH_TYPE.SNACK));
  const dessert2 = pickFrom(pool(DISH_TYPE.DESSERT), [dessert?.id]);
  if (!carb || !main || !snack) fail(422, 'Không đủ món phù hợp (cơm/cháo, món mặn, món bữa chiều) sau khi loại các thành phần cần tránh.');
  const item = (d) => (d ? [{ dishId: d.id, portion: 1 }] : []);
  let meals = normalizeMeals(
    [
      { session: 'MORNING', items: item(dessert2 || dessert) },
      { session: 'LUNCH', items: [...item(carb), ...(nursery ? [] : item(main)), ...item(soup), ...item(dessert)] },
      { session: 'AFTERNOON', items: [...item(snack), ...item(dessert2)] },
    ],
    sessionsOf(ageGroupId),
  );
  // Small optimiser: scale the carb portion so the day energy is nearest the middle of the reference.
  const [lo, hi] = NUTRITION_NORMS[ageGroupId]?.kcal || [0, 0];
  const target = (lo + hi) / 2;
  const dishById = byId(db.dishes);
  let best = { meals, gap: Infinity };
  for (let p = 0.8; p <= 1.41; p += 0.1) {
    const portion = Math.round(p * 10) / 10;
    const trial = meals.map((m) => ({ ...m, items: m.items.map((i) => (i.dishId === carb.id ? { ...i, portion } : i)) }));
    const gap = Math.abs(mealsTotals(trial, dishById, foodById, ageGroupId).totals.kcal - target);
    if (gap < best.gap) best = { meals: trial, gap };
  }
  meals = best.meals;
  return { meals, restrictions, sourceDishIds: [...new Set(meals.flatMap((m) => m.items.map((i) => i.dishId)))] };
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
      meals: normalizeMeals(keep, sessionsOf(form.ageGroupId)),
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
    if (u.role === ROLES.PRINCIPAL) pushNotification(db, { userId: u.id, type: 'MENU', title, message, link: `/menu/plans/${wm.id}` });
    // GBR-MENU-05: both kitchens work from the current published menu.
    if (u.role === ROLES.KITCHEN_STAFF) pushNotification(db, { userId: u.id, type: 'MENU', title, message });
    if ([ROLES.TEACHER, ROLES.TEAM_LEADER].includes(u.role) && classTeachers.has(u.id))
      pushNotification(db, { userId: u.id, type: 'MENU', title, message });
  });
};

const visibleWeekly = (user, wm) => user.role === ROLES.VICE_PRINCIPAL || wm.status === WEEKLY_STATUS.PUBLISHED;

/** Day of a published menu resolved for the kitchen: dish details and quantity per child. */
const resolveMeals = (meals, ageGroupId, dishById, foodById) => {
  const factor = portionFactorOf(ageGroupId);
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
          quantityPerChild: Math.round(ing.quantity * i.portion * factor * 10) / 10,
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
        ingredients: (payload.ingredients || []).map((r) => ({ foodId: r.foodId, quantity: Number(r.quantity) })),
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
        meals: ageGroupId ? normalizeMeals(payload.meals, sessionsOf(ageGroupId)) : [],
        note: String(payload.note || '').trim(),
        status: payload.status === RECORD_STATUS.INACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE,
      };
      const errors = validateMenu({ ...data, id }, db.menus);
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
      const normalized = normalizeMeals(meals, sessionsOf(wm.ageGroupId));
      const errors = validateMenu({ name: 'x', ageGroupId: wm.ageGroupId, meals: normalized }, []);
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
      if (kind === AI_DRAFT_KIND.WEEKLY) {
        if (!params.weekStart) fail(422, 'Chọn tuần cần gợi ý.', { weekStart: 'Trường này là bắt buộc.' });
        result = suggestWeek(db, { ageGroupId, weekStart: mondayOf(params.weekStart) });
      } else {
        result = suggestDay(db, { ageGroupId, avoidAllergens: params.avoidAllergens !== false });
      }
      const draft = {
        id: uid('ai'),
        kind,
        ageGroupId,
        weekStart: kind === AI_DRAFT_KIND.WEEKLY ? mondayOf(params.weekStart) : null,
        ...result,
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
