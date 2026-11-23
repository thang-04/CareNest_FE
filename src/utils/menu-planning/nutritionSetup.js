import { AGE_GROUPS, ageGroupById } from '@/models/School';
import {
  MEAL_SESSION_LABELS,
  MICRONUTRIENT_GROUPS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  sessionsOf,
} from '@/models/menu-planning/menuPlanningConstants';
import { priceOn } from '@/utils/menu-planning/menuCalculations';

/** Năng lượng một ngày (kcal) — bắt buộc cùng cơ cấu P:L:G để đánh giá ngày (BE NUT-24). */
export const KCAL_NORM = { key: 'kcal', label: 'Năng lượng', unit: 'kcal' };
/** Cơ cấu áp dụng P:L:G: tỷ lệ năng lượng từ đạm, béo, bột đường (%). */
export const STRUCTURE_NORM_COLUMNS = [
  { key: 'protein', label: 'Đạm', unit: '%' },
  { key: 'lipid', label: 'Béo', unit: '%' },
  { key: 'glucid', label: 'Bột đường', unit: '%' },
];
/** Định mức gam / trẻ / ngày theo chất (BE NUT-24); chất nào để trống thì không đánh giá chất đó. */
export const GRAM_NORM_COLUMNS = [
  { key: 'animalProteinG', label: 'Đạm động vật', unit: 'g' },
  { key: 'plantProteinG', label: 'Đạm thực vật', unit: 'g' },
  { key: 'animalLipidG', label: 'Béo động vật', unit: 'g' },
  { key: 'plantLipidG', label: 'Béo thực vật', unit: 'g' },
  { key: 'glucidG', label: 'Bột đường', unit: 'g' },
];
/** Tỷ lệ năng lượng từng bữa gốc (% nhu cầu năng lượng cả ngày `dailyKcalNeed`, BE NUT-25). */
export const SESSION_NORM_KEYS = { MORNING: 'morningKcalPct', LUNCH: 'lunchKcalPct', AFTERNOON: 'afternoonKcalPct' };
/** Định mức vi chất / trẻ / ngày (BE NUT-26), không bắt buộc; số sau trống = chỉ cần đạt tối thiểu. */
export const MICRO_NORM_GROUPS = MICRONUTRIENT_GROUPS.map((g) => ({
  ...g,
  columns: g.items.map((key) => ({ key, label: MICRONUTRIENT_LABELS[key], unit: MICRONUTRIENT_UNITS[key] })),
}));
/** Cơ cấu áp dụng P:L:G (BE NUT-27): một số % năng lượng mỗi chất, ba số cộng lại bằng 100. `key` trùng khóa khoảng ở STRUCTURE_NORM_COLUMNS. */
export const APPLIED_STRUCTURE_COLUMNS = [
  { key: 'protein', label: 'Đạm' },
  { key: 'lipid', label: 'Béo' },
  { key: 'glucid', label: 'Đường' },
];
/** Hàm lượng quy đổi tại trường (g/trẻ/ngày), chỉ đọc: BE trả kèm bản ghi (NUT-27), FE tính lại để xem trước khi đang gõ. */
export const CONVERTED_GRAM_ROWS = GRAM_NORM_COLUMNS.map(({ key, label }) => ({ key, label }));
/** Hệ số dùng khi BE chưa trả kèm: khớp dữ liệu mẫu NutriBot/PMS (BE `carenest.nutrition.conversion`). */
export const DEFAULT_CONVERSION_FACTORS = {
  proteinKcalPerG: 4.1,
  lipidKcalPerG: 9.3,
  glucidKcalPerG: 4.1,
  animalProteinShare: 0.6,
  animalLipidShare: 0.6,
};
/** Khóa định mức được gửi lên BE: năng lượng và khoảng P:L:G; gam theo chất do BE quy đổi, vi chất không nhập ở đây. */
const SUBMITTED_NORM_KEYS = [KCAL_NORM.key, ...STRUCTURE_NORM_COLUMNS.map((c) => c.key)];

const toNum = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Quy đổi cơ cấu P:L:G (% năng lượng) ra gam tại một mốc kcal — hiển thị xem trước, cùng công thức BE NUT-27.
 * Trả null khi thiếu kcal (phải > 0), thiếu một chất, ngoài 0–100 hoặc tổng khác 100. Không làm tròn.
 */
export const quyDoiGam = (kcal, applied, factors = DEFAULT_CONVERSION_FACTORS) => {
  const k = toNum(kcal);
  const [p, l, g] = APPLIED_STRUCTURE_COLUMNS.map((c) => toNum(applied?.[c.key]));
  if (k == null || k <= 0 || [p, l, g].some((v) => v == null || v < 0 || v > 100)) return null;
  if (Math.abs(p + l + g - 100) > 1e-9) return null;
  const damTong = (k * (p / 100)) / factors.proteinKcalPerG;
  const beoTong = (k * (l / 100)) / factors.lipidKcalPerG;
  return {
    animalProteinG: damTong * factors.animalProteinShare,
    plantProteinG: damTong * (1 - factors.animalProteinShare),
    animalLipidG: beoTong * factors.animalLipidShare,
    plantLipidG: beoTong * (1 - factors.animalLipidShare),
    glucidG: (k * (g / 100)) / factors.glucidKcalPerG,
  };
};

export const ALL_NORM_COLUMNS = [
  KCAL_NORM,
  ...STRUCTURE_NORM_COLUMNS,
  ...GRAM_NORM_COLUMNS,
  ...Object.values(SESSION_NORM_KEYS).map((key) => ({ key, unit: '%' })),
  ...MICRO_NORM_GROUPS.flatMap((g) => g.columns),
];

// Khóa định mức cũ (trước khi khớp tên BE animalProteinPct*, animalLipidPct*) còn trong localStorage
const LEGACY_NORM_KEYS = { animalProteinShare: 'animalProteinPct', animalLipidShare: 'animalLipidPct' };
export const hasLegacyNormKeys = (norms) => Object.keys(norms || {}).some((k) => k in LEGACY_NORM_KEYS);
/** Đổi khóa định mức cũ sang khóa mới; khóa mới đã có thì giữ. */
export const migrateNormKeys = (norms = {}) =>
  Object.entries(norms).reduce((out, [k, range]) => {
    const key = LEGACY_NORM_KEYS[k] || k;
    if (!(key in out) || key === k) out[key] = range;
    return out;
  }, {});

/** Tên viết tắt nhóm tuổi dùng trong bảng (Nhà trẻ, MG bé, MG nhỡ, MG lớn). */
export const ageAbbr = (ageGroupId) => (ageGroupById(ageGroupId)?.shortName || ageGroupId).replace('Mẫu giáo', 'MG');

const NURSERY_BEFORE_MONTHS = 36;

/**
 * Tên, độ tuổi, khối của nhóm tuổi trên màn Thiết lập. Bản nối BE có sẵn trong bản ghi thiết lập (nhóm do Hiệu trưởng
 * thêm không nằm trong danh sách tĩnh); bản mock tra danh sách tĩnh theo id.
 */
export const setupGroupInfo = (setup, ageGroupId = setup?.ageGroupId) => {
  const fixed = ageGroupById(ageGroupId);
  const from = setup?.ageFromMonths ?? fixed?.ageFromMonths;
  return {
    short: setup?.groupShortName || setup?.groupName || fixed?.shortName || ageGroupId,
    name: setup?.groupName || fixed?.name || ageGroupId,
    range:
      setup?.ageFromMonths != null && setup?.ageToMonths != null
        ? `${setup.ageFromMonths}–${setup.ageToMonths} tháng`
        : fixed?.name.match(/\((.+)\)/)?.[1] || '',
    nursery: from != null ? from < NURSERY_BEFORE_MONTHS : false,
  };
};

/** Nhóm tuổi đang bật ở Thiết lập; chưa có thiết lập thì là cả 4 nhóm. */
export const activeAgeGroups = (nutritionSetups = []) =>
  AGE_GROUPS.filter((g) => nutritionSetups.find((s) => s.ageGroupId === g.id)?.enabled !== false);

/** Bữa của nhóm tuổi theo Thiết lập [{ code, name }]; chưa có thiết lập thì là bữa gốc. */
export const mealsOf = (setups, ageGroupId) => {
  const meals = (setups || []).find((s) => s.ageGroupId === ageGroupId)?.meals;
  return meals?.length
    ? meals.map((m) => ({ code: m.code, name: m.name }))
    : sessionsOf(ageGroupId).map((code) => ({ code, name: MEAL_SESSION_LABELS[code] }));
};

export const mealCodesOf = (setups, ageGroupId) => mealsOf(setups, ageGroupId).map((m) => m.code);

/** Định mức áp cho phạm vi các bữa trường phục vụ của nhóm tuổi: chỉ giữ các bữa đã cấu hình khi so định mức. */
export const normScopeMeals = (meals, setups, ageGroupId) => {
  const codes = mealCodesOf(setups, ageGroupId);
  return (meals || []).filter((m) => codes.includes(m.session));
};

/** Tên bữa: theo nhóm tuổi nếu biết, không thì tìm ở mọi nhóm, cuối cùng là tên bữa gốc. */
export const mealLabel = (setups, ageGroupId, code) =>
  (ageGroupId && mealsOf(setups, ageGroupId).find((m) => m.code === code)?.name) ||
  (setups || []).flatMap((s) => s.meals || []).find((m) => m.code === code)?.name ||
  MEAL_SESSION_LABELS[code] ||
  code;

/** Bữa gốc của nhóm tuổi gắn với điểm danh/báo ăn: không xóa được, bữa thêm tính suất theo một bữa gốc. */
export const isBaseMeal = (ageGroupId, meal) => sessionsOf(ageGroupId).includes(meal.code);

/** Giá đang áp dụng hôm nay và giá đã hẹn áp dụng sau hôm nay (nếu có). */
export const priceStatus = (prices, ageGroupId, today) => ({
  current: priceOn(prices, ageGroupId, today),
  upcoming:
    (prices || [])
      .filter((p) => p.ageGroupId === ageGroupId && p.effectiveFrom > today)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))[0] || null,
});

/** Dữ liệu BE → form sửa (số để dạng chuỗi cho ô nhập). */
export const toSetupForm = (setups, today) => ({
  effectiveFrom: today,
  reason: '',
  basis: setups.find((s) => s.basis)?.basis || '',
  groups: setups.map((s) => ({
    ageGroupId: s.ageGroupId,
    name: setupGroupInfo(s).name,
    enabled: s.enabled,
    originalEnabled: s.enabled,
    price: String(s.price ?? ''),
    meals: s.meals.map((m) => ({ code: m.code, name: m.name, countAs: m.countAs })),
    // Số sau của vi chất có thể null (chỉ cần đạt tối thiểu) ⇒ ô trống, không thành chữ "null"
    norms: Object.fromEntries(
      ALL_NORM_COLUMNS.map(({ key }) => [key, (s.norms?.[key] || ['', '']).map((v) => (v == null ? '' : String(v)))]),
    ),
    dailyKcalNeed: String(s.dailyKcalNeed ?? ''),
    applied: Object.fromEntries(APPLIED_STRUCTURE_COLUMNS.map(({ key }) => [key, s.applied?.[key] == null ? '' : String(s.applied[key])])),
  })),
});

/** Form → payload gửi BE. */
export const toSetupPayload = (form) => ({
  effectiveFrom: form.effectiveFrom,
  reason: form.reason.trim(),
  basis: form.basis.trim(),
  groups: form.groups.map((g) => ({
    ageGroupId: g.ageGroupId,
    enabled: g.enabled,
    originalEnabled: g.originalEnabled,
    price: g.price,
    meals: g.meals.map(({ code, name, countAs }) => ({ code, name: name.trim(), countAs })),
    norms: Object.fromEntries(SUBMITTED_NORM_KEYS.map((key) => [key, g.norms[key]])),
    dailyKcalNeed: g.dailyKcalNeed,
    applied: g.applied,
  })),
});
