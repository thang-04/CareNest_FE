/**
 * Menu planning (SRS screens #69–#89, UC 6.1, 6.3–6.9, 6.11, BF-08).
 * Constants and labels shared by pages, the mock repository and the seed.
 *
 * @typedef {Object} Nutrition          values per 100 base units (g or ml); null = not recorded yet
 * @property {number|null} kcal
 * @property {number|null} protein      g
 * @property {number|null} lipid        g
 * @property {number|null} glucid       g
 *
 * @typedef {Object} Food               ingredient (SRS entity "Ingredient")
 * @property {string} id
 * @property {string} code              TP001
 * @property {string} name              unique
 * @property {string} group             FOOD_GROUP
 * @property {'g'|'ml'} unit            recipe unit
 * @property {string} purchaseUnit      kg, lít, quả, hộp… (GBR-MEAL-05 rounds up to it)
 * @property {number} purchaseUnitSize  base units in one purchase unit (1000 for kg)
 * @property {number} unitPrice         VND per purchase unit
 * @property {Nutrition} nutrition
 * @property {string[]} allergens       labels from ALLERGENS
 * @property {'ACTIVE'|'INACTIVE'} status
 *
 * @typedef {Object} DishIngredient
 * @property {string} foodId
 * @property {number} quantity          base units per standard portion (Mẫu giáo nhỡ = factor 1)
 *
 * @typedef {Object} Dish
 * @property {string} id
 * @property {string} code
 * @property {string} name              unique
 * @property {string} type              DISH_TYPE
 * @property {string} description
 * @property {DishIngredient[]} ingredients
 * @property {'ACTIVE'|'INACTIVE'} status
 *
 * @typedef {Object} MealItem
 * @property {string} dishId
 * @property {number} portion           multiplier of the standard portion (1 = standard)
 *
 * @typedef {Object} Meal
 * @property {string} session           MEAL_SESSION
 * @property {MealItem[]} items
 *
 * @typedef {Object} SampleMenu         sample daily menu of one age group (screens #77–#79)
 * @property {string} id
 * @property {string} code
 * @property {string} name
 * @property {string} ageGroupId
 * @property {Meal[]} meals
 * @property {'ACTIVE'|'INACTIVE'} status
 *
 * @typedef {Object} AllergyMenu        alternative menu built on a sample menu (screens #80–#82)
 * @property {string} id
 * @property {string} baseMenuId
 * @property {string} ageGroupId
 * @property {'ALLERGY'|'DIET'} groupType
 * @property {string[]} restrictions    excluded allergens
 * @property {{ session: string, originalDishId: string, replacementDishId: string|null, portion: number }[]} replacements
 *
 * @typedef {Object} WeeklyDay
 * @property {string} date              yyyy-mm-dd (Monday–Friday)
 * @property {boolean} holiday
 * @property {string} note
 * @property {string|null} menuId       sample menu the day was built from
 * @property {Meal[]} meals             copy of the sample menu, adjustable by nutrition balancing
 *
 * @typedef {Object} WeeklyMenu         (screens #84–#86, #88–#89)
 * @property {string} id
 * @property {string} code
 * @property {string} ageGroupId
 * @property {string} weekStart         Monday yyyy-mm-dd
 * @property {WeeklyDay[]} days
 * @property {'DRAFT'|'PUBLISHED'|'REPLACED'} status
 * @property {number} version
 * @property {string|null} replacesId
 */

export const RECORD_STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };
export const RECORD_STATUS_LABELS = { ACTIVE: 'Đang sử dụng', INACTIVE: 'Ngừng sử dụng' };

export const FOOD_GROUP_LABELS = {
  GRAIN: 'Lương thực',
  MEAT: 'Thịt',
  SEAFOOD: 'Thủy hải sản',
  EGG_DAIRY: 'Trứng, sữa',
  LEGUME: 'Đậu, hạt',
  VEGETABLE: 'Rau, củ',
  FRUIT: 'Trái cây',
  FAT_SUGAR: 'Dầu, đường',
  OTHER: 'Khác',
};

export const FOOD_UNIT_LABELS = { g: 'gam (g)', ml: 'mililít (ml)' };

/** Allergen labels; children allergies in school data use the same words (matched without accents). */
export const ALLERGENS = ['Tôm', 'Cua', 'Cá', 'Trứng', 'Sữa bò', 'Đậu phộng', 'Đậu nành', 'Lúa mì', 'Mè (vừng)'];

export const DISH_TYPE = { CARB: 'CARB', MAIN: 'MAIN', SOUP: 'SOUP', VEGETABLE: 'VEGETABLE', SNACK: 'SNACK', DESSERT: 'DESSERT' };
export const DISH_TYPE_LABELS = {
  CARB: 'Cơm, cháo',
  MAIN: 'Món mặn',
  SOUP: 'Canh',
  VEGETABLE: 'Món rau',
  SNACK: 'Món bữa chiều',
  DESSERT: 'Tráng miệng, sữa',
};

/* Same session codes as attendance (LUNCH, AFTERNOON); nursery groups have a third, morning snack. */
export const MEAL_SESSION = { MORNING: 'MORNING', LUNCH: 'LUNCH', AFTERNOON: 'AFTERNOON' };
export const MEAL_SESSION_LABELS = { MORNING: 'Bữa phụ sáng', LUNCH: 'Bữa trưa', AFTERNOON: 'Bữa chiều' };
export const SESSION_ORDER = [MEAL_SESSION.MORNING, MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON];

/** Meals per day: 3 for nursery ages, 2 for kindergarten ages (SRS entity Age Group). */
export const sessionsOf = (ageGroupId) =>
  ageGroupId === 'ag-2' ? [MEAL_SESSION.MORNING, MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON] : [MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON];

/**
 * Portion factor per age group: dish quantities are recorded for one standard portion (factor 1)
 * and scaled for each age group (GBR-MEAL-02 "portions differ between nursery and kindergarten ages").
 * Assumed values – the school must confirm them.
 */
export const PORTION_FACTORS = { 'ag-2': 0.7, 'ag-3': 0.9, 'ag-4': 1, 'ag-5': 1.1 };
export const portionFactorOf = (ageGroupId) => PORTION_FACTORS[ageGroupId] ?? 1;

/**
 * Reference values of one school day per age group (GBR-MENU-02, GBR-KIT-02).
 * The SRS leaves the standard open ("to be confirmed"); these are configurable reference values,
 * energy in kcal and protein / lipid / glucid as a share of the energy (%).
 */
export const NUTRITION_NORMS = {
  'ag-2': { kcal: [600, 651], protein: [13, 20], lipid: [30, 40], glucid: [40, 57] },
  'ag-3': { kcal: [615, 726], protein: [13, 20], lipid: [25, 35], glucid: [52, 60] },
  'ag-4': { kcal: [615, 726], protein: [13, 20], lipid: [25, 35], glucid: [52, 60] },
  'ag-5': { kcal: [615, 726], protein: [13, 20], lipid: [25, 35], glucid: [52, 60] },
};

export const NUTRIENT_LABELS = {
  kcal: 'Năng lượng',
  protein: 'Chất đạm (protein)',
  lipid: 'Chất béo (lipid)',
  glucid: 'Tinh bột (glucid)',
};
export const NUTRIENT_UNITS = { kcal: 'kcal', protein: 'g', lipid: 'g', glucid: 'g' };

export const NORM_STATUS = { LOW: 'LOW', OK: 'OK', HIGH: 'HIGH', NA: 'NA' };
export const NORM_STATUS_LABELS = { LOW: 'Thấp hơn định mức', OK: 'Trong định mức', HIGH: 'Cao hơn định mức', NA: 'Chưa đủ dữ liệu' };

export const ALLERGY_GROUP_LABELS = { ALLERGY: 'Dị ứng thực phẩm', DIET: 'Chế độ ăn đặc biệt' };

export const WEEKLY_STATUS = { DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED', REPLACED: 'REPLACED' };
export const WEEKLY_STATUS_LABELS = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản', REPLACED: 'Đã thay thế' };

export const HISTORY_LABELS = {
  CREATED: 'Tạo mới',
  UPDATED: 'Cập nhật',
  ADJUSTED: 'Cân đối dinh dưỡng',
  PUBLISHED: 'Xuất bản',
  REPLACEMENT_CREATED: 'Tạo phiên bản thay thế',
  REPLACED: 'Được thay thế bởi phiên bản mới',
  AI_APPLIED: 'Dùng bản nháp AI',
};

/** A main dish should not repeat within this many days (GBR-MENU-04: allowed but flagged). */
export const REPEAT_WINDOW_DAYS = 7;

export const AI_DRAFT_KIND = { WEEKLY: 'WEEKLY', DAILY: 'DAILY' };
export const AI_DRAFT_STATUS = { PENDING_REVIEW: 'PENDING_REVIEW', APPLIED: 'APPLIED', DISMISSED: 'DISMISSED' };
export const AI_DRAFT_STATUS_LABELS = { PENDING_REVIEW: 'Chờ người duyệt', APPLIED: 'Đã dùng', DISMISSED: 'Đã bỏ qua' };
export const AI_LABEL = 'Bản nháp AI – cần người duyệt';

export const WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

/* ---------- date helpers (local yyyy-mm-dd, no timezone shifts) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso, n) => {
  const d = parse(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

/** Monday of the week containing the date. */
export const mondayOf = (iso) => {
  const d = parse(iso);
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return toIso(d);
};

export const isMonday = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '') && parse(iso).getDay() === 1;

/** Monday to Friday dates of a week. */
export const weekDates = (weekStart) => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));

export const weekLabel = (weekStart) => {
  if (!weekStart) return '—';
  const [y1, m1, d1] = weekStart.split('-');
  const [y2, m2, d2] = addDays(weekStart, 4).split('-');
  return `${d1}/${m1}${y1 !== y2 ? `/${y1}` : ''} – ${d2}/${m2}/${y2}`;
};

export const formatMoney = (n) => (typeof n === 'number' && !Number.isNaN(n) ? `${Math.round(n).toLocaleString('vi-VN')} đ` : '—');
