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
import { todayInput } from '@/utils/format';
import { uid } from '@/utils/id';
import { ROLES } from '@/models/User';
import {
  ISSUE_STATUS,
  MEAL_SESSIONS,
  MEAL_SESSION_LABELS,
  MENU_TYPE,
  MISSING_STATUS,
  PORTION_FACTOR_BY_AGE_GROUP,
  PREP_STATUS,
  PREP_STATUS_LABELS,
} from '@/models/kitchen/kitchenConstants';
import {
  canAccessCampus,
  canApproveStockIssue,
  isKitchenStaff,
  isVicePrincipal,
  canConfirmIngredientReceipt,
  canManageStock,
  canSubmitMissingFood,
  canSupplyMissingFood,
  canUpdatePreparation,
  canViewIngredientReceipt,
  canViewMealCount,
  canViewMissingFood,
  canViewPreparation,
  canViewPublishedMenu,
  canViewRequiredQuantity,
} from '@/utils/kitchen/kitchenPermissions';
import {
  validateIngredientReceipt,
  validateMissingFood,
  validatePreparationUpdate,
  validateStockReceipt,
} from '@/utils/kitchen/kitchenValidation';

/*
 * Fake backend of the kitchen module (BF-09). Spring Boot must re-implement these rules:
 * GBR-MEAL-01..05 (quantities from the confirmed meal count + published menu, per age group, substitutes apart,
 * rounded up), UC 6.23–6.25 (stock in / approved issue / kitchen reconciliation), GBR-KIT-01 and forward-only
 * preparation status. Cross-module reads (food catalog, menus, meal counts, classes) are isolated in the
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
  (db.weeklyMenus || []).filter((w) => String(w?.status || '').toUpperCase() === 'PUBLISHED').forEach((w) => visit(w, {}));
  return out;
};

const getPublishedMenus = (db, date) => (usesMenuPlanningCatalog(db) ? menusFromWeeklyMenus(db, date) : seedMenusForDate(date));

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
const computeDay = (db, cat, campusId, date) => {
  const sessions = MEAL_SESSIONS.map((s) => computeSession(db, cat, campusId, date, s));
  const withMenu = sessions.filter((s) => s.hasMenu);
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

const changeStock = (db, { campusId, foodId, delta, type, date, refId, userId, expiryDate }) => {
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
    at: nowIso(),
  });
};

/* ------------------------------------------------------------------ */
/* Lazy seeding                                                        */
/* ------------------------------------------------------------------ */

const COLLECTIONS = [
  'foodStock',
  'stockReceipts',
  'stockTransactions',
  'stockIssues',
  'ingredientReceipts',
  'missingFoodReports',
  'mealPreparations',
];

const seedHistory = (db, cat, campusIds) => {
  const yesterday = prevSchoolDays(todayInput(), 1)[0];
  const c1 = campusIds[0];
  if (!c1) return;
  const day = computeDay(db, cat, c1, yesterday);
  const vp = usersWithRole(db, ROLES.VICE_PRINCIPAL, c1)[0]?.id || null;
  const cook = usersWithRole(db, ROLES.KITCHEN_STAFF, c1)[0]?.id || null;
  const at = (time) => new Date(`${yesterday}T${time}:00+07:00`).toISOString();
  if (day.allConfirmed && day.foods.length) {
    const issueId = `ksi_${c1}_${ymd(yesterday)}`;
    const items = day.foods.map((f) => ({ foodId: f.foodId, requiredQty: f.requiredQty, stockBefore: r3(f.requiredQty + 5) }));
    db.stockIssues.push({
      id: issueId,
      code: `PX-${ymd(yesterday)}-${campusCode(db, c1)}`,
      campusId: c1,
      date: yesterday,
      status: ISSUE_STATUS.RECEIVED,
      items,
      approvedBy: vp,
      approvedAt: at('09:10'),
      history: [
        { action: 'PREPARED', userId: null, at: at('08:50') },
        { action: 'APPROVED', userId: vp, at: at('09:10') },
        { action: 'RECEIVED', userId: cook, at: at('09:40'), note: 'Thiếu một ít rau so với phiếu.' },
      ],
    });
    db.ingredientReceipts.push({
      id: `kir_${c1}_${ymd(yesterday)}`,
      issueId,
      campusId: c1,
      date: yesterday,
      items: items.map((it, i) => {
        const receivedQty = i === items.length - 1 ? r3(Math.max(0, it.requiredQty - 0.2)) : it.requiredQty;
        return { foodId: it.foodId, issuedQty: it.requiredQty, receivedQty, difference: r3(receivedQty - it.requiredQty), note: '' };
      }),
      hasDifference: true,
      confirmedBy: cook,
      confirmedAt: at('09:40'),
    });
  }
  MEAL_SESSIONS.forEach((session, i) => {
    const time = i === 0 ? '10:45' : '14:30';
    db.mealPreparations.push({
      id: `kmp_${c1}_${ymd(yesterday)}_${session}`,
      campusId: c1,
      date: yesterday,
      session,
      status: PREP_STATUS.READY_FOR_HANDOVER,
      note: '',
      updatedBy: cook,
      updatedAt: at(time),
      history: [
        { status: PREP_STATUS.WAITING, note: '', userId: cook, at: at(i === 0 ? '09:45' : '13:30') },
        { status: PREP_STATUS.COOKING, note: '', userId: cook, at: at(i === 0 ? '10:00' : '14:00') },
        { status: PREP_STATUS.READY_FOR_HANDOVER, note: '', userId: cook, at: at(time) },
      ],
    });
  });
  const greens = cat.foodById.kf_greens ? 'kf_greens' : cat.foods[0]?.id;
  if (greens) {
    db.missingFoodReports.push({
      id: `kmf_${c1}_${ymd(yesterday)}`,
      code: `BT-${ymd(yesterday)}-${campusCode(db, c1)}-1`,
      campusId: c1,
      date: yesterday,
      session: 'LUNCH',
      foodId: greens,
      quantity: 0.2,
      description: 'Rau nhận từ kho thiếu so với phiếu xuất.',
      status: MISSING_STATUS.SUPPLIED,
      submittedBy: cook,
      submittedAt: at('09:42'),
      suppliedBy: vp,
      suppliedAt: at('10:05'),
      supplyNote: 'Đã mua bổ sung tại chợ đầu mối.',
    });
  }
};

// Databases created before this module existed have no kitchen collections yet.
const ensureSeeded = (db) => {
  if (COLLECTIONS.every((k) => Array.isArray(db[k]))) return db;
  const cat = getCatalog(db);
  const campusIds = (db.campuses || []).map((c) => c.id);
  const vpByCampus = Object.fromEntries(campusIds.map((id) => [id, usersWithRole(db, ROLES.VICE_PRINCIPAL, id)[0]?.id]));
  const fresh = !Array.isArray(db.stockIssues);
  db.foodStock ||= buildOpeningStock(campusIds, cat.foods);
  db.stockReceipts ||= buildSeedReceipts({ campusIds, vpByCampus, dates: prevSchoolDays(todayInput(), 3).slice(0, 2) });
  db.stockTransactions ||= [];
  db.stockIssues ||= [];
  db.ingredientReceipts ||= [];
  db.missingFoodReports ||= [];
  db.mealPreparations ||= [];
  if (fresh) seedHistory(db, cat, campusIds);
  return db;
};

/** Read access: seeds once (write), then returns the snapshot. */
const readSeeded = () => {
  const db = readDb();
  if (!COLLECTIONS.every((k) => Array.isArray(db[k]))) writeDb(ensureSeeded);
  return readDb();
};

/* ------------------------------------------------------------------ */
/* Stock issue view model                                              */
/* ------------------------------------------------------------------ */

const issueView = (db, cat, campusId, date) => {
  const day = computeDay(db, cat, campusId, date);
  const stored = db.stockIssues.find((i) => i.campusId === campusId && i.date === date) || null;
  const foodMeta = (foodId) => cat.foodById[foodId] || { name: foodId, unit: '' };
  if (stored) {
    const receipt = db.ingredientReceipts.find((r) => r.issueId === stored.id) || null;
    return {
      state: stored.status,
      issue: {
        ...stored,
        items: stored.items.map((it) => ({ ...it, name: foodMeta(it.foodId).name, unit: foodMeta(it.foodId).unit })),
      },
      receipt: receipt && {
        ...receipt,
        items: receipt.items.map((it) => ({ ...it, name: foodMeta(it.foodId).name, unit: foodMeta(it.foodId).unit })),
      },
      day,
    };
  }
  const state = !day.hasMenu ? 'NO_MENU' : !day.allConfirmed ? 'WAITING_MEAL_COUNT' : ISSUE_STATUS.PENDING_APPROVAL;
  // UC 6.24 step 1: the slip is prepared from the confirmed count and compared with the current stock.
  const items =
    state === ISSUE_STATUS.PENDING_APPROVAL
      ? day.foods.map((f) => {
          const stock = stockQty(db, campusId, f.foodId);
          return {
            foodId: f.foodId,
            name: f.name,
            unit: f.unit,
            requiredQty: f.requiredQty,
            stock,
            shortage: r3(Math.max(0, f.requiredQty - stock)),
          };
        })
      : [];
  return {
    state,
    issue:
      state === ISSUE_STATUS.PENDING_APPROVAL
        ? { id: null, code: `PX-${ymd(date)}-${campusCode(db, campusId)}`, campusId, date, status: state, items, history: [] }
        : null,
    receipt: null,
    day,
  };
};

const sessionSummary = (day) =>
  day.sessions
    .filter((s) => s.hasMenu)
    .map((s) => ({ session: s.session, normal: s.totals.normal, substitute: s.totals.substitute, dishes: s.dishes }));

/* ------------------------------------------------------------------ */
/* Repository                                                          */
/* ------------------------------------------------------------------ */

export const kitchenMockRepository = {
  async getFoodCatalog(user) {
    await delay();
    guard(canManageStock(user) || canSubmitMissingFood(user) || canViewRequiredQuantity(user));
    return clone(getCatalog(readSeeded()).foods);
  },

  /* ---- #90 Food Stock Receipt (UC 6.23) ---- */
  async getStock({ campusId }, user) {
    await delay();
    guard(canManageStock(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    return cat.foods.map((f) => ({ foodId: f.id, name: f.name, unit: f.unit, quantity: stockQty(db, campusId, f.id) }));
  },

  async getStockReceipts({ campusId }, user) {
    await delay();
    guard(canManageStock(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    return clone(
      db.stockReceipts
        .filter((r) => r.campusId === campusId)
        .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
        .map((r) => ({
          ...r,
          items: r.items.map((it) => ({
            ...it,
            name: cat.foodById[it.foodId]?.name || it.foodId,
            unit: cat.foodById[it.foodId]?.unit || '',
          })),
        })),
    );
  },

  async createStockReceipt(payload, user) {
    await delay();
    guard(canManageStock(user));
    const campusId = user.campusId;
    guardCampus(user, campusId);
    invalid(validateStockReceipt(payload, todayInput()));
    return writeDb((db) => {
      ensureSeeded(db);
      const cat = getCatalog(db);
      payload.items.forEach((it) => {
        if (!cat.foodById[it.foodId]) throw new ApiError(422, 'Thực phẩm không có trong danh mục thực phẩm.');
      });
      const seq = db.stockReceipts.filter((r) => r.campusId === campusId && r.date === payload.date).length + 1;
      const receipt = {
        id: uid('ksr'),
        code: `PN-${ymd(payload.date)}-${campusCode(db, campusId)}-${seq}`,
        campusId,
        date: payload.date,
        note: String(payload.note || '').trim(),
        items: payload.items.map((it) => {
          const receivedQty = r3(Number(it.receivedQty));
          const rejectedQty = r3(Number(it.rejectedQty || 0));
          return {
            foodId: it.foodId,
            receivedQty,
            rejectedQty,
            acceptedQty: r3(receivedQty - rejectedQty),
            expiryDate: it.expiryDate || '',
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

  /* ---- #91 Stock Issue Approval (UC 6.24) and #95 issue part ---- */
  async getStockIssue({ campusId, date }, user) {
    await delay();
    guard(canManageStock(user) || canViewRequiredQuantity(user) || canViewIngredientReceipt(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const view = issueView(db, getCatalog(db), campusId, date);
    // Only the VP sees a slip before approval (it shows the campus stock).
    const issue = view.issue && (view.issue.id || canManageStock(user)) ? view.issue : null;
    return clone({ state: view.state, issue, receipt: view.receipt, sessions: sessionSummary(view.day) });
  },

  async approveStockIssue({ campusId, date }, user) {
    await delay();
    guard(canManageStock(user));
    guardCampus(user, campusId);
    return writeDb((db) => {
      ensureSeeded(db);
      const cat = getCatalog(db);
      const view = issueView(db, cat, campusId, date);
      if (view.state !== ISSUE_STATUS.PENDING_APPROVAL || view.issue.id)
        throw new ApiError(409, 'Phiếu xuất kho không ở trạng thái chờ duyệt. Tải lại trang để xem trạng thái mới.');
      guard(canApproveStockIssue(view.issue, user));
      const short = view.issue.items.filter((it) => it.shortage > 0);
      if (short.length)
        throw new ApiError(
          409,
          `Còn ${short.length} thực phẩm thiếu tồn kho (${short.map((s) => s.name).join(', ')}). Nhập kho bổ sung trước khi duyệt.`,
        );
      const issue = {
        id: uid('ksi'),
        code: view.issue.code,
        campusId,
        date,
        status: ISSUE_STATUS.APPROVED,
        items: view.issue.items.map((it) => ({ foodId: it.foodId, requiredQty: it.requiredQty, stockBefore: it.stock })),
        approvedBy: user.id,
        approvedAt: nowIso(),
        history: [
          {
            action: 'PREPARED',
            userId: null,
            at:
              view.day.sessions
                .map((s) => s.confirmedAt)
                .filter(Boolean)
                .sort()
                .pop() || nowIso(),
          },
          { action: 'APPROVED', userId: user.id, at: nowIso() },
        ],
      };
      issue.items.forEach((it) =>
        changeStock(db, { campusId, foodId: it.foodId, delta: -it.requiredQty, type: 'OUT', date, refId: issue.id, userId: user.id }),
      );
      db.stockIssues.unshift(issue);
      // UC 6.24 step 6: the slip and the cooking plan go to the kitchen.
      usersWithRole(db, ROLES.KITCHEN_STAFF, campusId).forEach((k) =>
        pushNotification(db, {
          userId: k.id,
          type: 'KITCHEN_STOCK_ISSUED',
          title: 'Phiếu xuất kho đã được duyệt',
          message: `${issue.code}: ${issue.items.length} thực phẩm cho ngày ${date.split('-').reverse().join('/')}. Kiểm tra và xác nhận số lượng thực nhận.`,
          link: `/kitchen/ingredient-receipts?date=${date}`,
        }),
      );
      return clone(issue);
    });
  },

  /* ---- #96 Ingredient Receipt (UC 6.25) ---- */
  async confirmIngredientReceipt({ campusId, date, items }, user) {
    await delay();
    guard(isKitchenStaff(user));
    guardCampus(user, campusId);
    invalid(validateIngredientReceipt(items));
    return writeDb((db) => {
      ensureSeeded(db);
      const issue = db.stockIssues.find((i) => i.campusId === campusId && i.date === date);
      if (!issue) throw new ApiError(404, 'Chưa có phiếu xuất kho đã duyệt cho ngày này.');
      if (issue.status !== ISSUE_STATUS.APPROVED) throw new ApiError(409, 'Phiếu xuất kho này đã được xác nhận nhận.');
      guard(canConfirmIngredientReceipt(issue, user));
      const byFood = Object.fromEntries(items.map((it) => [it.foodId, it]));
      const lines = issue.items.map((it) => {
        const entry = byFood[it.foodId];
        if (!entry) throw new ApiError(422, 'Nhập số lượng thực nhận cho mọi thực phẩm của phiếu.');
        const receivedQty = r3(Number(entry.receivedQty));
        return {
          foodId: it.foodId,
          issuedQty: it.requiredQty,
          receivedQty,
          difference: r3(receivedQty - it.requiredQty),
          note: String(entry.note || '').trim(),
        };
      });
      const receipt = {
        id: uid('kir'),
        issueId: issue.id,
        campusId,
        date,
        items: lines,
        hasDifference: lines.some((l) => l.difference !== 0),
        confirmedBy: user.id,
        confirmedAt: nowIso(),
      };
      db.ingredientReceipts.unshift(receipt);
      issue.status = ISSUE_STATUS.RECEIVED;
      issue.history.push({
        action: 'RECEIVED',
        userId: user.id,
        at: receipt.confirmedAt,
        note: receipt.hasDifference ? 'Có chênh lệch so với phiếu.' : '',
      });
      if (receipt.hasDifference) {
        const n = lines.filter((l) => l.difference !== 0).length;
        usersWithRole(db, ROLES.VICE_PRINCIPAL, campusId).forEach((vp) =>
          pushNotification(db, {
            userId: vp.id,
            type: 'KITCHEN_RECEIPT_DIFFERENCE',
            title: 'Bếp nhận thực phẩm có chênh lệch',
            message: `${issue.code}: ${n} thực phẩm lệch so với phiếu xuất kho.`,
            link: `/kitchen/ingredient-receipts?date=${date}`,
          }),
        );
      }
      return clone(receipt);
    });
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

  /* ---- #95 Required Food Quantity (UC 6.18) ---- */
  async getRequiredQuantity({ campusId, date, session }, user) {
    await delay();
    guard(canViewRequiredQuantity(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    const view = issueView(db, cat, campusId, date);
    const pick = session === 'ALL' ? view.day.sessions : view.day.sessions.filter((s) => s.session === session);
    const foods = session === 'ALL' ? view.day.foods : pick[0]?.foods || [];
    return clone({
      sessions: pick.map((s) => ({
        session: s.session,
        hasMenu: s.hasMenu,
        mealCountStatus: s.mealCountStatus,
        totals: s.totals,
        dishes: s.dishes,
        classes: s.classes.filter((c) => c.substitute > 0),
        warnings: s.warnings,
      })),
      foods: foods.map(({ raw: _raw, ...f }) => f),
      issue: view.issue && view.issue.id ? view.issue : null,
      issueState: view.state,
    });
  },

  /* ---- #97 Missing Food Report (UC 6.19) ---- */
  async getMissingFoodReports({ campusId, status }, user) {
    await delay();
    guard(canViewMissingFood(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    return clone(
      db.missingFoodReports
        .filter((r) => r.campusId === campusId && (!status || status === 'ALL' || r.status === status))
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .map((r) => ({ ...r, foodName: cat.foodById[r.foodId]?.name || r.foodId, unit: cat.foodById[r.foodId]?.unit || '' })),
    );
  },

  async submitMissingFoodReport(payload, user) {
    await delay();
    guard(canSubmitMissingFood(user));
    const campusId = user.campusId;
    guardCampus(user, campusId);
    invalid(validateMissingFood(payload, todayInput()));
    return writeDb((db) => {
      ensureSeeded(db);
      const cat = getCatalog(db);
      const food = cat.foodById[payload.foodId];
      if (!food) throw new ApiError(422, 'Thực phẩm không có trong danh mục thực phẩm.');
      const seq = db.missingFoodReports.filter((r) => r.campusId === campusId && r.date === payload.date).length + 1;
      const report = {
        id: uid('kmf'),
        code: `BT-${ymd(payload.date)}-${campusCode(db, campusId)}-${seq}`,
        campusId,
        date: payload.date,
        session: payload.session || null,
        foodId: payload.foodId,
        quantity: r3(Number(payload.quantity)),
        description: String(payload.description).trim(),
        status: MISSING_STATUS.SUBMITTED,
        submittedBy: user.id,
        submittedAt: nowIso(),
      };
      db.missingFoodReports.unshift(report);
      // GBR-KIT-01: the report never changes the menu or the meal count by itself.
      usersWithRole(db, ROLES.VICE_PRINCIPAL, campusId).forEach((vp) =>
        pushNotification(db, {
          userId: vp.id,
          type: 'KITCHEN_MISSING_FOOD',
          title: 'Bếp báo thiếu thực phẩm',
          message: `${report.code}: thiếu ${String(report.quantity).replace('.', ',')} ${food.unit} ${food.name}${report.session ? ` – ${MEAL_SESSION_LABELS[report.session]}` : ''}.`,
          link: '/kitchen/missing-food',
        }),
      );
      return clone(report);
    });
  },

  async markMissingFoodSupplied(id, note, user) {
    await delay();
    guard(isVicePrincipal(user));
    return writeDb((db) => {
      ensureSeeded(db);
      const report = db.missingFoodReports.find((r) => r.id === id);
      if (!report) throw new ApiError(404, 'Không tìm thấy báo cáo thiếu thực phẩm.');
      if (report.status !== MISSING_STATUS.SUBMITTED) throw new ApiError(409, 'Báo cáo này đã được xử lý.');
      guard(canSupplyMissingFood(report, user));
      if (String(note || '').length > 500) throw new ApiError(422, 'Ghi chú tối đa 500 ký tự.', { note: 'Ghi chú tối đa 500 ký tự.' });
      Object.assign(report, {
        status: MISSING_STATUS.SUPPLIED,
        suppliedBy: user.id,
        suppliedAt: nowIso(),
        supplyNote: String(note || '').trim(),
      });
      pushNotification(db, {
        userId: report.submittedBy,
        type: 'KITCHEN_MISSING_FOOD_SUPPLIED',
        title: 'Thực phẩm thiếu đã được bổ sung',
        message: `${report.code} đã được Phó hiệu trưởng bổ sung.`,
        link: '/kitchen/missing-food',
      });
      return clone(report);
    });
  },

  /* ---- #92 Meal Preparation Status (UC 6.12) and #98 update (UC 6.17) ---- */
  async getMealPreparations({ campusId, date }, user) {
    await delay();
    guard(canViewPreparation(user));
    guardCampus(user, campusId);
    const db = readSeeded();
    const cat = getCatalog(db);
    return clone(
      MEAL_SESSIONS.map((session) => {
        const s = computeSession(db, cat, campusId, date, session);
        const record = db.mealPreparations.find((p) => p.campusId === campusId && p.date === date && p.session === session) || null;
        return {
          session,
          hasMenu: s.hasMenu,
          mealCountStatus: s.mealCountStatus,
          totals: s.totals,
          classes: s.mealCountStatus === 'CONFIRMED' ? s.classes : [],
          dishes: s.dishes,
          record,
        };
      }),
    );
  },

  async updateMealPreparation(payload, user) {
    await delay();
    guard(canUpdatePreparation(user));
    const campusId = user.campusId;
    guardCampus(user, campusId);
    return writeDb((db) => {
      ensureSeeded(db);
      const cat = getCatalog(db);
      const { date, session } = payload;
      const record = db.mealPreparations.find((p) => p.campusId === campusId && p.date === date && p.session === session);
      invalid(validatePreparationUpdate(payload, record?.status, todayInput()));
      const s = computeSession(db, cat, campusId, date, session);
      // GBR-KIT-01: preparation works from the published menu and the confirmed meal count.
      if (!s.hasMenu) throw new ApiError(409, 'Bữa ăn này chưa có thực đơn đã công bố.');
      if (s.mealCountStatus !== 'CONFIRMED') throw new ApiError(409, 'Số suất ăn của bữa này chưa được Phó hiệu trưởng xác nhận.');
      const entry = { status: payload.status, note: String(payload.note || '').trim(), userId: user.id, at: nowIso() };
      const previousStatus = record?.status || null;
      let saved = record;
      if (saved) {
        Object.assign(saved, { status: entry.status, note: entry.note, updatedBy: user.id, updatedAt: entry.at });
        saved.history.push(entry);
      } else {
        saved = {
          id: uid('kmp'),
          campusId,
          date,
          session,
          status: entry.status,
          note: entry.note,
          updatedBy: user.id,
          updatedAt: entry.at,
          history: [entry],
        };
        db.mealPreparations.push(saved);
      }
      const when = `${MEAL_SESSION_LABELS[session]} ngày ${date.split('-').reverse().join('/')}`;
      usersWithRole(db, ROLES.VICE_PRINCIPAL, campusId).forEach((vp) =>
        pushNotification(db, {
          userId: vp.id,
          type: 'KITCHEN_PREPARATION',
          title: 'Bếp cập nhật tình trạng chế biến',
          message: `${when}: ${PREP_STATUS_LABELS[entry.status]}.${entry.note ? ` ${entry.note}` : ''}`,
          link: `/kitchen/preparation?date=${date}`,
        }),
      );
      // UC 6.17 step 7: when ready, each teacher is told how many servings the class receives.
      if (entry.status === PREP_STATUS.READY_FOR_HANDOVER && previousStatus !== PREP_STATUS.READY_FOR_HANDOVER) {
        const classById = classesOf(db);
        s.classes.forEach((c) => {
          (classById[c.classId]?.teacherIds || []).forEach((teacherId) =>
            pushNotification(db, {
              userId: teacherId,
              type: 'KITCHEN_READY_FOR_HANDOVER',
              title: 'Bếp sẵn sàng bàn giao suất ăn',
              message: `${when} – ${c.className}: ${c.normal} suất thường, ${c.substitute} suất thay thế.`,
            }),
          );
        });
      }
      return clone(saved);
    });
  },
};
