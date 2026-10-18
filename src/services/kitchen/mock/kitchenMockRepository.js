import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import {
  seedFoods,
  seedDishes,
  seedMenusForDate,
  seedMealCount,
  buildOpeningStock,
  buildSeedReceipts,
  isSchoolDay,
} from '@/mocks/kitchenSeed';
import { buildSeedMenuPlanning, topUpRecentWeeklyMenus } from '@/mocks/menuPlanningSeed';
import { computeMarket, countedSession, purchaseStep } from '@/services/kitchen/mock/marketList';
import { buildWeeklyForecast, knownOrderOf, sentSnapshot, storageOf } from '@/services/kitchen/mock/weeklyForecast';
import { addDays as addIsoDays, mondayOf, schoolWeekStart } from '@/models/menu-planning/menuPlanningConstants';
import { todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import { ROLES } from '@/models/User';
import {
  ISSUE_STATUS,
  MEAL_SESSIONS,
  MENU_TYPE,
  FRESH_RECEIPT_STATUS,
  FRESH_RESULT,
  NOTE_MAX,
  PORTION_FACTOR_BY_AGE_GROUP,
  STOCK_COUNT_STATUS,
} from '@/models/kitchen/kitchenConstants';
import {
  canAccessCampus,
  isVicePrincipal,
  canManageStock,
  canViewDryStock,
  canWriteStock,
  isKitchenStaff,
  canEditFoodSample,
  canViewStockIssue,
  canViewKitchenDay,
  canEditForecast,
  canViewForecast,
  canViewMealCount,
  canViewFreshReceipt,
  canViewPublishedMenu,
} from '@/utils/kitchen/kitchenPermissions';
import {
  validateFoodSample,
  validateForecastCells,
  validateFreshReceipt,
  validateStockCount,
  validateStockReceipt,
} from '@/utils/kitchen/kitchenValidation';

/*
 * Fake backend of the kitchen module (BF-09). Spring Boot must re-implement these rules:
 * GBR-MEAL-01..05 (quantities from the confirmed meal count + published menu, per age group, substitutes apart,
 * rounded up), UC 6.23–6.25 (stock in / approved issue / kitchen reconciliation). Meal preparation status and
 * meal handover are not tracked (user decision 16/10/2026). Cross-module reads (food catalog, menus, meal counts, classes) are isolated in the
 * "sources" section so they can be aligned with menu-planning and attendance.
 */

const MSG_FORBIDDEN = 'Bạn không có quyền thực hiện thao tác này.';
const forbid = () => {
  throw new ApiError(403, MSG_FORBIDDEN);
};
const guard = (allowed) => {
  if (!allowed) forbid();
};
const guardCampus = (user, campusId) => {
  if (!campusId || !canAccessCampus(user, campusId)) forbid();
};
const invalid = (errors) => {
  if (Object.keys(errors).length) throw new ApiError(422, 'Thông tin chưa hợp lệ. Kiểm tra các ô được đánh dấu.', errors);
};

const r3 = (n) => Math.round(n * 1000) / 1000;
// GBR-MEAL-05: round up to the purchasing step; the inner rounding removes float noise (0.30000000000000004).
const roundUp = (qty, step) => (step > 0 ? r3(Math.ceil(Math.round((qty / step) * 1e6) / 1e6) * step) : r3(qty));
const ymd = (date) => date.replace(/-/g, '');
const nowIso = () => new Date().toISOString();

const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const prevSchoolDays = (date, n) => {
  const days = [];
  for (let d = addDays(date, -1); days.length < n; d = addDays(d, -1)) if (isSchoolDay(d)) days.unshift(d);
  return days;
};
const weekDates = (date) => {
  const dow = new Date(`${date}T00:00:00`).getDay() || 7;
  const monday = addDays(date, 1 - dow);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
};

/* ------------------------------------------------------------------ */
/* Sources owned by other modules – read defensively, align later.     */
/* ------------------------------------------------------------------ */

const usesMenuPlanningCatalog = (db) => Array.isArray(db.foods) && db.foods.length > 0 && Array.isArray(db.dishes) && db.dishes.length > 0;

const normalizeFood = (f) => ({
  id: f.id,
  name: f.name || f.foodName || f.ingredientName || f.id,
  unit: f.purchaseUnit || f.unit || 'kg',
  roundStep: Number(f.roundStep ?? f.purchaseStep ?? f.roundingStep) || 0.1,
  storage: f.storage,
  group: f.group,
});

const normalizeDish = (d) => ({
  id: d.id,
  name: d.name || d.dishName || d.id,
  allergens: d.allergens || [],
  ingredients: (d.ingredients || d.items || [])
    .map((i) => ({
      foodId: i.foodId || i.ingredientId || i.id,
      qtyPerPortion: Number(i.qtyPerPortion ?? i.quantityPerPortion ?? i.quantity ?? 0),
    }))
    .filter((i) => i.foodId),
});

/** Food catalog and dishes: menu-planning's db.foods / db.dishes when present, else the kitchen seed. */
const getCatalog = (db) => {
  const external = usesMenuPlanningCatalog(db);
  const foods = external ? db.foods.map(normalizeFood) : seedFoods;
  const dishes = external ? db.dishes.map(normalizeDish) : seedDishes;
  return {
    external,
    foods,
    dishes,
    foodById: Object.fromEntries(foods.map((f) => [f.id, f])),
    dishById: Object.fromEntries(dishes.map((d) => [d.id, d])),
  };
};

const SESSION_ALIASES = { LUNCH: 'LUNCH', TRUA: 'LUNCH', AFTERNOON: 'AFTERNOON', SNACK: 'AFTERNOON', CHIEU: 'AFTERNOON' };
const asSession = (v) => SESSION_ALIASES[String(v || '').toUpperCase()] || null;
const dishIdsOf = (node) =>
  (node.dishIds || (Array.isArray(node.dishes) ? node.dishes.map((d) => (typeof d === 'string' ? d : d.dishId || d.id)) : [])).filter(
    Boolean,
  );

/*
 * Published menus of menu-planning (db.weeklyMenus, shape unknown when written): walks every PUBLISHED weekly menu
 * and collects nodes that carry a date (own or inherited), a meal session and dish ids. GBR-MEAL-01: drafts are ignored.
 */
const menusFromDays = (db, w, date) => {
  const day = w.days.find((d) => d.date === date && !d.holiday);
  if (!day) return [];
  const replacements = (db.allergyMenus || []).filter((a) => a.baseMenuId === day.menuId).flatMap((a) => a.replacements || []);
  const merged = {};
  (day.meals || []).forEach((meal) => {
    // Bữa phụ sáng, bữa thêm gộp vào bữa có số suất chốt (theo "Tính suất theo" ở Thiết lập)
    const session = countedSession(db.nutritionSetups, w.ageGroupId, meal.session);
    const ids = (meal.items || []).map((i) => i.dishId).filter(Boolean);
    const subIds = ids.flatMap((id) => {
      const rep = replacements.find((x) => x.session === meal.session && x.originalDishId === id);
      return rep ? (rep.replacementDishId ? [rep.replacementDishId] : []) : [id];
    });
    [[MENU_TYPE.NORMAL, ids], ...(replacements.length ? [[MENU_TYPE.ALLERGY, subIds]] : [])].forEach(([type, list]) => {
      const key = `${session}|${type}`;
      merged[key] ||= {
        id: `${w.id}_${date}_${session}_${type}`,
        date,
        session,
        ageGroupId: w.ageGroupId,
        type,
        dishIds: [],
        note: day.note || '',
      };
      merged[key].dishIds.push(...list);
    });
  });
  return Object.values(merged).filter((m) => m.dishIds.length);
};

const menusFromWeeklyMenus = (db, date) => {
  const out = [];
  const visit = (node, ctx) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((n) => visit(n, ctx));
      return;
    }
    const here = {
      date: node.date || node.menuDate || ctx.date,
      session: asSession(node.session || node.mealSession) || ctx.session,
      ageGroupId: node.ageGroupId || ctx.ageGroupId,
    };
    const ids = dishIdsOf(node);
    if (ids.length && here.date === date && here.session) {
      out.push({
        id: node.id || `wm_${date}_${here.session}_${out.length}`,
        date,
        session: here.session,
        ageGroupId: here.ageGroupId || null,
        type: String(node.type || node.menuType || '').toUpperCase() === MENU_TYPE.ALLERGY ? MENU_TYPE.ALLERGY : MENU_TYPE.NORMAL,
        dishIds: ids,
        note: node.note || node.instructions || '',
      });
      return;
    }
    Object.values(node).forEach((v) => visit(v, here));
  };
  (db.weeklyMenus || [])
    .filter((w) => String(w?.status || '').toUpperCase() === 'PUBLISHED')
    .forEach((w) => {
      if (Array.isArray(w.days) && w.days.some((d) => Array.isArray(d.meals))) out.push(...menusFromDays(db, w, date));
      else visit(w, {});
    });
  return out;
};

const getPublishedMenus = (db, date) => {
  if (usesMenuPlanningCatalog(db)) {
    const list = menusFromWeeklyMenus(db, date);
    if (list.length) return list;
  }
  return seedMenusForDate(date);
};

const menuFor = (menus, session, ageGroupId, type) =>
  menus.find((m) => m.session === session && m.type === type && m.ageGroupId === ageGroupId) ||
  menus.find((m) => m.session === session && m.type === type && !m.ageGroupId) ||
  null;

const normalizeMealCount = (mc) => ({
  id: mc.id,
  campusId: mc.campusId,
  date: mc.date,
  session: mc.session,
  status: mc.status,
  confirmedAt: mc.confirmedAt || null,
  confirmedBy: mc.confirmedBy || null,
  classes: (mc.classes || []).map((r) => ({
    classId: r.classId,
    className: r.className || '',
    normal: Number(r.normal ?? r.normalServings ?? 0),
    substitute: Number(r.substitute ?? r.substituteServings ?? 0),
  })),
  adjustments: mc.adjustments || [],
});

/** Meal count of the attendance module (db.mealCounts); the kitchen seed stands in while that collection does not exist. */
const getMealCount = (db, campusId, date, session) => {
  if (Array.isArray(db.mealCounts)) {
    const mc = db.mealCounts.find((m) => m.campusId === campusId && m.date === date && m.session === session);
    return mc ? normalizeMealCount(mc) : null;
  }
  if (date > todayInput()) return null;
  const mc = seedMealCount({ campusId, date, session, classes: db.classes || [], children: db.children || [] });
  return mc && normalizeMealCount(mc);
};

const classesOf = (db) => Object.fromEntries((db.classes || []).map((c) => [c.id, c]));
const usersWithRole = (db, role, campusId) => (db.users || []).filter((u) => u.role === role && u.campusId === campusId);
const campusCode = (db, campusId) => (db.campuses || []).find((c) => c.id === campusId)?.code || campusId.toUpperCase();

/* ------------------------------------------------------------------ */
/* Quantity calculation (GBR-MEAL-01, 02, 03, 05)                      */
/* ------------------------------------------------------------------ */

const computeSession = (db, cat, campusId, date, session) => {
  const menus = getPublishedMenus(db, date).filter((m) => m.session === session);
  const mealCount = getMealCount(db, campusId, date, session);
  const result = {
    session,
    hasMenu: menus.length > 0,
    mealCountStatus: mealCount?.status || 'NONE',
    confirmedAt: mealCount?.confirmedAt || null,
    adjustments: mealCount?.adjustments || [],
    classes: [],
    dishes: [],
    foods: [],
    totals: { normal: 0, substitute: 0 },
    warnings: [],
  };
  if (!result.hasMenu || mealCount?.status !== 'CONFIRMED') {
    result.classes = (mealCount?.classes || []).map((r) => ({ ...r, affectedDishes: [] }));
    return result;
  }
  const classById = classesOf(db);
  const foodTotals = {};
  const dishTotals = {};
  const add = (dishIds, servings, kind, factor) => {
    if (!servings) return;
    dishIds.forEach((dishId) => {
      const dish = cat.dishById[dishId];
      if (!dish) return;
      dishTotals[dishId] ||= { dishId, name: dish.name, normal: 0, substitute: 0 };
      dishTotals[dishId][kind] += servings;
      dish.ingredients.forEach(({ foodId, qtyPerPortion }) => {
        foodTotals[foodId] ||= { normal: 0, substitute: 0 };
        foodTotals[foodId][kind] += servings * qtyPerPortion * factor;
      });
    });
  };
  mealCount.classes.forEach((row) => {
    const ageGroupId = classById[row.classId]?.ageGroupId || null;
    const className = row.className || classById[row.classId]?.name || row.classId;
    const factor = PORTION_FACTOR_BY_AGE_GROUP[ageGroupId] ?? 1;
    const normalMenu = menuFor(menus, session, ageGroupId, MENU_TYPE.NORMAL);
    if (!normalMenu) {
      result.warnings.push(`${className}: chưa có thực đơn đã công bố cho nhóm tuổi của lớp.`);
      return;
    }
    const allergyMenu = menuFor(menus, session, ageGroupId, MENU_TYPE.ALLERGY);
    if (row.substitute > 0 && !allergyMenu) result.warnings.push(`${className}: có suất thay thế nhưng chưa có thực đơn dị ứng.`);
    const subMenu = allergyMenu || normalMenu;
    add(normalMenu.dishIds, row.normal, 'normal', factor);
    add(subMenu.dishIds, row.substitute, 'substitute', factor);
    result.classes.push({
      ...row,
      className,
      ageGroupId,
      // GBR-MEAL-03: dishes replaced for the substitute servings of this class.
      affectedDishes:
        row.substitute > 0
          ? normalMenu.dishIds.filter((id) => !subMenu.dishIds.includes(id)).map((id) => cat.dishById[id]?.name || id)
          : [],
    });
    result.totals.normal += row.normal;
    result.totals.substitute += row.substitute;
  });
  result.dishes = Object.values(dishTotals);
  result.foods = Object.entries(foodTotals).map(([foodId, t]) => {
    const food = cat.foodById[foodId] || { id: foodId, name: foodId, unit: '', roundStep: 0 };
    return {
      foodId,
      name: food.name,
      unit: food.unit,
      raw: t.normal + t.substitute,
      normalQty: r3(t.normal),
      substituteQty: r3(t.substitute),
      requiredQty: roundUp(t.normal + t.substitute, food.roundStep),
    };
  });
  return result;
};

/** Every session of a day plus the day total used by the stock issue slip. */
const marketOf = (db, campusId, date) =>
  computeMarket(db, {
    date,
    counts: Object.fromEntries(MEAL_SESSIONS.map((s) => [s, getMealCount(db, campusId, date, s)])),
    classById: classesOf(db),
  });

const computeDay = (db, cat, campusId, date) => {
  const sessions = MEAL_SESSIONS.map((s) => computeSession(db, cat, campusId, date, s));
  const withMenu = sessions.filter((s) => s.hasMenu);
  if (cat.external) {
    const market = marketOf(db, campusId, date);
    return {
      sessions,
      hasMenu: withMenu.length > 0,
      allConfirmed: withMenu.length > 0 && withMenu.every((s) => s.mealCountStatus === 'CONFIRMED'),
      foods: market.foods
        .filter((f) => f.buyUnits > 0)
        .map((f) => ({ foodId: f.foodId, name: f.name, unit: f.purchaseUnit, requiredQty: f.buyUnits })),
      market,
    };
  }
  const merged = {};
  withMenu.forEach((s) =>
    s.foods.forEach((f) => {
      merged[f.foodId] ||= { ...f, raw: 0, normalQty: 0, substituteQty: 0 };
      merged[f.foodId].raw += f.raw;
      merged[f.foodId].normalQty = r3(merged[f.foodId].normalQty + f.normalQty);
      merged[f.foodId].substituteQty = r3(merged[f.foodId].substituteQty + f.substituteQty);
    }),
  );
  const foods = Object.values(merged).map((f) => ({ ...f, requiredQty: roundUp(f.raw, cat.foodById[f.foodId]?.roundStep || 0) }));
  return {
    sessions,
    hasMenu: withMenu.length > 0,
    allConfirmed: withMenu.length > 0 && withMenu.every((s) => s.mealCountStatus === 'CONFIRMED'),
    foods,
  };
};

const stockQty = (db, campusId, foodId) => db.foodStock.find((s) => s.campusId === campusId && s.foodId === foodId)?.quantity || 0;

const changeStock = (db, { campusId, foodId, delta, type, date, refId, userId, expiryDate, at }) => {
  let line = db.foodStock.find((s) => s.campusId === campusId && s.foodId === foodId);
  if (!line) {
    line = { campusId, foodId, quantity: 0 };
    db.foodStock.push(line);
  }
  line.quantity = r3(line.quantity + delta);
  // Inventory Transaction entity: every movement is its own record.
  db.stockTransactions.unshift({
    id: uid('kst'),
    campusId,
    foodId,
    type,
    quantity: Math.abs(delta),
    date,
    expiryDate: expiryDate || null,
    refId,
    userId,
    at: at || nowIso(),
  });
};

/* ------------------------------------------------------------------ */
/* Dự trù tuần (S1)                                                    */
/* ------------------------------------------------------------------ */

const forecastRecord = (db, campusId, weekStart) =>
  (db.weeklyForecasts || []).find((w) => w.campusId === campusId && w.weekStart === weekStart) || null;

const weekView = (db, campusId, weekStart, { today = todayInput(), ignoreMealCounts = false } = {}) =>
  buildWeeklyForecast(db, {
    campusId,
    weekStart,
    record: forecastRecord(db, campusId, weekStart),
    ctx: {
      today,
      isSchoolDay,
      mealCountOf: (date, session) => (ignoreMealCounts ? null : getMealCount(db, campusId, date, session)),
      stockOf: (foodId) => stockQty(db, campusId, foodId),
    },
  });

/** Dữ liệu mẫu: tuần này đã gửi NCC chiều thứ Sáu tuần trước, theo số đăng ký ăn lúc đó (chưa có số chốt, chưa ai nghỉ). */
const seedWeeklyForecasts = (db, campusIds, vpByCampus) => {
  const weekStart = schoolWeekStart(todayInput());
  const friday = addIsoDays(weekStart, -3);
  const asOfFriday = { ...db, attendance: [] };
  return campusIds
    .map((campusId) => {
      const view = weekView(asOfFriday, campusId, weekStart, { today: friday, ignoreMealCounts: true });
      if (view.status !== 'READY') return null;
      return {
        id: `kwf_${campusId}_${ymd(weekStart)}`,
        campusId,
        weekStart,
        cells: {},
        ...sentSnapshot(view),
        sentAt: new Date(`${friday}T15:20:00+07:00`).toISOString(),
        sentBy: vpByCampus[campusId] || null,
        notices: [],
      };
    })
    .filter(Boolean);
};

/* ------------------------------------------------------------------ */
/* Lazy seeding                                                        */
/* ------------------------------------------------------------------ */

const COLLECTIONS = [
  'foodStock',
  'stockReceipts',
  'stockTransactions',
  'stockIssues',
  'freshReceipts',
  'foodSamples',
  'weeklyForecasts',
  'stockCounts',
];
const KITCHEN_DEMO_SEED_VERSION = 1;

const seedHistory = (db, cat, campusIds) => {
  const yesterday = prevSchoolDays(todayInput(), 1)[0];
  const c1 = campusIds[0];
  if (!c1) return;
  const day = computeDay(db, cat, c1, yesterday);
  const vp = usersWithRole(db, ROLES.VICE_PRINCIPAL, c1)[0]?.id || null;
  const cook = usersWithRole(db, ROLES.KITCHEN_STAFF, c1)[0]?.id || null;
  const at = (time) => new Date(`${yesterday}T${time}:00+07:00`).toISOString();
  // Hôm qua: bếp đã kiểm nhận hàng tươi, một dòng giao thiếu đã báo NCC, PHT đã xác nhận
  const ordered = orderedFreshOf(db, c1, yesterday);
  if (ordered.length && !db.freshReceipts.some((r) => r.campusId === c1 && r.date === yesterday)) {
    db.freshReceipts.push({
      id: `kfr_${c1}_${ymd(yesterday)}`,
      campusId: c1,
      date: yesterday,
      status: FRESH_RECEIPT_STATUS.CONFIRMED,
      deliveryNote: `PGH-${ymd(yesterday).slice(4)}-01`,
      supplierName: 'Công ty thực phẩm sạch mẫu',
      deliveredAt: '06:35',
      lines: ordered.map((f, i) => {
        const short = i === ordered.length - 1;
        const received = short ? r3(Math.max(0, f.ordered - (purchaseStep(f.unit) === 1 ? 1 : 0.2))) : f.ordered;
        return {
          foodId: f.foodId,
          ordered: f.ordered,
          delivered: received,
          received,
          result: short ? FRESH_RESULT.SHORT : FRESH_RESULT.OK,
          reason: short ? 'NCC giao thiếu so với phiếu' : '',
          supplierNotifiedAt: short ? at('07:05') : null,
          supplierNotifiedBy: short ? vp : null,
        };
      }),
      submittedBy: cook,
      submittedAt: at('06:52'),
      confirmedBy: vp,
      confirmedAt: at('07:20'),
      history: [
        { action: 'SUBMITTED', userId: cook, at: at('06:52') },
        { action: 'CONFIRMED', userId: vp, at: at('07:20'), note: '' },
      ],
    });
  }
  // Hôm qua: bếp đã lưu mẫu từng bữa theo món (Mẫu 5), chưa ghi hủy
  day.sessions
    .filter((ss) => ss.hasMenu)
    .forEach((ss, i) => {
      const dishes = sessionDishes(db, cat, yesterday, ss.session);
      if (!dishes.length || db.foodSamples.some((s) => s.campusId === c1 && s.date === yesterday && s.session === ss.session)) return;
      db.foodSamples.push({
        campusId: c1,
        date: yesterday,
        session: ss.session,
        takenAt: at(i === 0 ? '10:35' : '14:35'),
        takenBy: cook,
        dishes: dishes.map((d) => ({
          dishId: d.dishId,
          weight: '100 g',
          container: 'Hộp thủy tinh có nắp',
          temperature: '2–8 °C',
          note: '',
        })),
        savedAt: at(i === 0 ? '10:40' : '14:40'),
        destroyedAt: null,
        destroyedBy: null,
      });
    });
  if (!db.stockIssues.some((issue) => issue.campusId === c1 && issue.date === yesterday)) issueDry(db, c1, yesterday);
};

const MENU_COLLECTIONS = ['foods', 'dishes', 'mealPrices', 'nutritionSetups', 'menus', 'allergyMenus', 'weeklyMenus', 'menuAiDrafts'];
const hasAll = (db) => [...MENU_COLLECTIONS, ...COLLECTIONS].every((k) => Array.isArray(db[k]));

const seedReceiptTransactions = (db) => {
  db.stockReceipts.forEach((receipt) =>
    receipt.items.forEach((item) => {
      if (db.stockTransactions.some((t) => t.type === 'IN' && t.refId === receipt.id && t.foodId === item.foodId)) return;
      db.stockTransactions.push({
        id: `kst_seed_${receipt.id}_${item.foodId}`,
        campusId: receipt.campusId,
        foodId: item.foodId,
        type: 'IN',
        quantity: item.acceptedQty,
        date: receipt.date,
        expiryDate: item.expiryDate || null,
        refId: receipt.id,
        userId: receipt.createdBy,
        at: receipt.createdAt,
      });
    }),
  );
};

const seedStockCountHistory = (db, cat, campusIds, vpByCampus) => {
  const previousMonthEnd = new Date(`${todayInput()}T00:00:00`);
  previousMonthEnd.setDate(0);
  const date = `${previousMonthEnd.getFullYear()}-${String(previousMonthEnd.getMonth() + 1).padStart(2, '0')}-${String(previousMonthEnd.getDate()).padStart(2, '0')}`;
  const at = new Date(`${date}T16:00:00+07:00`).toISOString();
  campusIds.forEach((campusId, index) => {
    if (db.stockCounts.some((count) => count.campusId === campusId)) return;
    const userId = vpByCampus[campusId] || null;
    db.stockCounts.push({
      id: `ksc_seed_${campusId}_${ymd(date)}`,
      code: `KK-${ymd(date).slice(0, 6)}-${campusCode(db, campusId)}-${index + 1}`,
      campusId,
      status: STOCK_COUNT_STATUS.FINALIZED,
      createdBy: userId,
      createdAt: at,
      finalizedBy: userId,
      finalizedAt: at,
      lines: cat.foods
        .filter((food) => isDryFood(db, food.id))
        .map((food) => {
          const systemQty = stockQty(db, campusId, food.id);
          return { foodId: food.id, systemQty, countedQty: systemQty, reason: '' };
        }),
    });
  });
};

// Version hóa seed để bổ sung lịch sử cho DB cũ chỉ có collection rỗng, không ghi đè dữ liệu đã có.
const migrateKitchenDemoSeed = (db) => {
  if ((db.kitchenDemoSeedVersion || 0) >= KITCHEN_DEMO_SEED_VERSION) return db;
  const cat = getCatalog(db);
  const campusIds = (db.campuses || []).map((campus) => campus.id);
  const vpByCampus = Object.fromEntries(campusIds.map((id) => [id, usersWithRole(db, ROLES.VICE_PRINCIPAL, id)[0]?.id]));
  if (!db.foodStock.length) db.foodStock = buildOpeningStock(campusIds, cat.foods);
  if (!db.stockReceipts.length)
    db.stockReceipts = buildSeedReceipts({
      campusIds,
      vpByCampus,
      dates: prevSchoolDays(todayInput(), 3).slice(0, 2),
      foods: (db.foods || []).filter((food) => storageOf(food) === 'DRY'),
    });
  if (!db.weeklyForecasts.length) db.weeklyForecasts = seedWeeklyForecasts(db, campusIds, vpByCampus);
  seedReceiptTransactions(db);
  if (!db.stockCounts.length) seedStockCountHistory(db, cat, campusIds, vpByCampus);
  if (!db.stockIssues.length || !db.freshReceipts.length || !db.foodSamples.length) seedHistory(db, cat, campusIds);
  db.kitchenDemoSeedVersion = KITCHEN_DEMO_SEED_VERSION;
  return db;
};

// Databases created before this module existed have no kitchen collections yet.
const ensureSeeded = (db) => {
  if (hasAll(db)) return db;
  // Danh mục và thực đơn thuộc module thực đơn; bếp chạy trước thì dựng sẵn dữ liệu mẫu của module đó
  if (MENU_COLLECTIONS.some((k) => !Array.isArray(db[k]))) {
    const seed = buildSeedMenuPlanning();
    MENU_COLLECTIONS.forEach((k) => {
      if (!Array.isArray(db[k])) db[k] = clone(seed[k]);
    });
  }
  if (COLLECTIONS.every((k) => Array.isArray(db[k]))) return db;
  const cat = getCatalog(db);
  const campusIds = (db.campuses || []).map((c) => c.id);
  const vpByCampus = Object.fromEntries(campusIds.map((id) => [id, usersWithRole(db, ROLES.VICE_PRINCIPAL, id)[0]?.id]));
  const fresh = !Array.isArray(db.stockIssues);
  if (!Array.isArray(db.foodStock)) db.foodStock = buildOpeningStock(campusIds, cat.foods);
  if (!Array.isArray(db.stockReceipts))
    db.stockReceipts = buildSeedReceipts({
      campusIds,
      vpByCampus,
      dates: prevSchoolDays(todayInput(), 3).slice(0, 2),
      foods: (db.foods || []).filter((f) => storageOf(f) === 'DRY'),
    });
  if (!Array.isArray(db.stockTransactions)) db.stockTransactions = [];
  if (!Array.isArray(db.stockIssues)) db.stockIssues = [];
  if (!Array.isArray(db.freshReceipts)) db.freshReceipts = [];
  if (!Array.isArray(db.stockCounts)) db.stockCounts = [];
  if (!Array.isArray(db.foodSamples)) db.foodSamples = [];
  if (!Array.isArray(db.weeklyForecasts)) db.weeklyForecasts = seedWeeklyForecasts(db, campusIds, vpByCampus);
  if (fresh) seedHistory(db, cat, campusIds);
  return db;
};

/** Read access: seeds once (write), then returns the snapshot. */
const readSeeded = () => {
  const db = readDb();
  if (!hasAll(db)) writeDb(ensureSeeded);
  if ((readDb().kitchenDemoSeedVersion || 0) < KITCHEN_DEMO_SEED_VERSION) writeDb(migrateKitchenDemoSeed);
  if (topUpRecentWeeklyMenus(clone(readDb()), todayInput())) writeDb((d) => topUpRecentWeeklyMenus(d, todayInput()));
  if (issueKeysToSync(readDb()).length) writeDb(syncIssues);
  return readDb();
};

/* ------------------------------------------------------------------ */
/* Stock issue view model                                              */
/* ------------------------------------------------------------------ */

const dayConfirmed = (db, campusId, date) =>
  isSchoolDay(date) && MEAL_SESSIONS.every((s) => getMealCount(db, campusId, date, s)?.status === 'CONFIRMED');

/** Đồ khô cần cho một ngày theo số suất đã chốt × định lượng (S8). */
const dryNeedOf = (db, campusId, date) => {
  const cat = getCatalog(db);
  const foodById = cat.foodById;
  return marketOf(db, campusId, date)
    .foods.filter((f) => f.buyUnits > 0 && storageOf(foodById[f.foodId]) === 'DRY')
    .map((f) => ({ foodId: f.foodId, requiredQty: f.buyUnits }));
};

/*
 * Xuất kho đồ khô tự động khi ngày đã chốt suất cả ngày (khảo sát 18/10/2026, S8): không duyệt, không bước "Đã nhận".
 * Tồn không đủ ⇒ chỉ trừ phần có, dòng ghi thiếu. Số chốt đổi sau đó (GV hủy suất) ⇒ xuất thêm hoặc hoàn phần chênh.
 */
const issueDry = (db, campusId, date) => {
  let issue = db.stockIssues.find((i) => i.campusId === campusId && i.date === date);
  // Phiếu duyệt tay lập trước khảo sát giữ nguyên
  if (issue && issue.status !== ISSUE_STATUS.ISSUED) return;
  const need = dryNeedOf(db, campusId, date);
  const confirmedAt =
    MEAL_SESSIONS.map((s) => getMealCount(db, campusId, date, s)?.confirmedAt)
      .filter(Boolean)
      .sort()
      .pop() || nowIso();
  const created = !issue;
  if (created) {
    issue = {
      id: uid('ksi'),
      code: `PX-${ymd(date)}-${campusCode(db, campusId)}`,
      campusId,
      date,
      status: ISSUE_STATUS.ISSUED,
      issuedAt: confirmedAt,
      items: [],
      history: [],
    };
    db.stockIssues.unshift(issue);
  }
  let changed = false;
  const ids = new Set([...need.map((n) => n.foodId), ...issue.items.map((it) => it.foodId)]);
  ids.forEach((foodId) => {
    const requiredQty = need.find((n) => n.foodId === foodId)?.requiredQty || 0;
    let item = issue.items.find((it) => it.foodId === foodId);
    if (!item) {
      item = { foodId, requiredQty: 0, issuedQty: 0, shortage: 0 };
      issue.items.push(item);
    }
    const delta = r3(requiredQty - item.requiredQty);
    if (!delta) return;
    changed = true;
    if (delta > 0) {
      const take = r3(Math.min(delta, Math.max(0, stockQty(db, campusId, foodId))));
      if (take > 0)
        changeStock(db, {
          campusId,
          foodId,
          delta: -take,
          type: 'OUT',
          date,
          refId: issue.id,
          userId: null,
          at: created ? confirmedAt : null,
        });
      item.issuedQty = r3(item.issuedQty + take);
    } else {
      const back = r3(Math.min(-delta, item.issuedQty));
      if (back > 0) changeStock(db, { campusId, foodId, delta: back, type: 'RETURN', date, refId: issue.id, userId: null });
      item.issuedQty = r3(item.issuedQty - back);
    }
    item.requiredQty = requiredQty;
    item.shortage = r3(Math.max(0, item.requiredQty - item.issuedQty));
  });
  issue.items = issue.items.filter((it) => it.requiredQty > 0 || it.issuedQty > 0);
  if (created) issue.history.push({ action: 'ISSUED', userId: null, at: confirmedAt });
  else if (changed) issue.history.push({ action: 'ADJUSTED', userId: null, at: nowIso() });
};

const sameNeed = (db, issue) => {
  const need = dryNeedOf(db, issue.campusId, issue.date);
  return (
    need.every((n) => issue.items.find((it) => it.foodId === n.foodId)?.requiredQty === n.requiredQty) &&
    issue.items.every((it) => !(it.requiredQty > 0) || need.some((n) => n.foodId === it.foodId))
  );
};

/** Ngày đã chốt chưa có phiếu xuất; hôm nay kiểm lại vì GV còn hủy suất được sau chốt. */
const issueKeysToSync = (db) => {
  if (!Array.isArray(db.mealCounts) || !Array.isArray(db.stockIssues)) return [];
  const today = todayInput();
  const keys = new Set();
  db.mealCounts.forEach((m) => {
    if (m.status !== 'CONFIRMED' || keys.has(`${m.campusId}|${m.date}`)) return;
    const issue = db.stockIssues.find((i) => i.campusId === m.campusId && i.date === m.date);
    if (issue && (m.date !== today || issue.status !== ISSUE_STATUS.ISSUED || sameNeed(db, issue))) return;
    if (dayConfirmed(db, m.campusId, m.date)) keys.add(`${m.campusId}|${m.date}`);
  });
  return [...keys];
};

const syncIssues = (db) => {
  issueKeysToSync(db).forEach((k) => {
    const [campusId, date] = k.split('|');
    issueDry(db, campusId, date);
  });
  return db;
};

const issueStateOf = (db, cat, campusId, date) => {
  const issue = db.stockIssues.find((i) => i.campusId === campusId && i.date === date) || null;
  if (issue) return { state: ISSUE_STATUS.ISSUED, issue };
  const day = computeDay(db, cat, campusId, date);
  return { state: !day.hasMenu ? 'NO_MENU' : 'WAITING_MEAL_COUNT', issue: null };
};

const issueView = (db, cat, issue) => ({
  id: issue.id,
  code: issue.code,
  campusId: issue.campusId,
  date: issue.date,
  issuedAt: issue.issuedAt || issue.approvedAt || null,
  history: issue.history || [],
  items: issue.items.map((it) => ({
    foodId: it.foodId,
    name: cat.foodById[it.foodId]?.name || it.foodId,
    unit: cat.foodById[it.foodId]?.unit || '',
    requiredQty: it.requiredQty,
    issuedQty: it.issuedQty ?? it.requiredQty,
    shortage: it.shortage ?? 0,
  })),
});

const userName = (db, id) => (db.users || []).find((u) => u.id === id)?.fullName || null;

/* ------------------------------------------------------------------ */
/* Kiểm nhận hàng tươi (S5–S6)                                         */
/* ------------------------------------------------------------------ */

/** Số NCC đang giao của ngày (phiếu tuần + các lần đã báo NCC). */
const orderedFreshOf = (db, campusId, date) => {
  const weekStart = mondayOf(date);
  return knownOrderOf(weekView(db, campusId, weekStart), forecastRecord(db, campusId, weekStart), date);
};

const freshView = (db, campusId, date, user) => {
  const cat = getCatalog(db);
  const stored = db.freshReceipts.find((r) => r.campusId === campusId && r.date === date) || null;
  const base = stored
    ? stored.lines.map((l) => ({ ...l, name: cat.foodById[l.foodId]?.name || l.foodId, unit: cat.foodById[l.foodId]?.unit || '' }))
    : orderedFreshOf(db, campusId, date).map((f) => ({
        foodId: f.foodId,
        name: f.name,
        unit: f.unit,
        ordered: f.ordered,
        delivered: f.ordered,
        received: f.ordered,
        result: FRESH_RESULT.OK,
        reason: '',
        supplierNotifiedAt: null,
      }));
  const status = stored?.status || 'NEW';
  const lines = base.map((l) => ({ ...l, supplierNotifiedByName: userName(db, l.supplierNotifiedBy) }));
  const editable = status === 'NEW' || status === FRESH_RECEIPT_STATUS.DRAFT;
  return {
    campusId,
    date,
    status,
    deliveryNote: stored?.deliveryNote || '',
    supplierName: stored?.supplierName || '',
    deliveredAt: stored?.deliveredAt || '',
    returnNote: stored?.returnNote || '',
    submittedAt: stored?.submittedAt || null,
    submittedByName: userName(db, stored?.submittedBy),
    confirmedAt: stored?.confirmedAt || null,
    confirmedByName: userName(db, stored?.confirmedBy),
    history: stored?.history || [],
    lines,
    counts: Object.fromEntries(Object.values(FRESH_RESULT).map((r) => [r, lines.filter((l) => l.result === r).length])),
    canEdit: editable && isKitchenStaff(user) && canAccessCampus(user, campusId),
    canReview: status === FRESH_RECEIPT_STATUS.SUBMITTED && isVicePrincipal(user) && canAccessCampus(user, campusId),
    canMarkNotified:
      !!stored &&
      status !== FRESH_RECEIPT_STATUS.CONFIRMED &&
      (isKitchenStaff(user) || isVicePrincipal(user)) &&
      canAccessCampus(user, campusId),
  };
};

/* ------------------------------------------------------------------ */
/* Sổ lưu mẫu (S10, QĐ 1246/QĐ-BYT Mẫu 4, Mẫu 5)                       */
/* ------------------------------------------------------------------ */

const SAMPLE_KEEP_MS = 24 * 60 * 60 * 1000;
const isoAt = (date, hhmm) => new Date(`${date}T${hhmm}:00+07:00`).toISOString();
// Bản ghi kiểu cũ (ô tick "Đã lưu mẫu") không có món, giờ lấy là giờ tick
const takenAtOf = (s) => s.takenAt || s.checkedAt || null;

/** Món của bữa theo thực đơn đã công bố (gộp các nhóm tuổi, bỏ trùng). */
const sessionDishes = (db, cat, date, session) => {
  const ids = [
    ...new Set(
      getPublishedMenus(db, date)
        .filter((m) => m.session === session && m.type === MENU_TYPE.NORMAL)
        .flatMap((m) => m.dishIds),
    ),
  ];
  return ids.map((id) => ({ dishId: id, name: cat.dishById[id]?.name || id }));
};

const sampleMealView = (db, cat, campusId, date, session) => {
  const stored = db.foodSamples.find((x) => x.campusId === campusId && x.date === date && x.session === session) || null;
  const menuDishes = sessionDishes(db, cat, date, session);
  const count = getMealCount(db, campusId, date, session);
  const takenAt = stored ? takenAtOf(stored) : null;
  const saved = (stored?.dishes || []).map((d) => ({ ...d, name: cat.dishById[d.dishId]?.name || d.name || d.dishId }));
  const dishes = saved.length ? saved : menuDishes.map((d) => ({ ...d, weight: '', container: '', temperature: '', note: '' }));
  return {
    session,
    servings: count?.status === 'CONFIRMED' ? count.classes.reduce((n, r) => n + r.normal + r.substitute, 0) : null,
    status: !takenAt ? 'TODO' : stored.destroyedAt ? 'DESTROYED' : 'SAVED',
    takenAt,
    takenByName: userName(db, stored?.takenBy || stored?.checkedBy),
    destroyDueAt: takenAt ? new Date(new Date(takenAt).getTime() + SAMPLE_KEEP_MS).toISOString() : null,
    destroyedAt: stored?.destroyedAt || null,
    destroyedByName: userName(db, stored?.destroyedBy),
    dishes,
  };
};

/** Mẫu đã đủ 24 giờ mà chưa ghi hủy, mọi ngày của cơ sở. */
const pendingDestroyOf = (db, campusId) => {
  const now = Date.now();
  return db.foodSamples
    .filter((s) => s.campusId === campusId && takenAtOf(s) && !s.destroyedAt && new Date(takenAtOf(s)).getTime() + SAMPLE_KEEP_MS <= now)
    .sort((a, b) => takenAtOf(a).localeCompare(takenAtOf(b)))
    .map((s) => ({
      date: s.date,
      session: s.session,
      takenAt: takenAtOf(s),
      dueAt: new Date(new Date(takenAtOf(s)).getTime() + SAMPLE_KEEP_MS).toISOString(),
      dishCount: (s.dishes || []).length,
    }));
};

/* ------------------------------------------------------------------ */
/* Kho khô xem chung hai cơ sở, lô, kiểm kê (S4, S7)                   */
/* ------------------------------------------------------------------ */

const EXPIRY_WARN_DAYS = 14;
const LOW_DAYS = 3;
const rawFood = (db, foodId) => (db.foods || []).find((f) => f.id === foodId);
const isDryFood = (db, foodId) => storageOf(rawFood(db, foodId)) === 'DRY';
const campusName = (db, campusId) => (db.campuses || []).find((c) => c.id === campusId)?.shortName || campusCode(db, campusId);

/** "Đủ … ngày" = tồn ÷ lượng xuất trung bình mỗi ngày học trong 7 ngày gần nhất; chưa có xuất ⇒ null. */
const daysLeftOf = (db, campusId, foodId, qty) => {
  const today = todayInput();
  const from = addIsoDays(today, -7);
  let schoolDays = 0;
  for (let d = addIsoDays(from, 1); d <= today; d = addIsoDays(d, 1)) if (isSchoolDay(d)) schoolDays += 1;
  const out = db.stockTransactions
    .filter((t) => t.campusId === campusId && t.foodId === foodId && t.date > from && t.date <= today)
    .reduce((n, t) => n + (t.type === 'OUT' ? t.quantity : t.type === 'RETURN' ? -t.quantity : 0), 0);
  if (!(out > 0) || !schoolDays) return null;
  return Math.floor(qty / (out / schoolDays));
};

/** Lô còn trong kho: tồn hiện có phân về các lần nhập gần nhất (xuất lô cũ trước); phần dư là tồn đầu kỳ không rõ lô. */
const lotsOf = (db, campusId, foodId) => {
  let remaining = stockQty(db, campusId, foodId);
  const lots = [];
  db.stockReceipts
    .filter((r) => r.campusId === campusId)
    .sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')))
    .forEach((r) =>
      r.items
        .filter((it) => it.foodId === foodId && it.acceptedQty > 0)
        .forEach((it) => {
          if (remaining <= 0) return;
          const qty = r3(Math.min(remaining, it.acceptedQty));
          remaining = r3(remaining - qty);
          lots.push({
            lotNo: it.lotNo || null,
            expiryDate: it.expiryDate || null,
            unitPrice: it.unitPrice ?? null,
            supplierName: r.supplierName || '',
            receivedDate: r.date,
            receiptCode: r.code,
            qty,
          });
        }),
    );
  if (remaining > 0)
    lots.push({ lotNo: null, expiryDate: null, unitPrice: null, supplierName: '', receivedDate: null, receiptCode: null, qty: remaining });
  return lots.reverse();
};

const stockCellOf = (db, campusId, foodId) => {
  const qty = stockQty(db, campusId, foodId);
  const lots = lotsOf(db, campusId, foodId);
  const nearestExpiry =
    lots
      .map((l) => l.expiryDate)
      .filter(Boolean)
      .sort()[0] || null;
  const daysLeft = daysLeftOf(db, campusId, foodId, qty);
  const expiring = !!nearestExpiry && nearestExpiry <= addIsoDays(todayInput(), EXPIRY_WARN_DAYS);
  const status = qty <= 0 ? 'OUT' : daysLeft != null && daysLeft < LOW_DAYS ? 'LOW' : 'OK';
  return { qty, daysLeft, nearestExpiry, expiring, status };
};

const TX_LABEL = { IN: 'Nhập kho', OUT: 'Xuất tự động', RETURN: 'Hoàn kho', ADJUST: 'Kiểm kê' };

/** Giao dịch gần đây gộp theo chứng từ (phiếu nhập, phiếu xuất, phiếu kiểm kê). */
const transactionGroups = (db, cat, { campusIds, foodId = null, limit = 10 }) => {
  const groups = new Map();
  db.stockTransactions
    .filter((t) => campusIds.includes(t.campusId) && (!foodId || t.foodId === foodId) && isDryFood(db, t.foodId))
    .forEach((t) => {
      const key = `${t.type}|${t.refId}|${t.campusId}`;
      if (!groups.has(key)) groups.set(key, { type: t.type, refId: t.refId, campusId: t.campusId, at: t.at, date: t.date, lines: [] });
      groups.get(key).lines.push(t);
    });
  return [...groups.values()]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((g) => {
      const receipt = g.type === 'IN' ? db.stockReceipts.find((r) => r.id === g.refId) : null;
      const issue = g.type === 'OUT' || g.type === 'RETURN' ? db.stockIssues.find((i) => i.id === g.refId) : null;
      const count = g.type === 'ADJUST' ? (db.stockCounts || []).find((c) => c.id === g.refId) : null;
      const code = receipt?.code || issue?.code || count?.code || '';
      const amount = receipt
        ? receipt.items.reduce((n, it) => n + (typeof it.unitPrice === 'number' ? it.unitPrice * it.acceptedQty : 0), 0)
        : 0;
      const single = foodId ? g.lines.reduce((n, l) => n + (g.type === 'IN' || g.type === 'RETURN' ? l.quantity : -l.quantity), 0) : null;
      return {
        type: g.type,
        label: `${TX_LABEL[g.type] || g.type} · ${campusName(db, g.campusId)}`,
        campusId: g.campusId,
        at: g.at,
        code,
        supplierName: receipt?.supplierName || '',
        items: g.lines.length,
        amount: amount || null,
        quantity: single,
        unit: foodId ? cat.foodById[foodId]?.unit || '' : '',
      };
    });
};

const countView = (db, cat, count) => ({
  id: count.id,
  code: count.code,
  campusId: count.campusId,
  status: count.status,
  createdAt: count.createdAt,
  createdByName: userName(db, count.createdBy),
  finalizedAt: count.finalizedAt || null,
  finalizedByName: userName(db, count.finalizedBy),
  lines: count.lines.map((l) => {
    // Phiếu nháp so với tồn hiện tại (kho vẫn xuất mỗi ngày); phiếu đã chốt giữ số lúc chốt
    const systemQty = count.status === STOCK_COUNT_STATUS.DRAFT ? stockQty(db, count.campusId, l.foodId) : l.systemQty;
    return {
      foodId: l.foodId,
      name: cat.foodById[l.foodId]?.name || l.foodId,
      unit: cat.foodById[l.foodId]?.unit || '',
      systemQty,
      countedQty: l.countedQty,
      diff: l.countedQty == null ? null : r3(l.countedQty - systemQty),
      reason: l.reason || '',
    };
  }),
});

/* ------------------------------------------------------------------ */
/* Repository                                                          */
/* ------------------------------------------------------------------ */

export const kitchenMockRepository = {
  /* ---- Quy trình bếp hôm nay: gộp số liệu các bước của một cơ sở và ngày ---- */
  async getKitchenDay({ campusId, date }, user) {
    await delay();
    guard(canViewKitchenDay(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    const day = computeDay(db, cat, campusId, date);
    const withMenu = day.sessions.filter((ss) => ss.hasMenu);
    const issue = issueStateOf(db, cat, campusId, date);
    // NUT-03: số suất chỉ hiện khi PHT đã chốt
    const sessions = withMenu.map((ss) => {
      const confirmed = ss.mealCountStatus === 'CONFIRMED';
      return {
        session: ss.session,
        status: ss.mealCountStatus,
        confirmedAt: confirmed ? ss.confirmedAt : null,
        total: confirmed ? ss.totals.normal + ss.totals.substitute : null,
      };
    });
    const market = day.market || marketOf(db, campusId, date);
    const toBuy = (market.foods || []).filter((f) => f.buyUnits > 0);
    return clone({
      campusId,
      date,
      mealCount: {
        sessions,
        confirmed: sessions.filter((ss) => ss.status === 'CONFIRMED').length,
        total: sessions.reduce((n, ss) => n + (ss.total || 0), 0),
      },
      market: { fresh: toBuy.filter((f) => f.storage !== 'DRY').length, dry: toBuy.filter((f) => f.storage === 'DRY').length },
      issue: {
        state: issue.state,
        code: issue.issue?.code || null,
        shortage: (issue.issue?.items || []).filter((it) => (it.shortage ?? 0) > 0).length,
      },
      fresh: (() => {
        const r = freshView(db, campusId, date, user);
        return { status: r.status, lines: r.lines.length, odd: r.lines.length - r.counts.OK, submittedAt: r.submittedAt };
      })(),
      // Dự trù: dòng chưa báo NCC của tuần, số suất ngày học kế tiếp so với phiếu tuần
      forecast: (() => {
        const week = weekView(db, campusId, mondayOf(date));
        let next = addIsoDays(date, 1);
        while (!isSchoolDay(next)) next = addIsoDays(next, 1);
        const nextWeek = mondayOf(next) === mondayOf(date) ? week : weekView(db, campusId, mondayOf(next));
        const nd = nextWeek.days.find((d) => d.date === next);
        return {
          pendingChanges: week.pendingChanges + (nextWeek === week ? 0 : nextWeek.pendingChanges),
          nextDate: nd?.hasMenu ? next : null,
          nextTotal: nd?.hasMenu ? nd.total : null,
          nextSentTotal: nd?.hasMenu ? nd.sentTotal : null,
        };
      })(),
      // Tồn kho chỉ PHT xem (UC 6.23)
      stock: canManageStock(user)
        ? { outOfStock: cat.foods.filter((f) => isDryFood(db, f.id) && stockQty(db, campusId, f.id) <= 0).length }
        : null,
      samples: {
        meals: MEAL_SESSIONS.map((s) => sampleMealView(db, cat, campusId, date, s))
          .filter((m) => m.dishes.length || m.takenAt)
          .map((m) => ({ session: m.session, status: m.status, takenAt: m.takenAt })),
        pendingDestroy: pendingDestroyOf(db, campusId).length,
      },
    });
  },

  /* ---- Sổ lưu mẫu: bếp ghi lưu mẫu từng bữa theo món, ghi hủy khi đủ 24 giờ; không chặn bước nào (S10) ---- */
  async getFoodSampleLog({ campusId, date }, user) {
    await delay();
    guard(canViewKitchenDay(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    const meals = MEAL_SESSIONS.map((s) => sampleMealView(db, cat, campusId, date, s)).filter((m) => m.dishes.length || m.takenAt);
    return clone({ campusId, date, meals, pendingDestroy: pendingDestroyOf(db, campusId), canEdit: canEditFoodSample(user, campusId) });
  },

  /** Ghi (hoặc sửa) lưu mẫu một bữa: giờ lấy và từng món (khối lượng, dụng cụ, nhiệt độ, ghi chú). */
  async saveFoodSample({ campusId, date, session, takenAt, dishes }, user) {
    await delay();
    guard(canEditFoodSample(user, campusId));
    invalid(validateFoodSample({ date, session, takenAt, dishes }, todayInput()));
    return writeDb((db) => {
      ensureSeeded(db);
      const cat = getCatalog(db);
      const menuIds = new Set(sessionDishes(db, cat, date, session).map((d) => d.dishId));
      if (!menuIds.size) throw new ApiError(409, 'Bữa này không có thực đơn đã công bố.');
      if (dishes.some((d) => !menuIds.has(d.dishId))) throw new ApiError(422, 'Món không thuộc thực đơn của bữa.');
      const index = db.foodSamples.findIndex((x) => x.campusId === campusId && x.date === date && x.session === session);
      const previous = index >= 0 ? db.foodSamples[index] : null;
      if (previous?.destroyedAt) throw new ApiError(409, 'Mẫu bữa này đã ghi hủy, không sửa được.');
      const sample = {
        campusId,
        date,
        session,
        takenAt: isoAt(date, takenAt),
        takenBy: previous?.takenBy || user.id,
        dishes: dishes.map((d) => ({
          dishId: d.dishId,
          weight: String(d.weight).trim(),
          container: String(d.container || '').trim(),
          temperature: String(d.temperature || '').trim(),
          note: String(d.note || '').trim(),
        })),
        savedAt: nowIso(),
        destroyedAt: null,
        destroyedBy: null,
      };
      if (previous) db.foodSamples[index] = sample;
      else db.foodSamples.push(sample);
      return clone(sampleMealView(db, cat, campusId, date, session));
    });
  },

  /** Ghi hủy mẫu: chỉ khi đã lưu đủ 24 giờ. */
  async destroyFoodSample({ campusId, date, session }, user) {
    await delay();
    guard(canEditFoodSample(user, campusId));
    return writeDb((db) => {
      ensureSeeded(db);
      const sample = db.foodSamples.find((x) => x.campusId === campusId && x.date === date && x.session === session);
      if (!sample || !takenAtOf(sample)) throw new ApiError(404, 'Bữa này chưa lưu mẫu.');
      if (sample.destroyedAt) throw new ApiError(409, 'Mẫu đã ghi hủy.');
      if (new Date(takenAtOf(sample)).getTime() + SAMPLE_KEEP_MS > Date.now())
        throw new ApiError(409, 'Mẫu phải lưu đủ 24 giờ mới được hủy.');
      sample.destroyedAt = nowIso();
      sample.destroyedBy = user.id;
      return clone(sampleMealView(db, getCatalog(db), campusId, date, session));
    });
  },

  async getFoodCatalog(user) {
    await delay();
    guard(canManageStock(user) || canViewForecast(user));
    const db = readSeeded();
    return clone(getCatalog(db).foods.map((f) => ({ ...f, storage: storageOf(rawFood(db, f.id)) })));
  },

  /* ---- Phiếu nhập kho khô (UC 6.23, S7): lô, hạn dùng, giá, NCC; lưu xong không sửa (sai thì chỉnh qua kiểm kê) ---- */
  async createStockReceipt(payload, user) {
    await delay();
    const campusId = payload.campusId || user.campusId;
    guard(canWriteStock(user, campusId));
    invalid(validateStockReceipt(payload, todayInput()));
    return writeDb((db) => {
      ensureSeeded(db);
      const cat = getCatalog(db);
      payload.items.forEach((it) => {
        if (!cat.foodById[it.foodId]) throw new ApiError(422, 'Thực phẩm không có trong danh mục thực phẩm.');
        if (!isDryFood(db, it.foodId)) throw new ApiError(422, 'Kho chỉ nhập đồ khô; hàng tươi kiểm nhận ở bếp.');
      });
      const seq = db.stockReceipts.filter((r) => r.campusId === campusId && r.date === payload.date).length + 1;
      const receipt = {
        id: uid('ksr'),
        code: `PN-${ymd(payload.date)}-${campusCode(db, campusId)}-${seq}`,
        campusId,
        date: payload.date,
        note: String(payload.note || '').trim(),
        supplierName: String(payload.supplierName || '').trim(),
        items: payload.items.map((it) => {
          const receivedQty = r3(Number(it.receivedQty));
          const rejectedQty = r3(Number(it.rejectedQty || 0));
          return {
            foodId: it.foodId,
            receivedQty,
            rejectedQty,
            acceptedQty: r3(receivedQty - rejectedQty),
            expiryDate: it.expiryDate || '',
            lotNo: String(it.lotNo || '').trim(),
            unitPrice: Number(it.unitPrice),
            note: String(it.note || '').trim(),
          };
        }),
        createdBy: user.id,
        createdAt: nowIso(),
      };
      // Rejected quantities are kept on the receipt but never enter the stock.
      receipt.items.forEach((it) => {
        if (it.acceptedQty > 0)
          changeStock(db, {
            campusId,
            foodId: it.foodId,
            delta: it.acceptedQty,
            type: 'IN',
            date: receipt.date,
            refId: receipt.id,
            userId: user.id,
            expiryDate: it.expiryDate,
          });
      });
      db.stockReceipts.unshift(receipt);
      return clone(receipt);
    });
  },

  /* ---- Kho khô: tồn tách theo cơ sở, xem chung một màn (S4) ---- */
  async getDryStock(user) {
    await delay();
    guard(canViewDryStock(user));
    const db = readSeeded();
    const cat = getCatalog(db);
    const campuses = (db.campuses || []).map((c) => ({ id: c.id, name: c.shortName || c.name, canWrite: canWriteStock(user, c.id) }));
    const ids = campuses.map((c) => c.id);
    const rank = (f) => {
      const cells = Object.values(f.byCampus);
      if (cells.some((c) => c.status === 'OUT')) return 0;
      if (cells.some((c) => c.status === 'LOW')) return 1;
      if (cells.some((c) => c.expiring)) return 2;
      return 3;
    };
    const foods = cat.foods
      .filter((f) => isDryFood(db, f.id))
      .map((f) => {
        const byCampus = Object.fromEntries(ids.map((id) => [id, stockCellOf(db, id, f.id)]));
        const nearestExpiry =
          Object.values(byCampus)
            .map((c) => c.nearestExpiry)
            .filter(Boolean)
            .sort()[0] || null;
        return { foodId: f.id, name: f.name, unit: f.unit, byCampus, nearestExpiry };
      })
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'vi'))
      .map((f) => ({ ...f, urgency: rank(f) }));
    const countBy = (pred) => Object.fromEntries(ids.map((id) => [id, foods.filter((f) => pred(f.byCampus[id])).length]));
    const lastIssue = db.stockIssues
      .filter((i) => i.status === ISSUE_STATUS.ISSUED && ids.includes(i.campusId))
      .sort((a, b) => (b.issuedAt || '').localeCompare(a.issuedAt || ''))[0];
    return clone({
      campuses,
      foods,
      kpis: {
        out: countBy((c) => c.status === 'OUT'),
        low: countBy((c) => c.status === 'LOW'),
        expiring: foods.filter((f) => Object.values(f.byCampus).some((c) => c.expiring)).map((f) => f.name),
        lastIssue: lastIssue ? { at: lastIssue.issuedAt, campusId: lastIssue.campusId, code: lastIssue.code } : null,
      },
      transactions: transactionGroups(db, cat, { campusIds: ids }),
    });
  },

  /** Một thực phẩm khô: lô còn trong kho từng cơ sở (lô, hạn, giá, NCC) và giao dịch của nó. */
  async getDryStockItem({ foodId }, user) {
    await delay();
    guard(canViewDryStock(user));
    const db = readSeeded();
    const cat = getCatalog(db);
    if (!cat.foodById[foodId] || !isDryFood(db, foodId)) throw new ApiError(404, 'Không tìm thấy thực phẩm khô này.');
    const ids = (db.campuses || []).map((c) => c.id);
    return clone({
      foodId,
      name: cat.foodById[foodId].name,
      unit: cat.foodById[foodId].unit,
      campuses: ids.map((id) => ({
        id,
        name: campusName(db, id),
        canWrite: canWriteStock(user, id),
        ...stockCellOf(db, id, foodId),
        lots: lotsOf(db, id, foodId),
      })),
      transactions: transactionGroups(db, cat, { campusIds: ids, foodId }),
    });
  },

  /* ---- Kiểm kê kho khô theo tháng: số đếm, lệch phải có lý do, chốt thì tồn = số đếm ---- */
  async getStockCounts({ campusId }, user) {
    await delay();
    guard(canViewDryStock(user));
    const db = readSeeded();
    const cat = getCatalog(db);
    return clone({
      counts: db.stockCounts
        .filter((c) => c.campusId === campusId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((c) => countView(db, cat, c)),
      canWrite: canWriteStock(user, campusId),
    });
  },

  async createStockCount({ campusId }, user) {
    await delay();
    guard(canWriteStock(user, campusId));
    return writeDb((db) => {
      ensureSeeded(db);
      if (db.stockCounts.some((c) => c.campusId === campusId && c.status === STOCK_COUNT_STATUS.DRAFT))
        throw new ApiError(409, 'Cơ sở này đang có phiếu kiểm kê nháp. Hoàn tất phiếu đó trước.');
      const cat = getCatalog(db);
      const date = todayInput();
      const seq = db.stockCounts.filter((c) => c.campusId === campusId && c.createdAt.startsWith(date.slice(0, 7))).length + 1;
      const count = {
        id: uid('kkc'),
        code: `KK-${ymd(date).slice(0, 6)}-${campusCode(db, campusId)}-${seq}`,
        campusId,
        status: STOCK_COUNT_STATUS.DRAFT,
        createdBy: user.id,
        createdAt: nowIso(),
        lines: cat.foods.filter((f) => isDryFood(db, f.id)).map((f) => ({ foodId: f.id, systemQty: null, countedQty: null, reason: '' })),
      };
      db.stockCounts.unshift(count);
      return clone(countView(db, cat, count));
    });
  },

  /** Lưu số đếm (nháp) hoặc chốt (`finalize`): lệch khác 0 phải có lý do; chốt sinh giao dịch ADJUST và khóa phiếu. */
  async saveStockCount({ id, lines, finalize = false }, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      const count = db.stockCounts.find((c) => c.id === id);
      if (!count) throw new ApiError(404, 'Không tìm thấy phiếu kiểm kê.');
      guard(canWriteStock(user, count.campusId));
      if (count.status !== STOCK_COUNT_STATUS.DRAFT) throw new ApiError(409, 'Phiếu kiểm kê đã chốt, không sửa được.');
      const byFood = Object.fromEntries((lines || []).map((l) => [l.foodId, l]));
      count.lines.forEach((l) => {
        const input = byFood[l.foodId];
        if (!input) return;
        l.countedQty = input.countedQty === '' || input.countedQty == null ? null : r3(Number(input.countedQty));
        l.reason = input.reason || '';
      });
      const withSystem = count.lines.map((l) => ({ ...l, systemQty: stockQty(db, count.campusId, l.foodId) }));
      invalid(validateStockCount(withSystem, { finalize }));
      if (finalize) {
        const at = nowIso();
        withSystem.forEach((l) => {
          const delta = r3(l.countedQty - l.systemQty);
          if (delta)
            changeStock(db, {
              campusId: count.campusId,
              foodId: l.foodId,
              delta,
              type: 'ADJUST',
              date: todayInput(),
              refId: count.id,
              userId: user.id,
            });
        });
        count.lines = withSystem;
        Object.assign(count, { status: STOCK_COUNT_STATUS.FINALIZED, finalizedBy: user.id, finalizedAt: at });
      }
      return clone(countView(db, getCatalog(db), count));
    });
  },

  /* ---- Phiếu xuất kho đồ khô: tự sinh khi chốt suất, chỉ xem và in (S8) ---- */
  async getStockIssues({ campusId, from, to }, user) {
    await delay();
    guard(canViewStockIssue(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    const today = todayInput();
    const end = to || today;
    const start = from || addIsoDays(end, -30);
    const issues = db.stockIssues
      .filter((i) => i.campusId === campusId && i.date >= start && i.date <= end)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((i) => issueView(db, cat, i));
    // Hôm nay chưa chốt: hiện dòng chờ để người xem biết vì sao chưa có phiếu
    const todayState = end >= today && !issues.some((i) => i.date === today) ? issueStateOf(db, cat, campusId, today).state : null;
    return clone({ issues, today: todayState && todayState !== ISSUE_STATUS.ISSUED ? { date: today, state: todayState } : null });
  },

  /* ---- #93 Published Menu (UC 6.20) ---- */
  async getPublishedMenu({ date, view }, user) {
    await delay();
    guard(canViewPublishedMenu(user));
    const db = readSeeded();
    const cat = getCatalog(db);
    const dates = view === 'week' ? weekDates(date) : [date];
    return clone(
      dates.map((d) => {
        const menus = getPublishedMenus(db, d);
        return {
          date: d,
          sessions: MEAL_SESSIONS.map((session) => ({
            session,
            menus: menus
              .filter((m) => m.session === session)
              .map((m) => ({
                id: m.id,
                ageGroupId: m.ageGroupId,
                type: m.type,
                note: m.note,
                dishes: m.dishIds.map((id) => {
                  const dish = cat.dishById[id];
                  return {
                    id,
                    name: dish?.name || id,
                    allergens: dish?.allergens || [],
                    ingredients: (dish?.ingredients || []).map((i) => ({
                      ...i,
                      name: cat.foodById[i.foodId]?.name || i.foodId,
                      unit: cat.foodById[i.foodId]?.unit || '',
                    })),
                  };
                }),
              })),
          })),
        };
      }),
    );
  },

  /* ---- #94 Confirmed Meal Count (UC 6.16) ---- */
  async getConfirmedMealCount({ campusId, date }, user) {
    await delay();
    guard(canViewMealCount(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    return clone(
      MEAL_SESSIONS.map((s) => {
        const r = computeSession(db, cat, campusId, date, s);
        // Read only for the kitchen (footnote ⁵): figures appear only once the VP has confirmed them.
        const confirmed = r.mealCountStatus === 'CONFIRMED';
        return {
          session: s,
          hasMenu: r.hasMenu,
          status: r.mealCountStatus,
          confirmedAt: r.confirmedAt,
          classes: confirmed ? r.classes : [],
          totals: confirmed
            ? r.classes.reduce((t, c) => ({ normal: t.normal + c.normal, substitute: t.substitute + c.substitute }), {
                normal: 0,
                substitute: 0,
              })
            : null,
          adjustments: confirmed ? r.adjustments : [],
          warnings: r.warnings,
        };
      }),
    );
  },

  /* ---- Dự trù & đi chợ theo tuần (S1) ---- */
  async getWeeklyForecast({ campusId, weekStart }, user) {
    await delay();
    guard(canViewForecast(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const record = forecastRecord(db, campusId, weekStart);
    return clone({
      ...weekView(db, campusId, weekStart),
      sent: record?.sentAt ? { at: record.sentAt, by: record.sentBy, byName: userName(db, record.sentBy) } : null,
      savedAt: record?.savedAt || null,
      canEdit: canEditForecast(user, campusId),
    });
  },

  /** PHT sửa suất dự kiến của ngày chưa chốt; ngày đã chốt hoặc đã qua giữ nguyên. */
  async saveWeeklyForecast({ campusId, weekStart, cells }, user) {
    await delay();
    guard(canEditForecast(user, campusId));
    invalid(validateForecastCells(cells));
    return writeDb((db) => {
      ensureSeeded(db);
      const view = weekView(db, campusId, weekStart);
      const errors = {};
      const changes = [];
      Object.entries(cells).forEach(([classId, byDate]) => {
        const cls = view.classes.find((c) => c.classId === classId);
        if (!cls) throw new ApiError(422, 'Lớp không thuộc cơ sở này.');
        Object.entries(byDate).forEach(([date, raw]) => {
          const day = view.days.find((d) => d.date === date);
          const cell = cls.cells.find((c) => c.date === date);
          if (!day || !cell) throw new ApiError(422, 'Ngày không thuộc tuần này.');
          const value = Number(raw);
          if (!day.editable) {
            if (value !== cell.value) throw new ApiError(409, 'Ngày đã chốt suất hoặc đã qua, không sửa dự trù được. Tải lại trang.');
            return;
          }
          if (value > cls.registered) errors[`${classId}|${date}`] = `Tối đa ${cls.registered} (số trẻ đăng ký ăn).`;
          else changes.push([classId, date, value, cell.suggested]);
        });
      });
      invalid(errors);
      let record = forecastRecord(db, campusId, weekStart);
      if (!record) {
        record = { id: uid('kwf'), campusId, weekStart, cells: {}, sentAt: null, sentBy: null, notices: [] };
        db.weeklyForecasts.push(record);
      }
      changes.forEach(([classId, date, value, suggested]) => {
        record.cells[classId] ||= {};
        // Bằng gợi ý thì bỏ ô đã sửa để lần sau gợi ý mới (nghỉ báo thêm) vẫn áp vào
        if (value === suggested) delete record.cells[classId][date];
        else record.cells[classId][date] = value;
      });
      record.savedAt = nowIso();
      record.savedBy = user.id;
      return clone(weekView(db, campusId, weekStart));
    });
  },

  /** PHT đã gửi phiếu đặt hàng tuần cho NCC (ngoài hệ thống); lưu bản gửi để so các thay đổi sau đó. */
  async markWeeklyOrderSent({ campusId, weekStart }, user) {
    await delay();
    guard(canEditForecast(user, campusId));
    return writeDb((db) => {
      ensureSeeded(db);
      const view = weekView(db, campusId, weekStart);
      if (view.status !== 'READY') throw new ApiError(409, 'Tuần này chưa có thực đơn tuần đã công bố.');
      let record = forecastRecord(db, campusId, weekStart);
      if (record?.sentAt) throw new ApiError(409, 'Phiếu đặt hàng tuần này đã gửi NCC. Thay đổi sau đó báo ở mục Báo NCC thay đổi.');
      if (!record) {
        record = { id: uid('kwf'), campusId, weekStart, cells: {} };
        db.weeklyForecasts.push(record);
      }
      Object.assign(record, sentSnapshot(view), { sentAt: nowIso(), sentBy: user.id, notices: [] });
      return clone({ sentAt: record.sentAt });
    });
  },

  /** Đánh dấu đã báo NCC một dòng thay đổi (hoặc bỏ đánh dấu). */
  async setSupplierNotified({ campusId, weekStart, date, foodId, notified }, user) {
    await delay();
    guard(canEditForecast(user, campusId));
    return writeDb((db) => {
      ensureSeeded(db);
      const record = forecastRecord(db, campusId, weekStart);
      const line = weekView(db, campusId, weekStart)
        .changes.find((g) => g.date === date)
        ?.lines.find((l) => l.foodId === foodId);
      if (!record || !line) throw new ApiError(404, 'Không còn thay đổi này. Tải lại trang.');
      record.notices ||= [];
      if (notified && !line.notified) record.notices.push({ date, foodId, needed: line.needed, at: nowIso(), by: user.id });
      if (!notified && line.notified) {
        const i = record.notices.findLastIndex((n) => n.date === date && n.foodId === foodId);
        if (i >= 0) record.notices.splice(i, 1);
      }
      return clone({ date, foodId, notified: !!notified });
    });
  },

  /* ---- Kiểm nhận hàng tươi theo phiếu giao hàng (S5–S6): bếp kiểm, PHT xác nhận cuối; không cộng tồn ---- */
  async getFreshReceipt({ campusId, date }, user) {
    await delay();
    guard(canViewFreshReceipt(user));
    guardCampus(user, campusId);
    return clone(freshView(readSeeded(), campusId, date, user));
  },

  /** Bếp lưu nháp hoặc gửi PHT (`submit`). Gửi thì bắt đủ số phiếu giao hàng và lý do của dòng thiếu / trả lại. */
  async saveFreshReceipt({ campusId, date, header, lines, submit = false }, user) {
    await delay();
    guard(isKitchenStaff(user) && canAccessCampus(user, campusId));
    invalid(validateFreshReceipt({ header, lines }, { submit }));
    return writeDb((db) => {
      ensureSeeded(db);
      const view = freshView(db, campusId, date, user);
      if (!view.canEdit) throw new ApiError(409, 'Phiếu kiểm nhận đã gửi PHT, không sửa được. Tải lại trang.');
      if (!view.lines.length) throw new ApiError(409, 'Ngày này không có hàng tươi cần kiểm nhận.');
      const byFood = Object.fromEntries((lines || []).map((l) => [l.foodId, l]));
      let receipt = db.freshReceipts.find((r) => r.campusId === campusId && r.date === date);
      if (!receipt) {
        receipt = { id: uid('kfr'), campusId, date, status: FRESH_RECEIPT_STATUS.DRAFT, lines: [], history: [] };
        db.freshReceipts.unshift(receipt);
      }
      receipt.deliveryNote = String(header?.deliveryNote || '').trim();
      receipt.supplierName = String(header?.supplierName || '').trim();
      receipt.deliveredAt = header?.deliveredAt || '';
      receipt.lines = view.lines.map((l) => {
        const input = byFood[l.foodId] || {};
        const result = input.result || l.result;
        return {
          foodId: l.foodId,
          ordered: l.ordered,
          delivered: r3(Number(input.delivered ?? l.delivered)),
          received: r3(Number(input.received ?? l.received)),
          result,
          reason: result === FRESH_RESULT.OK ? '' : String(input.reason ?? l.reason ?? '').trim(),
          supplierNotifiedAt: l.supplierNotifiedAt || null,
        };
      });
      receipt.savedBy = user.id;
      receipt.savedAt = nowIso();
      if (submit) {
        receipt.status = FRESH_RECEIPT_STATUS.SUBMITTED;
        receipt.submittedBy = user.id;
        receipt.submittedAt = nowIso();
        receipt.returnNote = '';
        receipt.history.push({ action: 'SUBMITTED', userId: user.id, at: receipt.submittedAt });
        const odd = receipt.lines.filter((l) => l.result !== FRESH_RESULT.OK).length;
        usersWithRole(db, ROLES.VICE_PRINCIPAL, campusId).forEach((vp) =>
          pushNotification(db, {
            userId: vp.id,
            type: 'KITCHEN_FRESH_RECEIPT',
            title: 'Bếp đã kiểm nhận hàng tươi',
            message: `Ngày ${date.split('-').reverse().join('/')}: ${receipt.lines.length} thực phẩm${odd ? `, ${odd} dòng thiếu hoặc trả lại` : ''}. Chờ bạn xác nhận.`,
            link: `/kitchen/fresh-receipts?date=${date}`,
          }),
        );
      }
      return clone(freshView(db, campusId, date, user));
    });
  },

  /** PHT xác nhận kết quả cuối (khóa phiếu) hoặc trả bếp kiểm lại kèm ghi chú. */
  async reviewFreshReceipt({ campusId, date, approve, note = '' }, user) {
    await delay();
    guard(isVicePrincipal(user) && canAccessCampus(user, campusId));
    if (!approve && !String(note).trim()) invalid({ note: 'Ghi điều bếp cần kiểm lại.' });
    if (String(note).length > NOTE_MAX) invalid({ note: `Ghi chú tối đa ${NOTE_MAX} ký tự.` });
    return writeDb((db) => {
      ensureSeeded(db);
      const receipt = db.freshReceipts.find((r) => r.campusId === campusId && r.date === date);
      if (!receipt || receipt.status !== FRESH_RECEIPT_STATUS.SUBMITTED)
        throw new ApiError(409, 'Phiếu kiểm nhận không ở trạng thái chờ xác nhận. Tải lại trang.');
      const at = nowIso();
      if (approve) Object.assign(receipt, { status: FRESH_RECEIPT_STATUS.CONFIRMED, confirmedBy: user.id, confirmedAt: at });
      else Object.assign(receipt, { status: FRESH_RECEIPT_STATUS.DRAFT, returnNote: String(note).trim() });
      receipt.history.push({ action: approve ? 'CONFIRMED' : 'RETURNED', userId: user.id, at, note: String(note).trim() });
      if (!approve)
        usersWithRole(db, ROLES.KITCHEN_STAFF, campusId).forEach((k) =>
          pushNotification(db, {
            userId: k.id,
            type: 'KITCHEN_FRESH_RECEIPT',
            title: 'PHT trả phiếu kiểm nhận để kiểm lại',
            message: String(note).trim(),
            link: `/kitchen/fresh-receipts?date=${date}`,
          }),
        );
      return clone(freshView(db, campusId, date, user));
    });
  },

  /** Đánh dấu đã báo NCC dòng thiếu / trả lại (bếp hoặc PHT), tới khi PHT xác nhận. */
  async setFreshSupplierNotified({ campusId, date, foodId, notified }, user) {
    await delay();
    guard((isKitchenStaff(user) || isVicePrincipal(user)) && canAccessCampus(user, campusId));
    return writeDb((db) => {
      ensureSeeded(db);
      const receipt = db.freshReceipts.find((r) => r.campusId === campusId && r.date === date);
      const line = receipt?.lines.find((l) => l.foodId === foodId);
      if (!line || line.result === FRESH_RESULT.OK) throw new ApiError(404, 'Không có dòng thiếu hoặc trả lại này. Lưu phiếu trước.');
      if (receipt.status === FRESH_RECEIPT_STATUS.CONFIRMED) throw new ApiError(409, 'Phiếu đã được PHT xác nhận.');
      line.supplierNotifiedAt = notified ? nowIso() : null;
      line.supplierNotifiedBy = notified ? user.id : null;
      return clone(freshView(db, campusId, date, user));
    });
  },
};
