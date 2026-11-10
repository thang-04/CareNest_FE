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
 * @property {number} purchaseUnitSize  base units in one purchase unit (1000 for kg) = purchaseToStock × stockUnitSize
 * @property {string} stockUnit         đơn vị tính tồn/xuất kho (BA 02); thiếu ⇒ bằng purchaseUnit
 * @property {number} purchaseToStock   số đơn vị kho trong 1 đơn vị mua
 * @property {number} stockUnitSize     số g/ml trong 1 đơn vị kho
 * @property {number} unitPrice         VND per purchase unit
 * @property {Nutrition} nutrition
 * @property {'ANIMAL'|'PLANT'|''} origin  nguồn gốc: đạm/béo của thực phẩm tính vào phần động vật hay thực vật
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
 * @property {'DRAFT'|'ACTIVE'|'INACTIVE'} status  DRAFT: chưa dùng được cho thực đơn
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

import { isNurseryAgeGroup } from '@/models/School';

export const RECORD_STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };
export const RECORD_STATUS_LABELS = { ACTIVE: 'Đang sử dụng', INACTIVE: 'Ngừng sử dụng' };
// BA 03: món có thêm Nháp — chưa chọn được vào thực đơn; ACTIVE/INACTIVE trùng giá trị RECORD_STATUS
export const DISH_STATUS = { DRAFT: 'DRAFT', ...RECORD_STATUS };
export const DISH_STATUS_LABELS = { DRAFT: 'Nháp', ...RECORD_STATUS_LABELS };

export { FOOD_GROUP_LABELS } from '@/models/foodGroups';

/** Nguồn gốc thực phẩm: đạm, béo của thực phẩm tính vào phần động vật hay thực vật. */
export const FOOD_ORIGIN = { ANIMAL: 'ANIMAL', PLANT: 'PLANT' };
export const FOOD_ORIGIN_LABELS = { ANIMAL: 'Động vật', PLANT: 'Thực vật' };
/** Nguồn gốc mặc định theo nhóm (chỉ dùng khi bổ sung dữ liệu cũ, nhập file thiếu cột): thịt, thủy sản, trứng sữa là động vật. */
export const defaultOriginOf = (group) => (['MEAT', 'SEAFOOD', 'EGG_DAIRY'].includes(group) ? FOOD_ORIGIN.ANIMAL : FOOD_ORIGIN.PLANT);

export const FOOD_UNIT_LABELS = { g: 'gam (g)', ml: 'mililít (ml)' };
/** Cách bảo quản: tươi (giao trong ngày) hay khô (lấy từ kho); dùng khi tách phiếu đi chợ. */
export const FOOD_STORAGE = { FRESH: 'FRESH', DRY: 'DRY' };
export const FOOD_STORAGE_LABELS = { FRESH: 'Tươi', DRY: 'Khô' };
export const defaultStorageOf = (group) => (['GRAIN', 'LEGUME', 'FAT_SUGAR', 'OTHER'].includes(group) ? 'DRY' : 'FRESH');

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
export { MEAL_SESSION_LABELS } from '@/models/mealSessions';
export const SESSION_ORDER = [MEAL_SESSION.MORNING, MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON];

/**
 * Bữa gốc mặc định khi nhóm tuổi chưa lưu Thiết lập: nhà trẻ 3 bữa, mẫu giáo 2 bữa (BA, theo cấp học, không theo mã nhóm).
 * Tên/giờ bữa còn chờ chốt (OD-09) nên số bữa thực tế lấy từ Thiết lập dinh dưỡng.
 */
export const sessionsOf = (ageGroupId) =>
  isNurseryAgeGroup(ageGroupId)
    ? [MEAL_SESSION.MORNING, MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON]
    : [MEAL_SESSION.LUNCH, MEAL_SESSION.AFTERNOON];

export const NUTRIENT_LABELS = {
  kcal: 'Năng lượng',
  protein: 'Chất đạm (protein)',
  lipid: 'Chất béo (lipid)',
  glucid: 'Tinh bột (glucid)',
};
export const NUTRIENT_UNITS = { kcal: 'kcal', protein: 'g', lipid: 'g', glucid: 'g' };

/**
 * Vi chất theo bảng PMS (BE NUT-26): trên 100 g ăn được của thực phẩm; trống = chưa có số liệu, không chặn tính toán.
 * Vitamin A tính theo đương lượng retinol (µg).
 */
export const MICRONUTRIENT_GROUPS = [
  { key: 'minerals', label: 'Khoáng chất', items: ['calcium', 'phosphorus', 'iron'] },
  { key: 'vitamins', label: 'Vitamin', items: ['vitaminA', 'vitaminB1', 'vitaminB2', 'vitaminPp', 'vitaminC'] },
];
export const MICRONUTRIENTS = MICRONUTRIENT_GROUPS.flatMap((g) => g.items);
export const MICRONUTRIENT_LABELS = {
  calcium: 'Canxi',
  phosphorus: 'Phospho',
  iron: 'Sắt',
  vitaminA: 'Vitamin A',
  vitaminB1: 'Vitamin B1',
  vitaminB2: 'Vitamin B2',
  vitaminPp: 'Vitamin PP',
  vitaminC: 'Vitamin C',
};
export const MICRONUTRIENT_UNITS = {
  calcium: 'mg',
  phosphorus: 'mg',
  iron: 'mg',
  vitaminA: 'µg',
  vitaminB1: 'mg',
  vitaminB2: 'mg',
  vitaminPp: 'mg',
  vitaminC: 'mg',
};

/** Sáu chỉ số cân đối khẩu phần (lượng thực tế, g hoặc kcal). */
export const INDICATOR_LABELS = {
  animalProtein: 'Đạm động vật',
  plantProtein: 'Đạm thực vật',
  animalLipid: 'Béo động vật',
  plantLipid: 'Béo thực vật',
  glucid: 'Tinh bột (glucid)',
  kcal: 'Năng lượng',
};
/** Tỷ lệ cơ cấu (%): phần động vật trong tổng đạm, tổng béo. */
export const SHARE_LABELS = {
  animalProteinPct: 'Đạm động vật / tổng đạm',
  animalLipidPct: 'Béo động vật / tổng béo',
};

// NA = dòng chưa đặt định mức; INCOMPLETE = thiếu số liệu thực phẩm nên không đánh giá
export const NORM_STATUS = { LOW: 'LOW', OK: 'OK', HIGH: 'HIGH', NA: 'NA', INCOMPLETE: 'INCOMPLETE' };
export const NORM_STATUS_LABELS = {
  LOW: 'Thấp hơn định mức',
  OK: 'Trong định mức',
  HIGH: 'Cao hơn định mức',
  NA: 'Chưa đặt định mức',
  INCOMPLETE: 'Chưa đủ dữ liệu',
  NO_DISHES: 'Chưa có món',
};

export const ALLERGY_GROUP_LABELS = { ALLERGY: 'Dị ứng thực phẩm', DIET: 'Chế độ ăn đặc biệt' };

/* Kế hoạch tuần theo khối trên BE (/nutrition/meal-plans): công bố cả tuần, không có phiên bản thay thế. */
export const MEAL_BLOCK = { NURSERY: 'NURSERY', KINDERGARTEN: 'KINDERGARTEN' };
export const MEAL_BLOCK_LABELS = { NURSERY: 'Nhà trẻ', KINDERGARTEN: 'Mẫu giáo' };
export const MEAL_PLAN_STATUS = { NONE: 'NONE', DRAFT: 'DRAFT', PUBLISHED: 'PUBLISHED' };
export const MEAL_PLAN_STATUS_LABELS = { NONE: 'Chưa lập', DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố' };
export const PLAN_ISSUE_SEVERITY_LABELS = { BLOCKING: 'Cần sửa trước khi công bố', WARNING: 'Cảnh báo', INFO: 'Lưu ý' };
// Dòng kiểm tra từng ngày của một nhóm tuổi (khóa `rows[].key` BE trả), theo thứ tự bảng dinh dưỡng PMS
export const EVAL_ROW_KEYS = [
  'kcal',
  'animalProteinG',
  'plantProteinG',
  'animalLipidG',
  'plantLipidG',
  'glucidG',
  'protein',
  'lipid',
  'glucid',
  ...MICRONUTRIENTS,
];
export const EVAL_ROW_LABELS = {
  ...MICRONUTRIENT_LABELS,
  kcal: 'Năng lượng',
  animalProteinG: 'Đạm động vật',
  plantProteinG: 'Đạm thực vật',
  animalLipidG: 'Béo động vật',
  plantLipidG: 'Béo thực vật',
  glucidG: 'Bột đường',
  protein: 'Cơ cấu đạm (P)',
  lipid: 'Cơ cấu béo (L)',
  glucid: 'Cơ cấu bột đường (G)',
};
export const EVAL_ROW_UNITS = {
  ...MICRONUTRIENT_UNITS,
  kcal: 'kcal',
  animalProteinG: 'g',
  plantProteinG: 'g',
  animalLipidG: 'g',
  plantLipidG: 'g',
  glucidG: 'g',
  protein: 'g',
  lipid: 'g',
  glucid: 'g',
};

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

export const AI_DRAFT_KIND = { WEEKLY: 'WEEKLY', DAILY: 'DAILY', DAY_FIX: 'DAY_FIX' };
export const AI_DRAFT_STATUS = { PENDING_REVIEW: 'PENDING_REVIEW', APPLIED: 'APPLIED', DISMISSED: 'DISMISSED' };
export const AI_DRAFT_STATUS_LABELS = { PENDING_REVIEW: 'Chờ người duyệt', APPLIED: 'Đã dùng', DISMISSED: 'Đã bỏ qua' };
export const AI_LABEL = 'Bản nháp AI – cần người duyệt';

export const WEEKDAY_LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

export { addDays, isMonday, mondayOf, schoolWeekStart, weekDates, weekLabel, weekOptions, weekShortLabel } from '@/utils/week';
export { formatMoney } from '@/utils/format';
